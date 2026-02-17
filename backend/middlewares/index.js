const { protect, optionalAuth, createSendToken, logout } = require('./auth');
const {
  restrictTo,
  requirePermission,
  requireAnyPermission,
  requireMinimumRole,
  checkOwnership,
  preventPrivilegeEscalation,
  preventSelfModification,
  exposePermissions
} = require('./rbac');
const {
  globalLimiter,
  authLimiter,
  authSpeedLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  reportLimiter,
  speedLimiter
} = require('./rateLimiter');
const { corsMiddleware, preflightHandler, strictCors } = require('./cors');
const {
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
} = require('./security');
const {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  setupProcessErrorHandlers
} = require('./errorHandler');
const {
  logger,
  httpLogger,
  apiAuditLogger,
  requestTimer,
  sanitizeLogData
} = require('./logger');
const {
  validate,
  validateObjectId,
  sanitizeBody,
  validateDateRange,
  schemas
} = require('./validate');

module.exports = {
  // Auth
  protect,
  optionalAuth,
  createSendToken,
  logout,

  // RBAC
  restrictTo,
  requirePermission,
  requireAnyPermission,
  requireMinimumRole,
  checkOwnership,
  preventPrivilegeEscalation,
  preventSelfModification,
  exposePermissions,

  // Rate Limiting
  globalLimiter,
  authLimiter,
  authSpeedLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  reportLimiter,
  speedLimiter,

  // CORS
  corsMiddleware,
  preflightHandler,
  strictCors,

  // Security
  helmetConfig,
  mongoSanitizer,
  hppProtection,
  requestId,
  additionalSecurityHeaders,
  validateContentType,
  csrfProtection,
  generateCsrfToken,
  ipWhitelist,
  suspiciousPatternDetector,

  // Error Handling
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  setupProcessErrorHandlers,

  // Logging
  logger,
  httpLogger,
  apiAuditLogger,
  requestTimer,
  sanitizeLogData,

  // Validation
  validate,
  validateObjectId,
  sanitizeBody,
  validateDateRange,
  schemas
};