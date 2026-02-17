const cors = require('cors');
const { AppError } = require('./errorHandler');

/**
 * Allowed origins configuration
 */
const getAllowedOrigins = () => {
  const origins = [];

  // Production origins
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  if (process.env.ADMIN_URL) {
    origins.push(process.env.ADMIN_URL);
  }

  // Additional allowed origins from env (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    const extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map((o) =>
      o.trim()
    );
    origins.push(...extraOrigins);
  }

  // Add localhost variants in development
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://localhost:5173', // Vite
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }

  return origins;
};

/**
 * CORS OPTIONS
 * Dynamic origin validation with comprehensive headers config
 */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (server-to-server, Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all origins (with warning)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[CORS] Non-whitelisted origin allowed in dev mode: ${origin}`);
      return callback(null, true);
    }

    console.error(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    return callback(
      new AppError(`CORS policy does not allow access from origin: ${origin}`, 403)
    );
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
    'X-CSRF-Token',
    'X-Request-ID',
    'Cache-Control',
    'X-Api-Key'
  ],

  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Token-Refresh-Hint',
    'X-Request-ID',
    'X-User-Role',
    'X-User-Permissions',
    'Content-Disposition', // For file downloads
    'Retry-After'
  ],

  credentials: true,           // Allow cookies and Authorization headers
  optionsSuccessStatus: 204,   // Some older browsers choke on 200 for OPTIONS
  preflightContinue: false,    // Terminate preflight requests here
  maxAge: 86400                // Cache preflight response for 24 hours
};

/**
 * MAIN CORS MIDDLEWARE
 */
const corsMiddleware = cors(corsOptions);

/**
 * PREFLIGHT HANDLER
 * Explicitly handle OPTIONS preflight requests
 */
const preflightHandler = cors({ ...corsOptions, optionsSuccessStatus: 204 });

/**
 * STRICT CORS
 * For highly sensitive admin endpoints - more restrictive
 */
const strictCorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    const adminOrigins = [
      process.env.ADMIN_URL,
      process.env.FRONTEND_URL,
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:5173'] : [])
    ].filter(Boolean);

    if (!origin || adminOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new AppError('Strict CORS policy: Origin not authorized for admin operations.', 403)
    );
  }
};

const strictCors = cors(strictCorsOptions);

module.exports = {
  corsMiddleware,
  preflightHandler,
  strictCors
};