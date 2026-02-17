const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    roomType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Room type is required']
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
      min: [0, 'Floor number cannot be negative']
    },
    capacity: {
      type: Number,
      required: [true, 'Room capacity is required'],
      min: [1, 'Capacity must be at least 1']
    },
    status: {
      type: String,
      enum: {
        values: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'OUT_OF_SERVICE'],
        message: '{VALUE} is not a valid room status'
      },
      default: 'AVAILABLE'
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price cannot be negative']
    },
    amenities: [
      {
        type: String,
        trim: true
      }
    ],
    viewType: {
      type: String,
      enum: ['CITY', 'SEA', 'GARDEN', 'POOL', 'MOUNTAIN', 'NONE'],
      default: 'NONE'
    },
    smokingAllowed: {
      type: Boolean,
      default: false
    },
    petFriendly: {
      type: Boolean,
      default: false
    },
    accessibility: {
      wheelchairAccessible: {
        type: Boolean,
        default: false
      },
      features: [String]
    },
    lastCleaned: {
      type: Date
    },
    lastMaintenance: {
      type: Date
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
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

// Compound indexes for performance
roomSchema.index({ roomNumber: 1 }, { unique: true });
roomSchema.index({ status: 1, isActive: 1 });
roomSchema.index({ roomType: 1, status: 1 });
roomSchema.index({ floor: 1, roomNumber: 1 });
roomSchema.index({ pricePerNight: 1 });

// Virtual for current reservation
roomSchema.virtual('currentReservation', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'room',
  justOne: true,
  match: { status: { $in: ['CONFIRMED', 'CHECKED_IN'] } }
});

// Virtual for maintenance tasks
roomSchema.virtual('maintenanceTasks', {
  ref: 'Maintenance',
  localField: '_id',
  foreignField: 'room'
});

module.exports = mongoose.model('Room', roomSchema);