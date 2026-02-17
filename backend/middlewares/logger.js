const morgan = require('morgan');
const winston = require('winston');
const path = require('path');
const AuditLog = require('../models/AuditLog');

/**
 * WINSTON LOGGER CONFIGURATION
 * Structured logging with multiple transports
 */
const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n  Meta: ${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] ${level}: ${stack || message}${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  format: combine(
    errors({ stack: true }), // Capture stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    splat()
  ),
  transports: [
    // Error log (errors only)
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: combine(json()),
      maxsize: 10485760,   // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Combined log (all levels)
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: combine(json()),
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true
    }),
    // Security-specific log
    new winston.transports.File({
      filename: path.join('logs', 'security.log'),
      level: 'warn',
      format: combine(json()),
      maxsize: 10485760,
      maxFiles: 30,        // Keep more security logs
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'exceptions.log'),
      format: combine(json())
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join('logs', 'rejections.log'),
      format: combine(json())
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize({ all: true }), devFormat)
    })
  );
}

/**
 * MORGAN HTTP REQUEST LOGGER
 * Custom tokens for enhanced logging
 */

// Custom token: request ID
morgan.token('request-id', (req) => req.requestId || '-');

// Custom token: user info
morgan.token('user', (req) => {
  if (req.user) {
    return `${req.user._id} (${req.user.role?.name || 'unknown'})`;
  }
  return 'anonymous';
});

// Custom token: response time in ms
morgan.token('response-ms', (req, res) => {
  const hrtime = process.hrtime(req.startHrTime);
  return `${(hrtime[0] * 1000 + hrtime[1] / 1e6).toFixed(2)}ms`;
});

// Custom token: request body size
morgan.token('body-size', (req) => {
  return req.headers['content-length'] || '0';
});

// Development HTTP format
const devMorganFormat = ':method :url :status :response-ms - User::user - ReqID::request-id';

// Production HTTP format (JSON structured)
const prodMorganFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-ms',
  contentLength: ':res[content-length]',
  bodySize: ':body-size',
  user: ':user',
  requestId: ':request-id',
  ip: ':remote-addr',
  userAgent: ':user-agent',
  referrer: ':referrer'
});

// Track request start time
const requestTimer = (req, res, next) => {
  req.startTime = Date.now();
  req.startHrTime = process.hrtime();
  next();
};

// Morgan middleware configurations
const httpLogger = {
  dev: [
    requestTimer,
    morgan(devMorganFormat, {
      skip: (req) => req.url === '/health' || req.url === '/ping',
      stream: {
        write: (message) => logger.http(message.trim())
      }
    })
  ],
  prod: [
    requestTimer,
    morgan(prodMorganFormat, {
      skip: (req) => req.url === '/health' || req.url === '/ping',
      stream: {
        write: (message) => {
          try {
            logger.http(JSON.parse(message.trim()));
          } catch {
            logger.http(message.trim());
          }
        }
      }
    })
  ]
};

/**
 * REQUEST/RESPONSE LOGGER MIDDLEWARE
 * Logs detailed API request/response for audit purposes
 */
const apiAuditLogger = (req, res, next) => {
  const originalSend = res.json.bind(res);

  res.json = function (data) {
    res.locals.responseBody = data;
    return originalSend(data);
  };

  res.on('finish', async () => {
    // Only log non-GET requests or error responses to avoid noise
    const shouldLog =
      req.method !== 'GET' || res.statusCode >= 400;

    if (!shouldLog) return;

    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      user: req.user?._id || null,
      role: req.user?.role?.name || 'anonymous',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      duration: Date.now() - req.startTime,
      bodySize: req.headers['content-length'] || 0
    };

    if (res.statusCode >= 400) {
      logger.warn('API Error Response', logData);
    } else {
      logger.info('API Request', logData);
    }
  });

  next();
};

/**
 * SANITIZE LOG DATA
 * Removes sensitive fields before logging
 */
const sanitizeLogData = (data) => {
  const sensitiveFields = [
    'password',
    'passwordConfirm',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'cardNumber',
    'cvv',
    'ssn',
    'secret'
  ];

  if (typeof data !== 'object' || data === null) return data;

  const sanitized = { ...data };
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

module.exports = {
  logger,
  httpLogger,
  apiAuditLogger,
  requestTimer,
  sanitizeLogData
};