const AuditLog = require('../models/AuditLog');

/**
 * CUSTOM APPLICATION ERROR CLASS
 * Extends native Error with operational status and HTTP codes
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // vs programmer errors
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * MONGOOSE SPECIFIC ERROR HANDLERS
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
  return new AppError(message, 409, 'DUPLICATE_FIELD');
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message,
    value: el.value
  }));

  return {
    statusCode: 422,
    status: 'fail',
    errorCode: 'VALIDATION_ERROR',
    message: 'Validation failed',
    errors,
    isOperational: true,
    timestamp: new Date().toISOString()
  };
};

/**
 * JWT ERROR HANDLERS
 */
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');

/**
 * SEND ERROR - DEVELOPMENT MODE
 * Full error details for debugging
 */
const sendErrorDev = (err, req, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    message: err.message,
    errors: err.errors,
    stack: err.stack,
    timestamp: err.timestamp || new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId
  });
};

/**
 * SEND ERROR - PRODUCTION MODE
 * Hides sensitive implementation details
 */
const sendErrorProd = (err, req, res) => {
  // Operational errors: send details to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      errorCode: err.errorCode || 'ERROR',
      message: err.message,
      errors: err.errors, // Include field-level errors for validation
      timestamp: err.timestamp || new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Programmer errors: log and send generic message
  console.error('[UNHANDLED ERROR]', err);

  return res.status(500).json({
    status: 'error',
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong. Please try again later.',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
};

/**
 * GLOBAL ERROR HANDLER MIDDLEWARE
 * Must be registered LAST in Express app
 * Has 4 parameters (err, req, res, next) - Express identifies it as error handler
 */
const globalErrorHandler = async (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log errors to audit log for 5xx errors
  if (err.statusCode >= 500 && req.user) {
    AuditLog.logAction({
      user: req.user._id,
      action: 'OTHER',
      targetEntity: 'System',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        type: 'SERVER_ERROR',
        errorCode: err.errorCode,
        endpoint: req.originalUrl,
        method: req.method
      },
      status: 'FAILURE',
      errorMessage: err.message,
      responseTime: Date.now() - (req.startTime || Date.now()),
      httpMethod: req.method,
      endpoint: req.originalUrl
    }).catch(console.error);
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);

    // Transform Mongoose/JWT errors into operational AppErrors
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') {
      const validationErr = handleValidationErrorDB(error);
      return res.status(validationErr.statusCode).json(validationErr);
    }
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

/**
 * 404 NOT FOUND HANDLER
 * Catches all unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404, 'ROUTE_NOT_FOUND'));
};

/**
 * ASYNC HANDLER WRAPPER
 * Eliminates repetitive try/catch in async route handlers
 * Usage: router.get('/', asyncHandler(myController))
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * UNHANDLED REJECTION HANDLER (process-level)
 * Register this once in your server.js
 */
const setupProcessErrorHandlers = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('[UNHANDLED REJECTION]', err.name, err.message);
    console.error('Shutting down gracefully...');
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err.name, err.message);
    console.error('Shutting down immediately...');
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    console.log('[SIGTERM] Received. Shutting down gracefully...');
    server.close(() => {
      console.log('[SIGTERM] Process terminated.');
    });
  });
};

module.exports = {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  setupProcessErrorHandlers
};