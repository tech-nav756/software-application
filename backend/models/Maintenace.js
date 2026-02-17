const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
      uppercase: true
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required']
    },
    taskType: {
      type: String,
      enum: {
        values: [
          'HOUSEKEEPING',
          'REPAIR',
          'INSPECTION',
          'CLEANING',
          'PREVENTIVE_MAINTENANCE',
          'EMERGENCY',
          'RENOVATION',
          'OTHER'
        ],
        message: '{VALUE} is not a valid task type'
      },
      required: [true, 'Task type is required']
    },
    priority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
        message: '{VALUE} is not a valid status'
      },
      default: 'PENDING'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reported by user reference is required']
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    scheduledDate: {
      type: Date
    },
    scheduledTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    estimatedDuration: {
      value: Number,
      unit: {
        type: String,
        enum: ['MINUTES', 'HOURS', 'DAYS'],
        default: 'HOURS'
      }
    },
    actualDuration: {
      value: Number,
      unit: {
        type: String,
        enum: ['MINUTES', 'HOURS', 'DAYS'],
        default: 'HOURS'
      }
    },
    materialsUsed: [
      {
        name: String,
        quantity: Number,
        cost: Number
      }
    ],
    totalCost: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    completionNotes: {
      type: String,
      maxlength: [1000, 'Completion notes cannot exceed 1000 characters']
    },
    images: [
      {
        url: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    recurring: {
      type: Boolean,
      default: false
    },
    recurringSchedule: {
      frequency: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
      },
      nextScheduledDate: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate unique ticket number before saving
maintenanceSchema.pre('save', async function (next) {
  if (!this.isNew || this.ticketNumber) return next();

  try {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 0)
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    const prefix = this.taskType === 'HOUSEKEEPING' ? 'HK' : 'MNT';
    this.ticketNumber = `${prefix}${year}${month}${sequence}`;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Validation for completion
maintenanceSchema.pre('save', function (next) {
  if (this.status === 'COMPLETED' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  if (this.status === 'IN_PROGRESS' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  next();
});

// Indexes for performance
maintenanceSchema.index({ ticketNumber: 1 }, { unique: true });
maintenanceSchema.index({ room: 1, status: 1 });
maintenanceSchema.index({ assignedTo: 1, status: 1 });
maintenanceSchema.index({ status: 1, priority: 1 });
maintenanceSchema.index({ taskType: 1 });
maintenanceSchema.index({ scheduledDate: 1 });
maintenanceSchema.index({ reportedBy: 1 });
maintenanceSchema.index({ createdAt: -1 });

// Compound index for task management
maintenanceSchema.index({ status: 1, priority: -1, scheduledDate: 1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema);