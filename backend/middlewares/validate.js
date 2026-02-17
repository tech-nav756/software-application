const Joi = require('joi');
const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

/**
 * VALIDATION SCHEMAS
 * Centralized Joi schemas for all request bodies
 */
const schemas = {

  // Auth
  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).required()
  }),

  register: Joi.object({
    fullName: Joi.string().min(2).max(100).trim().required(),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-()]+$/).required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base':
          'Password must contain uppercase, lowercase, number, and special character'
      }),
    role: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({ 'string.pattern.base': 'Role must be a valid MongoDB ObjectId' })
  }),

  // Room
  createRoom: Joi.object({
    roomNumber: Joi.string().alphanum().uppercase().max(10).required(),
    roomType: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    floor: Joi.number().integer().min(0).max(100).required(),
    capacity: Joi.number().integer().min(1).max(20).required(),
    status: Joi.string()
      .valid('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'OUT_OF_SERVICE')
      .default('AVAILABLE'),
    pricePerNight: Joi.number().positive().precision(2).required(),
    amenities: Joi.array().items(Joi.string().max(50)).max(30),
    viewType: Joi.string().valid('CITY', 'SEA', 'GARDEN', 'POOL', 'MOUNTAIN', 'NONE'),
    smokingAllowed: Joi.boolean(),
    petFriendly: Joi.boolean(),
    notes: Joi.string().max(1000)
  }),

  // Reservation
  createReservation: Joi.object({
    guest: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    room: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    checkInDate: Joi.date().greater('now').iso().required(),
    checkOutDate: Joi.date().greater(Joi.ref('checkInDate')).iso().required(),
    numberOfGuests: Joi.number().integer().min(1).max(10).required(),
    bookingSource: Joi.string()
      .valid('DIRECT', 'ONLINE', 'PHONE', 'EMAIL', 'WALK_IN', 'AGENT', 'OTA')
      .default('DIRECT'),
    specialRequests: Joi.string().max(1000),
    depositAmount: Joi.number().min(0).precision(2),
    discountAmount: Joi.number().min(0).precision(2)
  }),

  // Payment
  createPayment: Joi.object({
    reservation: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    guest: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    amount: Joi.number().positive().precision(2).required(),
    paymentMethod: Joi.string()
      .valid('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CHEQUE', 'OTHER')
      .required(),
    paymentType: Joi.string()
      .valid('DEPOSIT', 'PARTIAL', 'FULL', 'REFUND', 'ADDITIONAL')
      .required(),
    transactionReference: Joi.string().trim().max(100),
    currency: Joi.string().length(3).uppercase().default('USD'),
    notes: Joi.string().max(1000)
  }),

  // Guest
  createGuest: Joi.object({
    fullName: Joi.string().min(2).max(100).trim().required(),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-()]+$/).required(),
    identification: Joi.object({
      type: Joi.string()
        .valid('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'OTHER')
        .required(),
      number: Joi.string().trim().max(50).required(),
      issueDate: Joi.date().iso(),
      expiryDate: Joi.date().greater('now').iso(),
      issuingCountry: Joi.string().max(50)
    }).required(),
    nationality: Joi.string().max(50),
    dateOfBirth: Joi.date().less('now').iso(),
    address: Joi.object({
      street: Joi.string().max(100),
      city: Joi.string().max(50),
      state: Joi.string().max(50),
      country: Joi.string().max(50),
      postalCode: Joi.string().max(20)
    }),
    emergencyContact: Joi.object({
      name: Joi.string().max(100),
      relationship: Joi.string().max(50),
      phone: Joi.string().max(20)
    }),
    preferences: Joi.object({
      roomType: Joi.string(),
      floor: Joi.string(),
      smoking: Joi.boolean(),
      bedType: Joi.string(),
      specialRequests: Joi.string().max(500)
    })
  }),

  // Pagination/Query params
  queryParams: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().max(100),
    fields: Joi.string().max(200),
    search: Joi.string().max(200)
  }).unknown(true) // Allow additional filter params
};

/**
 * GENERIC VALIDATION MIDDLEWARE FACTORY
 * Usage: validate('body', schemas.createRoom)
 */
const validate = (source = 'body', schema) => {
  return (req, res, next) => {
    const data = req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false,      // Collect all errors
      stripUnknown: true,     // Remove unknown fields
      convert: true,          // Type coercion
      allowUnknown: false
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
        value: detail.context?.value
      }));

      return res.status(422).json({
        status: 'fail',
        errorCode: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors,
        timestamp: new Date().toISOString()
      });
    }

    // Attach sanitized/coerced values back to request
    req[source] = value;
    next();
  };
};

/**
 * MONGODB OBJECTID VALIDATOR
 * Usage: validateObjectId('id') or validateObjectId(['id', 'userId'])
 */
const validateObjectId = (...paramNames) => {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName];

      if (!id) continue;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(
          new AppError(
            `Invalid ${paramName}: "${id}" is not a valid resource identifier.`,
            400,
            'INVALID_ID'
          )
        );
      }
    }
    next();
  };
};

/**
 * SANITIZE BODY
 * Removes dangerous characters and trims strings recursively
 */
const sanitizeBody = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    return Object.keys(obj).reduce((acc, key) => {
      const val = obj[key];
      if (typeof val === 'string') {
        // Trim and basic XSS prevention
        acc[key] = val.trim().replace(/<[^>]*>/g, '');
      } else if (typeof val === 'object') {
        acc[key] = sanitize(val);
      } else {
        acc[key] = val;
      }
      return acc;
    }, Array.isArray(obj) ? [] : {});
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  next();
};

/**
 * DATE RANGE VALIDATOR
 * Validates checkIn/checkOut are valid and in the future
 */
const validateDateRange = (req, res, next) => {
  const { checkInDate, checkOutDate } = req.body;

  if (!checkInDate || !checkOutDate) return next();

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const now = new Date();

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return next(new AppError('Invalid date format provided.', 400));
  }

  if (checkIn < now) {
    return next(new AppError('Check-in date cannot be in the past.', 400));
  }

  if (checkOut <= checkIn) {
    return next(new AppError('Check-out date must be after check-in date.', 400));
  }

  const maxStayDays = parseInt(process.env.MAX_STAY_DAYS || 365);
  const stayDays = (checkOut - checkIn) / (1000 * 60 * 60 * 24);

  if (stayDays > maxStayDays) {
    return next(
      new AppError(`Maximum stay duration is ${maxStayDays} days.`, 400)
    );
  }

  next();
};

module.exports = {
  validate,
  validateObjectId,
  sanitizeBody,
  validateDateRange,
  schemas
};