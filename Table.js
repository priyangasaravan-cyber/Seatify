const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: [true, 'Table number is required'],
    trim: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  seats: {
    type: Number,
    required: [true, 'Number of seats is required'],
    min: [1, 'Table must have at least 1 seat'],
    max: [20, 'Table cannot have more than 20 seats']
  },
  themeType: {
    type: String,
    required: [true, 'Theme type is required'],
    enum: ['Premium', 'Gen Z', 'Royal', 'Family', 'Friends', 'Business', 'Romantic', 'Casual'],
    default: 'Casual'
  },
  priceMultiplier: {
    type: Number,
    default: 1.0,
    min: [0.5, 'Price multiplier cannot be less than 0.5'],
    max: [3.0, 'Price multiplier cannot exceed 3.0']
  },
  location: {
    floor: {
      type: String,
      required: [true, 'Floor is required'],
      enum: ['Ground', 'First', 'Second', 'Third', 'Rooftop', 'Basement']
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }
  },
  amenities: [{
    name: String,
    icon: String,
    description: String
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  specialFeatures: [{
    type: String,
    enum: ['Window View', 'Garden View', 'Private', 'Near Stage', 'Quiet Corner', 'High Top', 'Booth', 'Outdoor']
  }],
  minimumOrder: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  bookingRules: {
    advanceBookingDays: { type: Number, default: 30 },
    minBookingDuration: { type: Number, default: 1 }, // hours
    maxBookingDuration: { type: Number, default: 4 }, // hours
    requiresDeposit: { type: Boolean, default: false },
    depositAmount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index for efficient queries
tableSchema.index({ branch: 1, isAvailable: 1, themeType: 1 });
tableSchema.index({ branch: 1, seats: 1, isAvailable: 1 });

// Virtual for table capacity range
tableSchema.virtual('capacityRange').get(function() {
  if (this.seats === 1) return '1 person';
  if (this.seats <= 4) return `${this.seats} people`;
  return `${this.seats} people`;
});

// Method to check availability for specific time slot
tableSchema.methods.isAvailableForSlot = async function(startTime, endTime, excludeBookingId = null) {
  const Booking = mongoose.model('Booking');
  
  const conflictingBookings = await Booking.find({
    table: this._id,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  }).select('_id');
  
  // Exclude specific booking (useful for updates)
  if (excludeBookingId) {
    return conflictingBookings.length === 0 || 
           (conflictingBookings.length === 1 && conflictingBookings[0]._id.toString() === excludeBookingId.toString());
  }
  
  return conflictingBookings.length === 0;
};

// Method to get table theme details
tableSchema.methods.getThemeDetails = function() {
  const themeDetails = {
    Premium: {
      color: '#8B4513',
      description: 'Elegant and sophisticated dining experience',
      features: ['Premium seating', 'Exclusive service', 'Fine dining atmosphere']
    },
    'Gen Z': {
      color: '#FF6B6B',
      description: 'Vibrant and trendy space for young diners',
      features: ['Instagram-worthy decor', 'Social media friendly', 'Modern vibes']
    },
    Royal: {
      color: '#DAA520',
      description: 'Luxurious royal dining experience',
      features: ['Regal ambiance', 'Premium service', 'Exclusive atmosphere']
    },
    Family: {
      color: '#4ECDC4',
      description: 'Comfortable space perfect for family gatherings',
      features: ['Kid-friendly', 'Spacious seating', 'Family-oriented']
    },
    Friends: {
      color: '#45B7D1',
      description: 'Casual and fun space for friends to hang out',
      features: ['Group-friendly', 'Social atmosphere', 'Relaxed vibes']
    },
    Business: {
      color: '#96CEB4',
      description: 'Professional setting for business meetings',
      features: ['Quiet environment', 'Professional service', 'Meeting-friendly']
    },
    Romantic: {
      color: '#F8BBD9',
      description: 'Intimate and romantic dining space',
      features: ['Intimate lighting', 'Couple-friendly', 'Romantic ambiance']
    },
    Casual: {
      color: '#A8E6CF',
      description: 'Relaxed and comfortable dining experience',
      features: ['Comfortable seating', 'Relaxed atmosphere', 'All-purpose']
    }
  };
  
  return themeDetails[this.themeType] || themeDetails.Casual;
};

// Static method to find available tables
tableSchema.statics.findAvailableTables = async function(branchId, startTime, endTime, minSeats = 1, maxSeats = 20, themeType = null) {
  const query = {
    branch: branchId,
    isAvailable: true,
    isActive: true,
    seats: { $gte: minSeats, $lte: maxSeats }
  };
  
  if (themeType) {
    query.themeType = themeType;
  }
  
  const tables = await this.find(query).populate('branch', 'name location');
  
  const availableTables = [];
  
  for (const table of tables) {
    const isAvailable = await table.isAvailableForSlot(startTime, endTime);
    if (isAvailable) {
      availableTables.push(table);
    }
  }
  
  return availableTables;
};

module.exports = mongoose.model('Table', tableSchema);
