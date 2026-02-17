const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Guest full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    alternatePhone: {
      type: String,
      trim: true
    },
    identification: {
      type: {
        type: String,
        enum: ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'OTHER'],
        required: [true, 'Identification type is required']
      },
      number: {
        type: String,
        required: [true, 'Identification number is required'],
        trim: true
      },
      issueDate: {
        type: Date
      },
      expiryDate: {
        type: Date
      },
      issuingCountry: {
        type: String,
        trim: true
      }
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          return value < new Date();
        },
        message: 'Date of birth must be in the past'
      }
    },
    nationality: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String
    },
    preferences: {
      roomType: String,
      floor: String,
      smoking: Boolean,
      bedType: String,
      specialRequests: String
    },
    vipStatus: {
      type: Boolean,
      default: false
    },
    blacklisted: {
      type: Boolean,
      default: false
    },
    blacklistReason: {
      type: String,
      maxlength: [500, 'Blacklist reason cannot exceed 500 characters']
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    totalStays: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
guestSchema.index({ email: 1 });
guestSchema.index({ phone: 1 });
guestSchema.index({ 'identification.number': 1 });
guestSchema.index({ fullName: 'text' }); // Text index for search
guestSchema.index({ vipStatus: 1 });
guestSchema.index({ blacklisted: 1 });
guestSchema.index({ createdAt: -1 });

// Virtual for reservations
guestSchema.virtual('reservations', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'guest'
});

// Compound index for identification
guestSchema.index({ 'identification.type': 1, 'identification.number': 1 });

module.exports = mongoose.model('Guest', guestSchema);