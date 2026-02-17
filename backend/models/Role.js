const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
      uppercase: true,
      enum: {
        values: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'],
        message: '{VALUE} is not a valid role'
      }
    },
    permissions: [
      {
        type: String,
        trim: true,
        enum: {
          values: [
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
          message: '{VALUE} is not a valid permission'
        }
      }
    ],
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for fast role lookups
roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });

// Virtual to get users with this role
roleSchema.virtual('users', {
  ref: 'User',
  localField: '_id',
  foreignField: 'role'
});

module.exports = mongoose.model('Role', roleSchema);