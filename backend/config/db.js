const mongoose = require('mongoose');
const { logger } = require('../middlewares/logger');

/**
 * MongoDB connection state tracking
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
const CONNECTION_STATES = {
  0: 'DISCONNECTED',
  1: 'CONNECTED',
  2: 'CONNECTING',
  3: 'DISCONNECTING'
};

/**
 * Mongoose global configuration
 * Applied once before any connection attempt
 */
const configureMongoose = () => {
  // Suppress deprecation warnings from Mongoose
  mongoose.set('strictQuery', true);

  // Return lean objects by default for better performance (opt-in per query)
  mongoose.set('strict', true);

  // Disable __v versioning key if not needed (enable if using optimistic concurrency)
  // mongoose.set('versionKey', false);

  // Enable debug logging only in development
  if (process.env.NODE_ENV === 'development' && process.env.MONGOOSE_DEBUG === 'true') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      logger.debug(`[Mongoose] ${collectionName}.${method}`, {
        query: JSON.stringify(query),
        doc: JSON.stringify(doc)
      });
    });
  }
};

/**
 * Build MongoDB connection URI
 * Supports MongoDB Atlas connection string from environment
 */
const buildConnectionURI = () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      '[DB] MONGODB_URI is not defined in environment variables. ' +
      'Please set it in your .env file.'
    );
  }

  return uri;
};

/**
 * Mongoose connection options
 * Tuned for production use with MongoDB Atlas
 */
const getConnectionOptions = () => ({
  // Connection pool
  maxPoolSize: parseInt(process.env.DB_POOL_SIZE || '10'),   // Max concurrent connections
  minPoolSize: parseInt(process.env.DB_MIN_POOL || '2'),     // Keep at least 2 alive
  maxIdleTimeMS: 30000,                                      // Close idle connections after 30s

  // Timeouts
  serverSelectionTimeoutMS: 10000,  // How long to wait for server selection
  socketTimeoutMS: 45000,           // Timeout for socket inactivity
  connectTimeoutMS: 15000,          // Timeout for initial connection
  heartbeatFrequencyMS: 10000,      // How often to check connection health

  // Atlas / Replica Set
  retryWrites: true,                // Automatically retry failed writes
  retryReads: true,                 // Automatically retry failed reads
  w: 'majority',                    // Write concern: majority of replica set members
  readPreference: 'primaryPreferred', // Read from primary, fall back to secondary

  // Compression (reduces bandwidth to Atlas)
  compressors: ['snappy', 'zlib'],

  // App name (visible in Atlas monitoring dashboards)
  appName: process.env.APP_NAME || 'HotelManagementSystem',

  // Auto-create indexes defined in schemas (disable in production if managing manually)
  autoIndex: process.env.NODE_ENV !== 'production',

  // Automatically create collections (disable for strict schema control)
  autoCreate: process.env.NODE_ENV !== 'production'
});

/**
 * REGISTER MONGOOSE CONNECTION EVENTS
 * Provides visibility into connection lifecycle
 */
const registerConnectionEvents = () => {
  const conn = mongoose.connection;

  conn.on('connecting', () => {
    logger.info('[DB] Establishing connection to MongoDB Atlas...');
  });

  conn.on('connected', () => {
    const host = conn.host;
    const name = conn.name;
    logger.info(`[DB] Connected to MongoDB Atlas — Host: ${host} | DB: ${name}`);
  });

  conn.on('open', () => {
    logger.info('[DB] MongoDB connection is open and ready to accept operations.');
  });

  conn.on('disconnected', () => {
    logger.warn('[DB] MongoDB connection lost. Attempting to reconnect...');
  });

  conn.on('reconnected', () => {
    logger.info('[DB] Successfully reconnected to MongoDB Atlas.');
  });

  conn.on('error', (err) => {
    logger.error('[DB] MongoDB connection error:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
  });

  conn.on('close', () => {
    logger.info('[DB] MongoDB connection closed.');
  });

  // Monitor connection pool events (useful for Atlas performance tuning)
  conn.on('fullsetup', () => {
    logger.info('[DB] Replica set fully connected.');
  });

  conn.on('all', () => {
    logger.info('[DB] All replica set members connected.');
  });
};

/**
 * CONNECT TO MONGODB
 * Main connection function with retry logic
 */
const connectDB = async (retries = 5, delay = 5000) => {
  configureMongoose();
  registerConnectionEvents();

  const uri = buildConnectionURI();
  const options = getConnectionOptions();

  let attempt = 0;

  while (attempt < retries) {
    attempt++;

    try {
      logger.info(`[DB] Connection attempt ${attempt}/${retries}...`);

      await mongoose.connect(uri, options);

      // Verify connection is truly ready
      await mongoose.connection.db.admin().ping();

      logger.info('[DB] MongoDB Atlas connection established and verified ✓');
      logger.info(`[DB] Database: "${mongoose.connection.name}"`);
      logger.info(`[DB] Host: "${mongoose.connection.host}:${mongoose.connection.port}"`);
      logger.info(`[DB] Pool Size: ${options.maxPoolSize}`);
      logger.info(`[DB] Auto-Index: ${options.autoIndex}`);

      return mongoose.connection;
    } catch (err) {
      logger.error(`[DB] Connection attempt ${attempt}/${retries} failed:`, {
        message: err.message,
        code: err.code
      });

      if (attempt === retries) {
        logger.error('[DB] Maximum connection retries reached. Exiting process.');
        process.exit(1);
      }

      // Exponential backoff with jitter
      const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      logger.info(`[DB] Retrying in ${Math.round(backoff / 1000)}s...`);

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
};

/**
 * DISCONNECT FROM MONGODB
 * Graceful shutdown — waits for in-flight operations to complete
 */
const disconnectDB = async () => {
  const state = CONNECTION_STATES[mongoose.connection.readyState];

  if (mongoose.connection.readyState === 0) {
    logger.info('[DB] Already disconnected. No action needed.');
    return;
  }

  try {
    logger.info(`[DB] Initiating graceful disconnect (current state: ${state})...`);

    await mongoose.connection.close(false); // false = don't force close, wait for ops

    logger.info('[DB] MongoDB connection gracefully closed ✓');
  } catch (err) {
    logger.error('[DB] Error during disconnect:', { message: err.message });

    // Force close as fallback
    await mongoose.connection.close(true);
    logger.warn('[DB] MongoDB connection force-closed.');
  }
};

/**
 * GET CONNECTION HEALTH STATUS
 * Used by health check endpoints
 */
const getDBHealth = () => {
  const conn = mongoose.connection;
  const state = conn.readyState;

  return {
    status: state === 1 ? 'healthy' : 'unhealthy',
    state: CONNECTION_STATES[state] || 'UNKNOWN',
    host: conn.host || null,
    port: conn.port || null,
    database: conn.name || null,
    poolSize: getConnectionOptions().maxPoolSize,
    readyState: state
  };
};

/**
 * SEED INDEXES
 * Ensures all model indexes are built (for production where autoIndex=false)
 * Call this once during a deployment migration step, not on every start
 */
const ensureIndexes = async () => {
  try {
    logger.info('[DB] Ensuring all model indexes are synced...');

    const models = mongoose.modelNames();

    await Promise.all(
      models.map(async (modelName) => {
        const model = mongoose.model(modelName);
        await model.ensureIndexes();
        logger.info(`[DB] Indexes synced for model: ${modelName}`);
      })
    );

    logger.info('[DB] All model indexes synced ✓');
  } catch (err) {
    logger.error('[DB] Index sync failed:', { message: err.message });
    throw err;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getDBHealth,
  ensureIndexes
};