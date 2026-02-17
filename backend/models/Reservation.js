const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    reservationNumber: {
      type: String,
      unique: true,
      required: true,
      uppercase: true
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required']
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required']
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required']
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required']
    },
    numberOfGuests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'Must have at least 1 guest']
    },
    numberOfNights: {
      type: Number,
      min: [1, 'Must be at least 1 night']
    },
    status: {
      type: String,
      enum: {
        values: [
          'PENDING',
          'CONFIRMED',
          'CHECKED_IN',
          'CHECKED_OUT',
          'CANCELLED',
          'NO_SHOW',
          'COMPLETED'
        ],
        message: '{VALUE} is not a valid reservation status'
      },
      default: 'PENDING'
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative']
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },
    balanceAmount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user reference is required']
    },
    bookingSource: {
      type: String,
      enum: ['DIRECT', 'ONLINE', 'PHONE', 'EMAIL', 'WALK_IN', 'AGENT', 'OTA'],
      default: 'DIRECT'
    },
    specialRequests: {
      type: String,
      maxlength: [1000, 'Special requests cannot exceed 1000 characters']
    },
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, 'Deposit cannot be negative']
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative']
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save validation
reservationSchema.pre('save', function (next) {
  // Validate check-out date is after check-in date
  if (this.checkOutDate <= this.checkInDate) {
    return next(new Error('Check-out date must be after check-in date'));
  }

  // Calculate number of nights
  const oneDay = 24 * 60 * 60 * 1000;
  this.numberOfNights = Math.round(
    Math.abs((this.checkOutDate - this.checkInDate) / oneDay)
  );

  // Calculate balance
  this.balanceAmount = this.totalAmount - this.paidAmount;

  next();
});

// Generate unique reservation number before saving
reservationSchema.pre('save', async function (next) {
  if (!this.isNew || this.reservationNumber) return next();

  try {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Find the count of reservations today
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.reservationNumber = `RES${year}${month}${day}${sequence}`;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Compound indexes for performance
reservationSchema.index({ reservationNumber: 1 }, { unique: true });
reservationSchema.index({ guest: 1, createdAt: -1 });
reservationSchema.index({ room: 1, checkInDate: 1, checkOutDate: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ checkInDate: 1, checkOutDate: 1 });
reservationSchema.index({ createdBy: 1 });
reservationSchema.index({ bookingSource: 1 });

// Compound index for availability checking
reservationSchema.index(
  { room: 1, status: 1, checkInDate: 1, checkOutDate: 1 },
  { name: 'availability_check_index' }
);

// Virtual for payments
reservationSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'reservation'
});

// Virtual for occupancy/stay
reservationSchema.virtual('occupancy', {
  ref: 'Occupancy',
  localField: '_id',
  foreignField: 'reservation',
  justOne: true
});

module.exports = mongoose.model('Reservation', reservationSchema);