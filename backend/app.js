'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const path = require('path');

// Middleware imports
const {
  // Security
  helmetConfig,
  mongoSanitizer,
  hppProtection,
  requestId,
  additionalSecurityHeaders,
  validateContentType,
  suspiciousPatternDetector,

  // CORS
  corsMiddleware,
  preflightHandler,

  // Rate Limiting
  globalLimiter,
  speedLimiter,

  // Logging
  httpLogger,
  apiAuditLogger,
  requestTimer,

  // Input Sanitization
  sanitizeBody,

  // Error Handling
  globalErrorHandler,
  notFoundHandler
} = require('./middlewares');

const { logger } = require('./middlewares/logger');

/**
 * Initialize Express application
 */
const createApp = () => {
  const app = express();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TRUST PROXY
  // Required for correct IP detection behind load balancers / reverse proxies
  // (e.g., Nginx, AWS ALB, Heroku, Render, Railway)
  // '1' = trust the first proxy hop only
  // ─────────────────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REQUEST ID
  // First middleware — assign unique ID to every request for tracing
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(requestId);
  app.use(requestTimer);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SECURITY HEADERS (Helmet + Custom)
  // Must come before any route or body parsing
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(helmetConfig);
  app.use(additionalSecurityHeaders);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CORS
  // Handle preflight OPTIONS requests before anything else
  // ─────────────────────────────────────────────────────────────────────────────
  app.options('*', preflightHandler);
  app.use(corsMiddleware);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. HTTP REQUEST LOGGING (Morgan)
  // Before body parsing so we log all incoming requests
  // ─────────────────────────────────────────────────────────────────────────────
  const morganMiddlewares =
    process.env.NODE_ENV === 'production' ? httpLogger.prod : httpLogger.dev;
  morganMiddlewares.forEach((mw) => app.use(mw));
  app.use(apiAuditLogger);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. BODY PARSING
  // Strict size limits to prevent DoS via large payloads
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(
    cookieParser(
      process.env.COOKIE_SECRET || (() => {
        throw new Error('COOKIE_SECRET must be set in environment variables');
      })()
    )
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. INPUT SANITIZATION
  // Must come AFTER body parsing, BEFORE route handlers
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(mongoSanitizer);          // Prevent NoSQL injection ($, . stripping)
  app.use(hppProtection);           // Prevent HTTP parameter pollution
  app.use(sanitizeBody);            // Strip HTML tags, trim strings
  app.use(suspiciousPatternDetector); // Detect XSS/SQL patterns

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. RESPONSE COMPRESSION
  // Compress responses for bandwidth savings
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(
    compression({
      level: 6,                         // Compression level (1-9)
      threshold: 1024,                  // Only compress responses > 1KB
      filter: (req, res) => {
        // Don't compress server-sent events
        if (req.headers['accept'] === 'text/event-stream') return false;
        return compression.filter(req, res);
      }
    })
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. RATE LIMITING (Global)
  // Applied before routes to protect all endpoints
  // ─────────────────────────────────────────────────────────────────────────────
  app.use('/api', globalLimiter);
  app.use('/api', speedLimiter);

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. CONTENT-TYPE VALIDATION
  // Enforce JSON content type on mutation routes
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(
    validateContentType(['application/json', 'application/x-www-form-urlencoded'])
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. HEALTH CHECK ENDPOINTS
  // Must be registered before auth middleware to remain public
  // ─────────────────────────────────────────────────────────────────────────────
  const { getDBHealth } = require('./config/db');

  app.get('/health', (req, res) => {
    const dbHealth = getDBHealth();

    const status = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbHealth
      },
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    });
  });

  app.get('/ping', (req, res) => {
    res.status(200).json({ pong: true, timestamp: Date.now() });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. API ROUTES
  // Lazy-loaded to avoid circular dependency issues
  // ─────────────────────────────────────────────────────────────────────────────
  const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

  // Auth routes (no auth middleware — public)
  // app.use(`${API_PREFIX}/auth`, require('./routes/auth.routes'));

  // Protected routes (auth middleware applied inside route files or here)
  // app.use(`${API_PREFIX}/users`,        require('./routes/user.routes'));
  // app.use(`${API_PREFIX}/roles`,        require('./routes/role.routes'));
  // app.use(`${API_PREFIX}/rooms`,        require('./routes/room.routes'));
  // app.use(`${API_PREFIX}/room-types`,   require('./routes/roomType.routes'));
  // app.use(`${API_PREFIX}/guests`,       require('./routes/guest.routes'));
  // app.use(`${API_PREFIX}/reservations`, require('./routes/reservation.routes'));
  // app.use(`${API_PREFIX}/occupancies`,  require('./routes/occupancy.routes'));
  // app.use(`${API_PREFIX}/payments`,     require('./routes/payment.routes'));
  // app.use(`${API_PREFIX}/maintenance`,  require('./routes/maintenance.routes'));
  // app.use(`${API_PREFIX}/audit-logs`,   require('./routes/auditLog.routes'));

  // API info endpoint
  app.get(API_PREFIX, (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Hotel Management System API',
      version: process.env.API_VERSION || 'v1',
      documentation: process.env.DOCS_URL || `${req.protocol}://${req.get('host')}/docs`,
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: `${API_PREFIX}/auth`,
        users: `${API_PREFIX}/users`,
        roles: `${API_PREFIX}/roles`,
        rooms: `${API_PREFIX}/rooms`,
        roomTypes: `${API_PREFIX}/room-types`,
        guests: `${API_PREFIX}/guests`,
        reservations: `${API_PREFIX}/reservations`,
        occupancies: `${API_PREFIX}/occupancies`,
        payments: `${API_PREFIX}/payments`,
        maintenance: `${API_PREFIX}/maintenance`,
        auditLogs: `${API_PREFIX}/audit-logs`
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. STATIC FILES (optional — for uploaded files, receipts, etc.)
  // Only enable if serving files directly through Express
  // ─────────────────────────────────────────────────────────────────────────────
  if (process.env.SERVE_STATIC === 'true') {
    app.use(
      '/uploads',
      express.static(path.join(__dirname, 'uploads'), {
        maxAge: '1d',
        etag: true,
        lastModified: true,
        index: false,   // Don't serve directory listings
        dotfiles: 'deny'
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. ERROR HANDLERS
  // Must always be LAST — order matters
  // ─────────────────────────────────────────────────────────────────────────────
  app.use(notFoundHandler);     // Catch unmatched routes → 404
  app.use(globalErrorHandler);  // Catch all errors → structured response

  logger.info('[APP] Express application configured ✓');

  return app;
};

module.exports = createApp;