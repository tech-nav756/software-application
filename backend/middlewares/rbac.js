const AuditLog = require('../models/AuditLog');
const { AppError } = require('./errorHandler');

/**
 * ROLE HIERARCHY
 * Higher index = more authority
 * Used to enforce privilege escalation rules
 */
const ROLE_HIERARCHY = {
  HOUSEKEEPING: 0,
  RECEPTIONIST: 1,
  MANAGER: 2,
  ADMIN: 3
};

/**
 * PERMISSION MAP
 * Maps roles to their default permissions
 * Complements DB-stored permissions for defense-in-depth
 */
const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: [
    'manage_users',
    'manage_roles',
    'manage_rooms',
    'manage_reservations',
    'manage_payments',
    'manage_housekeeping',
    'view_reports',
    'manage_guests',
    'check_in',
    'check_out',
    'assign_tasks',
    'view_audit_logs'
  ],
  MANAGER: [
    'manage_rooms',
    'manage_reservations',
    'manage_payments',
    'manage_housekeeping',
    'view_reports',
    'manage_guests',
    'check_in',
    'check_out',
    'assign_tasks'
  ],
  RECEPTIONIST: [
    'manage_reservations',
    'manage_guests',
    'check_in',
    'check_out',
    'view_reports'
  ],
  HOUSEKEEPING: [
    'manage_housekeeping',
    'assign_tasks'
  ]
};

/**
 * RESTRICT TO ROLES
 * Gate access by role names
 * Usage: restrictTo('ADMIN', 'MANAGER')
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRoleName = req.user.role?.name;

    if (!userRoleName) {
      return next(new AppError('Your role could not be determined. Please contact the administrator.', 403));
    }

    if (!allowedRoles.includes(userRoleName)) {
      // Audit unauthorized access attempt
      AuditLog.logAction({
        user: req.user._id,
        action: 'OTHER',
        targetEntity: 'System',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          type: 'UNAUTHORIZED_ACCESS',
          requiredRoles: allowedRoles,
          userRole: userRoleName,
          endpoint: req.originalUrl,
          method: req.method
        },
        status: 'FAILURE',
        errorMessage: `Role ${userRoleName} is not authorized for this action`
      }).catch(console.error);

      return next(
        new AppError(
          `You do not have permission to perform this action. Required role(s): ${allowedRoles.join(', ')}`,
          403
        )
      );
    }

    next();
  };
};

/**
 * REQUIRE PERMISSION
 * Fine-grained permission check
 * Checks both DB-stored permissions and default role permissions
 * Usage: requirePermission('manage_payments')
 */
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRoleName = req.user.role?.name;
    const dbPermissions = req.user.role?.permissions || [];
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRoleName] || [];

    // Merge DB permissions with defaults (DB permissions can override/extend defaults)
    const allPermissions = new Set([...defaultPermissions, ...dbPermissions]);

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((perm) =>
      allPermissions.has(perm)
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (perm) => !allPermissions.has(perm)
      );

      AuditLog.logAction({
        user: req.user._id,
        action: 'OTHER',
        targetEntity: 'System',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          type: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions,
          missingPermissions,
          endpoint: req.originalUrl,
          method: req.method
        },
        status: 'FAILURE',
        errorMessage: `Missing permissions: ${missingPermissions.join(', ')}`
      }).catch(console.error);

      return next(
        new AppError(
          `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`,
          403
        )
      );
    }

    // Attach user's effective permissions to req for downstream use
    req.userPermissions = allPermissions;
    next();
  };
};

/**
 * REQUIRE ANY PERMISSION
 * User needs at least ONE of the provided permissions
 * Usage: requireAnyPermission('view_reports', 'manage_payments')
 */
const requireAnyPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRoleName = req.user.role?.name;
    const dbPermissions = req.user.role?.permissions || [];
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRoleName] || [];
    const allPermissions = new Set([...defaultPermissions, ...dbPermissions]);

    const hasAnyPermission = requiredPermissions.some((perm) =>
      allPermissions.has(perm)
    );

    if (!hasAnyPermission) {
      return next(
        new AppError(
          `You need at least one of the following permissions: ${requiredPermissions.join(', ')}`,
          403
        )
      );
    }

    req.userPermissions = allPermissions;
    next();
  };
};

/**
 * MINIMUM ROLE LEVEL
 * Check user has at least the given role's authority level
 * Usage: requireMinimumRole('MANAGER')  -- passes for MANAGER and ADMIN
 */
const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRoleName = req.user.role?.name;
    const userLevel = ROLE_HIERARCHY[userRoleName];
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    if (userLevel === undefined || requiredLevel === undefined) {
      return next(new AppError('Role level could not be determined.', 403));
    }

    if (userLevel < requiredLevel) {
      return next(
        new AppError(
          `Insufficient authority. Minimum required role: ${minimumRole}`,
          403
        )
      );
    }

    next();
  };
};

/**
 * RESOURCE OWNERSHIP CHECK
 * Ensures user can only access their own resources
 * unless they have elevated privileges
 * Usage: checkOwnership('createdBy') or checkOwnership('assignedTo', 'MANAGER')
 */
const checkOwnership = (ownerField = 'createdBy', bypassRole = 'ADMIN') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRoleName = req.user.role?.name;

    // High-privilege roles can bypass ownership check
    if (
      ROLE_HIERARCHY[userRoleName] >= ROLE_HIERARCHY[bypassRole]
    ) {
      return next();
    }

    // Attach ownership filter to req for controllers to enforce
    req.ownershipFilter = {
      [ownerField]: req.user._id
    };

    next();
  };
};

/**
 * PREVENT PRIVILEGE ESCALATION
 * Prevents users from assigning roles with higher privilege than their own
 */
const preventPrivilegeEscalation = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  const requestedRoleName = req.body.roleName || req.body.role;

  if (!requestedRoleName) return next();

  const userLevel = ROLE_HIERARCHY[req.user.role?.name];
  const requestedLevel = ROLE_HIERARCHY[requestedRoleName.toUpperCase()];

  if (requestedLevel === undefined) {
    return next(new AppError('Invalid role specified.', 400));
  }

  if (requestedLevel >= userLevel) {
    return next(
      new AppError(
        'You cannot assign a role equal to or higher than your own.',
        403
      )
    );
  }

  next();
};

/**
 * SELF-MODIFICATION GUARD
 * Prevents users from modifying their own account's critical fields
 * Usage: preventSelfModification(['role', 'accountStatus'])
 */
const preventSelfModification = (protectedFields = ['role', 'accountStatus']) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const targetUserId = req.params.id || req.params.userId;

    // Only restrict if user is trying to modify themselves
    if (targetUserId && targetUserId.toString() === req.user._id.toString()) {
      const blockedFields = protectedFields.filter((field) =>
        req.body.hasOwnProperty(field)
      );

      if (blockedFields.length > 0) {
        return next(
          new AppError(
            `You cannot modify your own ${blockedFields.join(', ')}.`,
            403
          )
        );
      }
    }

    next();
  };
};

/**
 * Expose user permissions in response headers (useful for frontend)
 */
const exposePermissions = (req, res, next) => {
  if (req.user) {
    const userRoleName = req.user.role?.name;
    const permissions = DEFAULT_ROLE_PERMISSIONS[userRoleName] || [];
    res.setHeader('X-User-Role', userRoleName || '');
    res.setHeader('X-User-Permissions', permissions.join(','));
  }
  next();
};

module.exports = {
  restrictTo,
  requirePermission,
  requireAnyPermission,
  requireMinimumRole,
  checkOwnership,
  preventPrivilegeEscalation,
  preventSelfModification,
  exposePermissions,
  ROLE_HIERARCHY,
  DEFAULT_ROLE_PERMISSIONS
};