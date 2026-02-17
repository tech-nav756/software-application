const mongoose = require('mongoose');

const occupancySchema = new mongoose.Schema(
  {
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: [true, 'Reservation reference is required'],
      unique: true
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required']
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required']
    },
    actualCheckInTime: {
      type: Date,
      required: [true, 'Actual check-in time is required']
    },
    actualCheckOutTime: {
      type: Date
    },
    plannedCheckInDate: {
      type: Date,
      required: true
    },
    plannedCheckOutDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: {
        values: ['CHECKED_IN', 'CHECKED_OUT', 'EXTENDED'],
        message: '{VALUE} is not a valid occupancy status'
      },
      default: 'CHECKED_IN'
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Check-in staff reference is required']
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    numberOfGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'Must have at least 1 guest']
    },
    accompaniedGuests: [
      {
        name: {
          type: String,
          trim: true
        },
        age: Number,
        relationship: String
      }
    ],
    earlyCheckIn: {
      type: Boolean,
      default: false
    },
    lateCheckOut: {
      type: Boolean,
      default: false
    },
    earlyCheckInCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    lateCheckOutCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    keyCardNumbers: [
      {
        type: String,
        trim: true
      }
    ],
    keyCardsReturned: {
      type: Boolean,
      default: false
    },
    damagesReported: {
      type: Boolean,
      default: false
    },
    damageDetails: {
      type: String,
      maxlength: [1000, 'Damage details cannot exceed 1000 characters']
    },
    damageCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    feedbackProvided: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
occupancySchema.index({ reservation: 1 }, { unique: true });
occupancySchema.index({ room: 1, status: 1 });
occupancySchema.index({ guest: 1 });
occupancySchema.index({ actualCheckInTime: 1 });
occupancySchema.index({ actualCheckOutTime: 1 });
occupancySchema.index({ status: 1 });
occupancySchema.index({ checkedInBy: 1 });

// Validation
occupancySchema.pre('save', function (next) {
  if (this.actualCheckOutTime && this.actualCheckOutTime <= this.actualCheckInTime) {
    return next(new Error('Check-out time must be after check-in time'));
  }
  next();
});

// Virtual for stay duration in hours
occupancySchema.virtual('stayDurationHours').get(function () {
  if (!this.actualCheckOutTime) return null;
  
  const duration = this.actualCheckOutTime - this.actualCheckInTime;
  return Math.round(duration / (1000 * 60 * 60));
});

module.exports = mongoose.model('Occupancy', occupancySchema);