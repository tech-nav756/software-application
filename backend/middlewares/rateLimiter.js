const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { redisClient } = require('../config/redis');

let RedisStore;

// Use Redis store if available, otherwise use in-memory
try {
  const { RedisStore: RS } = require('rate-limit-redis');
  RedisStore = RS;
} catch {
  // RedisStore not available, use memory store
}

/**
 * Create Redis or Memory store for rate limiting
 */
const createStore = (prefix) => {
  if (redisClient?.isOpen && RedisStore) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: `rl:${prefix}:`
    });
  }
  return undefined; // Falls back to in-memory store
};

/**
 * RESPONSE HANDLER
 * Standardized rate limit response
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please slow down and try again.',
    retryAfter: Math.ceil(res.getHeader('Retry-After')) || 60
  });
};

/**
 * SKIP FUNCTION
 * Skip rate limiting for trusted IPs (internal services, health checks)
 */
const createSkipFn = (trustedIPs = []) => {
  const defaultTrusted = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const allTrusted = new Set([...defaultTrusted, ...trustedIPs]);

  return (req) => allTrusted.has(req.ip);
};

/**
 * KEY GENERATOR
 * Rate limit by both IP and user ID (if authenticated)
 * Prevents authenticated users from bypassing limits by rotating IPs
 */
const createKeyGenerator = (prefix = '') => {
  return (req) => {
    const userId = req.user?._id?.toString() || '';
    const ip = req.ip;
    return `${prefix}:${ip}:${userId}`;
  };
};

/**
 * GLOBAL RATE LIMITER
 * Applied to ALL API routes
 * 200 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: 'draft-7',   // RateLimit headers (RFC draft 7)
  legacyHeaders: false,
  store: createStore('global'),
  skip: createSkipFn(),
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again later.'
  }
});

/**
 * AUTH RATE LIMITER
 * Strict limit for login/register to prevent brute force
 * 5 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('auth'),
  skip: createSkipFn(),
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit by IP + email to prevent distributed attacks
    const email = req.body?.email?.toLowerCase() || '';
    return `auth:${req.ip}:${email}`;
  }
});

/**
 * PASSWORD RESET LIMITER
 * Very strict: 3 attempts per hour
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('pwd_reset'),
  skip: createSkipFn(),
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      code: 'TOO_MANY_RESET_ATTEMPTS',
      message: 'Too many password reset attempts. Please try again in 1 hour.',
      retryAfter: 3600
    });
  },
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase() || '';
    return `pwd_reset:${req.ip}:${email}`;
  }
});

/**
 * API RATE LIMITER
 * General API calls for authenticated users
 * 100 requests per 10 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('api'),
  skip: createSkipFn(),
  handler: rateLimitHandler,
  keyGenerator: createKeyGenerator('api')
});

/**
 * STRICT LIMITER
 * For sensitive write operations (payments, creating users, etc.)
 * 20 requests per 10 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('strict'),
  skip: createSkipFn(),
  handler: rateLimitHandler,
  keyGenerator: createKeyGenerator('strict')
});

/**
 * REPORT LIMITER
 * For expensive report/aggregation endpoints
 * 10 requests per 5 minutes
 */
const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore('report'),
  skip: createSkipFn(),
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      code: 'REPORT_RATE_LIMIT',
      message: 'Report generation is limited. Please wait before requesting another report.',
      retryAfter: 300
    });
  },
  keyGenerator: createKeyGenerator('report')
});

/**
 * SPEED LIMITER (Slow Down)
 * Gradually slows down responses after threshold
 * Before hard blocking, add delay to make brute force infeasible
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  delayAfter: 30,             // After 30 requests...
  delayMs: (hits) => hits * 100, // Add 100ms per extra request
  maxDelayMs: 5000,           // Cap at 5s delay
  skip: createSkipFn(),
  keyGenerator: (req) => req.ip
});

/**
 * AUTH SPEED LIMITER
 * Slow down login attempts before hard block
 */
const authSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,              // After 2 attempts, slow down
  delayMs: (hits) => hits * 500, // 500ms per additional attempt
  maxDelayMs: 10000,          // Max 10s delay
  skip: createSkipFn(),
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase() || '';
    return `auth_slow:${req.ip}:${email}`;
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  authSpeedLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  reportLimiter,
  speedLimiter
};