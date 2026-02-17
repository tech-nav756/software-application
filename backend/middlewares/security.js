const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const crypto = require('crypto');
const { AppError } = require('./errorHandler');

/**
 * HELMET CONFIGURATION
 * Comprehensive HTTP security headers
 */
const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      frameAncestors: ["'none'"]
    }
  },
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000,         // 1 year
    includeSubDomains: true,
    preload: true
  },
  // X-Frame-Options
  frameguard: { action: 'deny' },
  // X-Content-Type-Options
  noSniff: true,
  // X-XSS-Protection (legacy browsers)
  xssFilter: true,
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Permissions Policy (replaces Feature Policy)
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  // Remove X-Powered-By header
  hidePoweredBy: true,
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // IE No Open
  ieNoOpen: true
});

/**
 * MONGO SANITIZER
 * Prevents NoSQL injection by stripping $ and . from user input
 */
const mongoSanitizer = mongoSanitize({
  replaceWith: '_',
  allowDots: false,
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Mongo injection attempt blocked. Key: ${key}, IP: ${req.ip}`);
  }
});

/**
 * HTTP PARAMETER POLLUTION PROTECTION
 * Prevents attackers from duplicating query params
 * Whitelist params that legitimately appear multiple times
 */
const hppProtection = hpp({
  whitelist: [
    'sort',
    'fields',
    'status',
    'roomType',
    'amenities',
    'floor',
    'tags',
    'ids',
    'permissions'
  ]
});

/**
 * REQUEST ID MIDDLEWARE
 * Assigns a unique ID to every incoming request
 * Useful for distributed tracing and log correlation
 */
const requestId = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * SECURITY HEADERS (additional custom headers)
 * Supplements helmet with additional protection
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Disable caching for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Custom API identification (non-revealing)
  res.setHeader('X-API-Version', process.env.API_VERSION || 'v1');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Permissions Policy - restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
  );

  // Cross-Origin Embedder/Opener Policy
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
};

/**
 * PAYLOAD SIZE LIMITER
 * Prevents large payload attacks (DoS via body size)
 * Applied via express.json() options, but also validated here
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];

      if (!contentType) {
        return next(new AppError('Content-Type header is required for this request.', 400));
      }

      const isAllowed = allowedTypes.some((type) => contentType.includes(type));

      if (!isAllowed) {
        return next(
          new AppError(
            `Unsupported Content-Type. Expected: ${allowedTypes.join(', ')}`,
            415
          )
        );
      }
    }
    next();
  };
};

/**
 * CSRF DOUBLE-SUBMIT COOKIE PROTECTION
 * For session-based flows with cookies
 * Validates that CSRF token in header matches the one in the cookie
 */
const csrfProtection = (req, res, next) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip if using Authorization header (token-based auth is CSRF-safe)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  const csrfCookie = req.signedCookies?.['csrf-token'];
  const csrfHeader = req.headers['x-csrf-token'];

  if (!csrfCookie || !csrfHeader) {
    return next(new AppError('CSRF token missing.', 403));
  }

  if (csrfCookie !== csrfHeader) {
    return next(new AppError('Invalid CSRF token.', 403));
  }

  next();
};

/**
 * GENERATE CSRF TOKEN
 * Endpoint handler to issue a CSRF token
 */
const generateCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie('csrf-token', token, {
    httpOnly: false,  // Must be readable by JavaScript to set in header
    signed: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.json({
    status: 'success',
    data: { csrfToken: token }
  });
};

/**
 * IP WHITELIST MIDDLEWARE
 * Restricts access to certain routes by IP
 * Usage: ipWhitelist(['10.0.0.1', '192.168.1.0/24'])
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (!allowedIPs.length) return next();

    const clientIP = req.ip;

    if (!allowedIPs.includes(clientIP)) {
      return next(
        new AppError(`Access from IP ${clientIP} is not permitted.`, 403)
      );
    }

    next();
  };
};

/**
 * SUSPICIOUS PATTERN DETECTOR
 * Detects and flags common attack patterns in requests
 */
const suspiciousPatternDetector = (req, res, next) => {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
    /(\b)(on\w+)(\s*)=/gi,                                 // Event handlers
    /javascript\s*:/gi,                                    // JS protocol
    /data\s*:/gi,                                          // Data URI
    /vbscript\s*:/gi,                                      // VBScript
    /\bexec\s*\(/gi,                                       // SQL exec
    /\bUNION\b.*\bSELECT\b/gi,                            // SQL injection
    /\bDROP\s+(TABLE|DATABASE)\b/gi                        // SQL DROP
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  const isSuspicious = suspiciousPatterns.some((pattern) =>
    pattern.test(requestData)
  );

  if (isSuspicious) {
    console.warn(
      `[SECURITY] Suspicious pattern detected: IP=${req.ip}, URL=${req.originalUrl}, Method=${req.method}`
    );

    // In production, block; in development, warn
    if (process.env.NODE_ENV === 'production') {
      return next(
        new AppError('Request contains potentially malicious content.', 400)
      );
    }
  }

  next();
};

module.exports = {
  helmetConfig,
  mongoSanitizer,
  hppProtection,
  requestId,
  additionalSecurityHeaders,
  validateContentType,
  csrfProtection,
  generateCsrfToken,
  ipWhitelist,
  suspiciousPatternDetector
};