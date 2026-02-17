const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room type name is required'],
      unique: true,
      trim: true,
      uppercase: true,
      enum: {
        values: ['SINGLE', 'DOUBLE', 'DELUXE', 'SUITE', 'PRESIDENTIAL', 'TWIN', 'FAMILY'],
        message: '{VALUE} is not a valid room type'
      }
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Price cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    maxOccupancy: {
      type: Number,
      required: [true, 'Maximum occupancy is required'],
      min: [1, 'Occupancy must be at least 1']
    },
    bedType: {
      type: String,
      enum: ['SINGLE', 'DOUBLE', 'QUEEN', 'KING', 'TWIN'],
      required: true
    },
    numberOfBeds: {
      type: Number,
      required: true,
      min: [1, 'Number of beds must be at least 1']
    },
    size: {
      value: {
        type: Number,
        min: [0, 'Size cannot be negative']
      },
      unit: {
        type: String,
        enum: ['SQM', 'SQFT'],
        default: 'SQM'
      }
    },
    amenities: [
      {
        type: String,
        trim: true
      }
    ],
    images: [
      {
        type: String,
        trim: true
      }
    ],
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

// Indexes
roomTypeSchema.index({ name: 1 }, { unique: true });
roomTypeSchema.index({ isActive: 1 });
roomTypeSchema.index({ basePrice: 1 });

// Virtual to get all rooms of this type
roomTypeSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'roomType'
});

module.exports = mongoose.model('RoomType', roomTypeSchema);