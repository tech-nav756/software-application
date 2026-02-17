const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('./errorHandler');
const { redisClient } = require('../config/redis'); // Optional Redis for token blacklisting

const verifyJWT = promisify(jwt.verify);

/**
 * Extract token from multiple possible locations
 * Priority: Authorization header > Signed Cookie
 */
const extractToken = (req) => {
  let token = null;

  // 1. Check Authorization header (Bearer token)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Check signed cookie (for browser-based apps)
  else if (req.signedCookies?.jwt) {
    token = req.signedCookies.jwt;
  }
  // 3. Check regular cookie as fallback
  else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  return token;
};

/**
 * Check if token is blacklisted (revoked)
 * Uses Redis if available, falls back to in-memory Set
 */
const tokenBlacklist = new Set(); // In-memory fallback

const isTokenBlacklisted = async (jti) => {
  try {
    if (redisClient?.isOpen) {
      const result = await redisClient.get(`blacklist:${jti}`);
      return result !== null;
    }
    return tokenBlacklist.has(jti);
  } catch {
    return tokenBlacklist.has(jti);
  }
};

const blacklistToken = async (jti, expiresIn) => {
  try {
    if (redisClient?.isOpen) {
      await redisClient.setEx(`blacklist:${jti}`, expiresIn, 'true');
    }
    tokenBlacklist.add(jti);
  } catch {
    tokenBlacklist.add(jti);
  }
};

/**
 * MAIN AUTH MIDDLEWARE
 * Verifies JWT, checks user status, handles token rotation
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token
    const token = extractToken(req);

    if (!token) {
      return next(
        new AppError('You are not logged in. Please log in to get access.', 401)
      );
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = await verifyJWT(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again.', 401));
      }
      return next(new AppError('Token verification failed. Please log in again.', 401));
    }

    // 3. Check if token is blacklisted (logged out)
    if (decoded.jti) {
      const blacklisted = await isTokenBlacklisted(decoded.jti);
      if (blacklisted) {
        return next(new AppError('Token has been revoked. Please log in again.', 401));
      }
    }

    // 4. Check if user still exists
    const currentUser = await User.findById(decoded.id)
      .select('+passwordChangedAt')
      .populate({
        path: 'role',
        select: 'name permissions isActive'
      });

    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 5. Check if user account is active
    if (currentUser.accountStatus !== 'ACTIVE') {
      return next(
        new AppError(
          `Your account is ${currentUser.accountStatus.toLowerCase()}. Please contact the administrator.`,
          403
        )
      );
    }

    // 6. Check if user's role is still active
    if (!currentUser.role?.isActive) {
      return next(
        new AppError('Your assigned role has been deactivated. Please contact the administrator.', 403)
      );
    }

    // 7. Check if password was changed after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('Password was recently changed. Please log in again.', 401)
      );
    }

    // 8. Attach user and token info to request object
    req.user = currentUser;
    req.token = { raw: token, decoded };

    // 9. Attach token refresh hint for near-expiry tokens
    const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
    const tokenTTL = decoded.exp - decoded.iat;
    if (tokenAge > tokenTTL * 0.75) {
      res.setHeader('X-Token-Refresh-Hint', 'true');
    }

    next();
  } catch (error) {
    next(new AppError('Authentication failed. Please try again.', 500));
  }
};

/**
 * OPTIONAL AUTH MIDDLEWARE
 * Continues even if no token is provided (for public routes with optional auth)
 */
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = await verifyJWT(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('role');

    if (user && user.accountStatus === 'ACTIVE') {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }

  next();
};

/**
 * SIGN TOKEN
 * Generates JWT with unique JTI for tracking/blacklisting
 */
const signToken = (userId, role) => {
  const jti = crypto.randomUUID(); // Unique token identifier

  const token = jwt.sign(
    {
      id: userId,
      role: role,
      jti
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: process.env.JWT_ISSUER || 'hotel-management-api',
      audience: process.env.JWT_AUDIENCE || 'hotel-management-client'
    }
  );

  return { token, jti };
};

/**
 * SIGN REFRESH TOKEN
 * Longer-lived token for refreshing access tokens
 */
const signRefreshToken = (userId) => {
  const jti = crypto.randomUUID();

  const refreshToken = jwt.sign(
    { id: userId, jti, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'hotel-management-api'
    }
  );

  return { refreshToken, jti };
};

/**
 * CREATE & SEND TOKEN RESPONSE
 * Handles cookie setup and response
 */
const createSendToken = async (user, statusCode, req, res, message = 'Success') => {
  const { token, jti: accessJti } = signToken(user._id, user.role);
  const { refreshToken, jti: refreshJti } = signRefreshToken(user._id);

  // Cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRES_DAYS || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,                   // Not accessible via JavaScript
    signed: true,                     // Sign the cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
    path: '/'
  };

  // Set cookies
  res.cookie('jwt', token, cookieOptions);
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    path: '/api/v1/auth/refresh' // Restrict refresh token to refresh endpoint only
  });

  // Store refresh token JTI in user record (optional, for single-session enforcement)
  await User.findByIdAndUpdate(user._id, {
    lastLogin: new Date(),
    $push: {
      refreshTokenJtis: {
        $each: [refreshJti],
        $slice: -5 // Keep only last 5 refresh tokens
      }
    }
  });

  // Audit log
  await AuditLog.logAction({
    user: user._id,
    action: 'LOGIN',
    targetEntity: 'User',
    targetId: user._id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: { loginMethod: 'credentials' },
    status: 'SUCCESS'
  });

  // Remove sensitive fields from output
  const userResponse = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    lastLogin: user.lastLogin
  };

  res.status(statusCode).json({
    status: 'success',
    message,
    data: {
      user: userResponse,
      accessToken: token,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    }
  });
};

/**
 * LOGOUT
 * Blacklists the current token and clears cookies
 */
const logout = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token && req.token?.decoded?.jti) {
      const remainingTime = req.token.decoded.exp - Math.floor(Date.now() / 1000);
      await blacklistToken(req.token.decoded.jti, Math.max(remainingTime, 0));
    }

    // Audit log
    if (req.user) {
      await AuditLog.logAction({
        user: req.user._id,
        action: 'LOGOUT',
        targetEntity: 'User',
        targetId: req.user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'SUCCESS'
      });
    }

    // Clear cookies
    res.cookie('jwt', 'logged_out', {
      expires: new Date(Date.now() + 1000),
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax'
    });

    res.cookie('refresh_token', 'logged_out', {
      expires: new Date(Date.now() + 1000),
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
      path: '/api/v1/auth/refresh'
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(new AppError('Logout failed. Please try again.', 500));
  }
};

module.exports = {
  protect,
  optionalAuth,
  signToken,
  signRefreshToken,
  createSendToken,
  blacklistToken,
  isTokenBlacklisted,
  logout
};