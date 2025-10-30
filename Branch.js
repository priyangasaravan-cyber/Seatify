const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Branch name is required'],
    trim: true,
    maxlength: [100, 'Branch name cannot exceed 100 characters']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      match: [/^\d{6}$/, 'Please enter a valid 6-digit pincode']
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: String
  },
  operatingHours: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } }
  },
  amenities: [{
    name: String,
    icon: String,
    description: String
  }],
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  capacity: {
    totalSeats: { type: Number, required: true },
    maxPartySize: { type: Number, default: 20 }
  },
  features: [{
    type: String,
    enum: ['WiFi', 'Parking', 'Valet', 'Wheelchair Accessible', 'Live Music', 'Outdoor Seating', 'Private Dining', 'Bar', 'Kids Play Area'],
    required: true
  }],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  settings: {
    advanceBookingDays: { type: Number, default: 30 },
    minBookingTime: { type: Number, default: 2 }, // hours
    maxBookingTime: { type: Number, default: 4 }, // hours
    cancellationPolicy: {
      freeCancellationHours: { type: Number, default: 24 },
      cancellationFee: { type: Number, default: 0 }
    }
  }
}, {
  timestamps: true
});

// Virtual for full address
branchSchema.virtual('fullAddress').get(function() {
  return `${this.location.address}, ${this.location.city}, ${this.location.state} - ${this.location.pincode}`;
});

// Method to check if branch is open at given time
branchSchema.methods.isOpenAt = function(dateTime) {
  const day = dateTime.toLocaleLowerCase();
  const daySchedule = this.operatingHours[day];
  
  if (!daySchedule || !daySchedule.isOpen) return false;
  
  const currentTime = dateTime.toTimeString().slice(0, 5);
  return currentTime >= daySchedule.open && currentTime <= daySchedule.close;
};

// Method to get available time slots
branchSchema.methods.getAvailableTimeSlots = function(date) {
  const day = date.toLocaleLowerCase();
  const daySchedule = this.operatingHours[day];
  
  if (!daySchedule || !daySchedule.isOpen) return [];
  
  const slots = [];
  const openTime = daySchedule.open;
  const closeTime = daySchedule.close;
  
  // Generate 30-minute slots
  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);
  
  let currentHour = openHour;
  let currentMin = openMin;
  
  while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
    const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    slots.push(timeString);
    
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }
  
  return slots;
};

module.exports = mongoose.model('Branch', branchSchema);
