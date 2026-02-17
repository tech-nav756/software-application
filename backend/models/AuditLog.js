const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: {
        values: [
          'CREATE',
          'READ',
          'UPDATE',
          'DELETE',
          'LOGIN',
          'LOGOUT',
          'LOGIN_FAILED',
          'PASSWORD_CHANGE',
          'PASSWORD_RESET',
          'PERMISSION_CHANGE',
          'STATUS_CHANGE',
          'CHECK_IN',
          'CHECK_OUT',
          'PAYMENT_RECEIVED',
          'PAYMENT_REFUND',
          'RESERVATION_CREATED',
          'RESERVATION_MODIFIED',
          'RESERVATION_CANCELLED',
          'ROOM_STATUS_CHANGE',
          'TASK_ASSIGNED',
          'TASK_COMPLETED',
          'EXPORT_DATA',
          'IMPORT_DATA',
          'OTHER'
        ],
        message: '{VALUE} is not a valid action'
      }
    },
    targetEntity: {
      type: String,
      required: [true, 'Target entity is required'],
      enum: {
        values: [
          'User',
          'Role',
          'Guest',
          'Room',
          'RoomType',
          'Reservation',
          'Occupancy',
          'Payment',
          'Maintenance',
          'AuditLog',
          'System'
        ],
        message: '{VALUE} is not a valid entity'
      }
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId
    },
    ipAddress: {
      type: String,
      match: [
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i,
        'Invalid IP address'
      ]
    },
    userAgent: {
      type: String,
      maxlength: [500, 'User agent cannot exceed 500 characters']
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
      default: 'SUCCESS'
    },
    errorMessage: {
      type: String,
      maxlength: [1000, 'Error message cannot exceed 1000 characters']
    },
    sessionId: {
      type: String
    },
    endpoint: {
      type: String
    },
    httpMethod: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    responseTime: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance and querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetEntity: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ ipAddress: 1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ sessionId: 1 });

// Compound indexes for common queries
auditLogSchema.index({ user: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ targetEntity: 1, action: 1, createdAt: -1 });

// TTL index to automatically delete old logs after 2 years (optional)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Prevent modification of audit logs
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs cannot be modified'));
  }
  next();
});

// Static method to log actions
auditLogSchema.statics.logAction = async function (logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent disrupting main operations
    return null;
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);