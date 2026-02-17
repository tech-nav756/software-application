const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
      required: true,
      uppercase: true
    },
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: [true, 'Reservation reference is required']
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest reference is required']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    paymentMethod: {
      type: String,
      enum: {
        values: [
          'CASH',
          'CREDIT_CARD',
          'DEBIT_CARD',
          'BANK_TRANSFER',
          'MOBILE_PAYMENT',
          'CHEQUE',
          'OTHER'
        ],
        message: '{VALUE} is not a valid payment method'
      },
      required: [true, 'Payment method is required']
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
        message: '{VALUE} is not a valid payment status'
      },
      default: 'PENDING'
    },
    transactionReference: {
      type: String,
      trim: true,
      sparse: true
    },
    transactionDate: {
      type: Date,
      default: Date.now
    },
    cardDetails: {
      lastFourDigits: {
        type: String,
        match: [/^\d{4}$/, 'Last four digits must be exactly 4 digits']
      },
      cardType: {
        type: String,
        enum: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER']
      },
      cardHolderName: String
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Processed by user reference is required']
    },
    paymentType: {
      type: String,
      enum: ['DEPOSIT', 'PARTIAL', 'FULL', 'REFUND', 'ADDITIONAL'],
      required: true
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    refundReason: {
      type: String,
      maxlength: [500, 'Refund reason cannot exceed 500 characters']
    },
    refundedAt: {
      type: Date
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receiptNumber: {
      type: String,
      sparse: true
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      length: 3
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate unique payment number before saving
paymentSchema.pre('save', async function (next) {
  if (!this.isNew || this.paymentNumber) return next();

  try {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.paymentNumber = `PAY${year}${month}${day}${sequence}`;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Indexes for performance
paymentSchema.index({ paymentNumber: 1 }, { unique: true });
paymentSchema.index({ reservation: 1, createdAt: -1 });
paymentSchema.index({ guest: 1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ transactionDate: -1 });
paymentSchema.index({ processedBy: 1 });
paymentSchema.index({ transactionReference: 1 }, { sparse: true });

// Compound index for reporting
paymentSchema.index({ paymentStatus: 1, transactionDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);