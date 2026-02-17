'use strict';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT VALIDATION
 * Fail fast — crash immediately if critical env vars are missing
 * This must run before any other imports that rely on process.env
 * ─────────────────────────────────────────────────────────────────────────────
 */
const validateEnvironment = () => {
  const REQUIRED_ENV_VARS = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_EXPIRES_IN',
    'JWT_REFRESH_EXPIRES_IN',
    'COOKIE_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE'
  ];

  const RECOMMENDED_ENV_VARS = [
    'FRONTEND_URL',
    'ALLOWED_ORIGINS',
    'LOG_LEVEL',
    'API_VERSION',
    'DB_POOL_SIZE',
    'APP_NAME'
  ];

  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error('─'.repeat(60));
    console.error('[FATAL] Missing required environment variables:');
    missing.forEach((v) => console.error(`  ✗  ${v}`));
    console.error('─'.repeat(60));
    console.error('[FATAL] Server startup aborted. Fix your .env file.');
    console.error('─'.repeat(60));
    process.exit(1);
  }

  const missingRecommended = RECOMMENDED_ENV_VARS.filter((v) => !process.env[v]);
  if (missingRecommended.length > 0) {
    console.warn('[WARN] Recommended environment variables not set:');
    missingRecommended.forEach((v) => console.warn(`  ⚠  ${v}`));
  }

  // Security checks for production
  if (process.env.NODE_ENV === 'production') {
    const JWT_MIN_LENGTH = 32;

    if (process.env.JWT_SECRET.length < JWT_MIN_LENGTH) {
      console.error('[FATAL] JWT_SECRET is too short. Minimum 32 characters required in production.');
      process.exit(1);
    }

    if (process.env.JWT_REFRESH_SECRET.length < JWT_MIN_LENGTH) {
      console.error('[FATAL] JWT_REFRESH_SECRET is too short. Minimum 32 characters required in production.');
      process.exit(1);
    }

    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      console.error('[FATAL] JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
      process.exit(1);
    }

    if (process.env.COOKIE_SECRET.length < JWT_MIN_LENGTH) {
      console.error('[FATAL] COOKIE_SECRET is too short. Minimum 32 characters required in production.');
      process.exit(1);
    }
  }
};

// Load environment variables FIRST
require('dotenv').config();
validateEnvironment();

// NOW import modules that depend on environment variables
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const createApp = require('./app');
const { connectDB, disconnectDB, getDBHealth } = require('./config/db');
const { setupProcessErrorHandlers } = require('./middlewares/errorHandler');
const { logger } = require('./middlewares/logger');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * CREATE HTTP/HTTPS SERVER
 * In production with SSL certs available, creates HTTPS server
 * Otherwise creates HTTP server (suitable for reverse proxy termination)
 */
const createServer = (app) => {
  // HTTPS: Only if SSL certs are explicitly configured
  if (
    NODE_ENV === 'production' &&
    process.env.SSL_CERT_PATH &&
    process.env.SSL_KEY_PATH
  ) {
    try {
      const sslOptions = {
        cert: fs.readFileSync(path.resolve(process.env.SSL_CERT_PATH)),
        key: fs.readFileSync(path.resolve(process.env.SSL_KEY_PATH)),
        // Modern TLS configuration
        minVersion: 'TLSv1.2',
        ciphers: [
          'TLS_AES_256_GCM_SHA384',
          'TLS_CHACHA20_POLY1305_SHA256',
          'TLS_AES_128_GCM_SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256'
        ].join(':'),
        honorCipherOrder: true
      };

      logger.info('[SERVER] SSL certificates loaded. Starting HTTPS server...');
      return { server: https.createServer(sslOptions, app), protocol: 'https' };
    } catch (err) {
      logger.error('[SERVER] Failed to load SSL certificates:', { message: err.message });
      logger.warn('[SERVER] Falling back to HTTP server.');
    }
  }

  // HTTP: Standard for development or behind reverse proxy (Nginx/Caddy)
  return { server: http.createServer(app), protocol: 'http' };
};

/**
 * CONFIGURE SERVER TIMEOUTS
 * Prevents slow clients from holding connections open
 */
const configureServerTimeouts = (server) => {
  // How long to keep idle keep-alive connections open
  server.keepAliveTimeout = 65000;  // Slightly above AWS ALB's 60s

  // Max time to receive request headers
  server.headersTimeout = 70000;    // Must be > keepAliveTimeout

  // Max time for a request to complete
  server.timeout = 120000;          // 2 minutes

  // Max number of connections in the queue
  server.maxConnections = parseInt(process.env.MAX_CONNECTIONS || '1000');

  logger.info(`[SERVER] Timeouts configured — KeepAlive: 65s | Headers: 70s | Request: 120s`);
};

/**
 * GRACEFUL SHUTDOWN
 * Allows in-flight requests to complete before shutting down
 * Critical for zero-downtime deployments and clean process exits
 */
const setupGracefulShutdown = (server) => {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      logger.warn(`[SERVER] Shutdown already in progress. Ignoring ${signal}.`);
      return;
    }

    isShuttingDown = true;

    logger.info(`\n[SERVER] ${signal} received. Starting graceful shutdown...`);
    logger.info('[SERVER] No longer accepting new connections.');

    // Set a hard kill timeout (15s) in case graceful shutdown hangs
    const forceKillTimeout = setTimeout(() => {
      logger.error('[SERVER] Graceful shutdown timed out. Force killing process.');
      process.exit(1);
    }, 15000);

    // Prevent the timeout from keeping the process alive
    forceKillTimeout.unref();

    try {
      // Step 1: Stop accepting new HTTP connections
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error('[SERVER] Error closing HTTP server:', { message: err.message });
            return reject(err);
          }
          logger.info('[SERVER] HTTP server closed ✓');
          resolve();
        });
      });

      // Step 2: Close database connection
      await disconnectDB();
      logger.info('[SERVER] Database connection closed ✓');

      // Step 3: Flush any pending logs
      await new Promise((resolve) => setTimeout(resolve, 500));

      clearTimeout(forceKillTimeout);
      logger.info('[SERVER] Graceful shutdown complete. Goodbye ✓');
      process.exit(0);
    } catch (err) {
      logger.error('[SERVER] Error during graceful shutdown:', { message: err.message });
      clearTimeout(forceKillTimeout);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop, Kubernetes, Heroku
  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in terminal
  process.on('SIGHUP', () => shutdown('SIGHUP'));   // Terminal closed

  logger.info('[SERVER] Graceful shutdown handlers registered ✓');
};

/**
 * LOG SERVER STARTUP BANNER
 * Provides a clear startup summary in logs
 */
const logStartupBanner = (protocol, host, port, dbHealth) => {
  const line = '═'.repeat(60);
  const baseUrl = `${protocol}://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  const apiPrefix = `/api/${process.env.API_VERSION || 'v1'}`;

  logger.info(line);
  logger.info('  🏨  Hotel Management System API — Server Started');
  logger.info(line);
  logger.info(`  Environment  : ${NODE_ENV.toUpperCase()}`);
  logger.info(`  Base URL     : ${baseUrl}`);
  logger.info(`  API Prefix   : ${apiPrefix}`);
  logger.info(`  Health Check : ${baseUrl}/health`);
  logger.info(`  Database     : ${dbHealth.state} (${dbHealth.database})`);
  logger.info(`  DB Host      : ${dbHealth.host}:${dbHealth.port}`);
  logger.info(`  Pool Size    : ${dbHealth.poolSize}`);
  logger.info(`  Protocol     : ${protocol.toUpperCase()}`);
  logger.info(`  PID          : ${process.pid}`);
  logger.info(`  Node.js      : ${process.version}`);
  logger.info(`  Memory       : ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  logger.info(line);
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MAIN BOOTSTRAP FUNCTION
 * Orchestrates the full startup sequence
 * ─────────────────────────────────────────────────────────────────────────────
 */
const bootstrap = async () => {
  logger.info('[BOOT] Starting Hotel Management System...');
  logger.info(`[BOOT] Environment: ${NODE_ENV} | PID: ${process.pid}`);

  try {
    // ── Step 1: Connect to Database ──────────────────────────────────────────
    logger.info('[BOOT] Step 1/4 — Connecting to MongoDB Atlas...');
    await connectDB();
    logger.info('[BOOT] Step 1/4 — Database connected ✓');

    // ── Step 2: Create Express App ───────────────────────────────────────────
    logger.info('[BOOT] Step 2/4 — Initializing Express application...');
    const app = createApp();
    logger.info('[BOOT] Step 2/4 — Express application initialized ✓');

    // ── Step 3: Create HTTP/HTTPS Server ─────────────────────────────────────
    logger.info('[BOOT] Step 3/4 — Creating server...');
    const { server, protocol } = createServer(app);
    configureServerTimeouts(server);
    logger.info('[BOOT] Step 3/4 — Server created ✓');

    // ── Step 4: Register Lifecycle Handlers ──────────────────────────────────
    logger.info('[BOOT] Step 4/4 — Registering process handlers...');
    setupGracefulShutdown(server);
    setupProcessErrorHandlers(server);
    logger.info('[BOOT] Step 4/4 — Process handlers registered ✓');

    // ── Start Listening ───────────────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      server.listen(PORT, HOST, (err) => {
        if (err) return reject(err);
        resolve();
      });

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(
            new Error(
              `[SERVER] Port ${PORT} is already in use. ` +
              `Kill the existing process or use a different PORT.`
            )
          );
        } else if (err.code === 'EACCES') {
          reject(
            new Error(
              `[SERVER] Permission denied on port ${PORT}. ` +
              `Ports below 1024 require elevated privileges.`
            )
          );
        } else {
          reject(err);
        }
      });
    });

    // ── Print Startup Summary ─────────────────────────────────────────────────
    const dbHealth = getDBHealth();
    logStartupBanner(protocol, HOST, PORT, dbHealth);

    return server;
  } catch (err) {
    logger.error('[BOOT] Fatal error during server startup:', {
      message: err.message,
      stack: err.stack
    });

    // Attempt clean database disconnect before exit
    try {
      await disconnectDB();
    } catch {
      // Ignore disconnect errors during boot failure
    }

    process.exit(1);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
bootstrap();