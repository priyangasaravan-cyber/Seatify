const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Offer title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Offer description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  type: {
    type: String,
    required: [true, 'Offer type is required'],
    enum: ['percentage', 'fixed', 'buy_one_get_one', 'combo', 'loyalty', 'seasonal', 'happy_hour']
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Max discount amount cannot be negative']
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum order amount cannot be negative']
  },
  applicableItems: [{
    type: {
      type: String,
      enum: ['all', 'category', 'item', 'combo'],
      required: true
    },
    value: mongoose.Schema.Types.Mixed // category name, item ID, or combo ID
  }],
  validity: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    startTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format']
    },
    endTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format']
    },
    days: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }]
  },
  usage: {
    maxUses: {
      type: Number,
      default: null // null means unlimited
    },
    usedCount: {
      type: Number,
      default: 0
    },
    maxUsesPerUser: {
      type: Number,
      default: 1
    },
    userUsage: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      count: {
        type: Number,
        default: 0
      },
      lastUsed: Date
    }]
  },
  conditions: {
    newUserOnly: { type: Boolean, default: false },
    minPartySize: { type: Number, default: 1 },
    maxPartySize: { type: Number, default: 20 },
    membershipTier: [{
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
    }],
    paymentMethod: [{
      type: String,
      enum: ['razorpay', 'stripe', 'paypal', 'cash', 'card', 'upi', 'netbanking', 'wallet']
    }]
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  terms: {
    type: String,
    maxlength: [1000, 'Terms cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  analytics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
offerSchema.index({ branch: 1, isActive: 1, 'validity.startDate': 1, 'validity.endDate': 1 });
offerSchema.index({ code: 1 });
offerSchema.index({ type: 1, isActive: 1 });
offerSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });

// Virtual for is currently valid
offerSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check date range
  if (now < this.validity.startDate || now > this.validity.endDate) {
    return false;
  }
  
  // Check time range
  if (this.validity.startTime && this.validity.endTime) {
    if (currentTime < this.validity.startTime || currentTime > this.validity.endTime) {
      return false;
    }
  }
  
  // Check days
  if (this.validity.days.length > 0 && !this.validity.days.includes(currentDay)) {
    return false;
  }
  
  // Check usage limits
  if (this.usage.maxUses && this.usage.usedCount >= this.usage.maxUses) {
    return false;
  }
  
  return this.isActive;
});

// Method to check if user can use this offer
offerSchema.methods.canUserUseOffer = function(userId, orderAmount = 0, partySize = 1) {
  // Check if offer is currently valid
  if (!this.isCurrentlyValid) {
    return { canUse: false, reason: 'Offer is not currently valid' };
  }
  
  // Check minimum order amount
  if (orderAmount < this.minOrderAmount) {
    return { 
      canUse: false, 
      reason: `Minimum order amount of ₹${this.minOrderAmount} required` 
    };
  }
  
  // Check party size
  if (partySize < this.conditions.minPartySize || partySize > this.conditions.maxPartySize) {
    return { 
      canUse: false, 
      reason: `Party size must be between ${this.conditions.minPartySize} and ${this.conditions.maxPartySize}` 
    };
  }
  
  // Check user usage limit
  const userUsage = this.usage.userUsage.find(usage => 
    usage.user.toString() === userId.toString()
  );
  
  if (userUsage && userUsage.count >= this.usage.maxUsesPerUser) {
    return { 
      canUse: false, 
      reason: 'Maximum usage limit reached for this offer' 
    };
  }
  
  return { canUse: true };
};

// Method to calculate discount
offerSchema.methods.calculateDiscount = function(orderAmount, applicableItems = []) {
  let discount = 0;
  
  switch (this.type) {
    case 'percentage':
      discount = (orderAmount * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;
      
    case 'fixed':
      discount = this.discountValue;
      break;
      
    case 'buy_one_get_one':
      // This would need specific item logic
      discount = 0;
      break;
      
    case 'combo':
      // This would need combo-specific logic
      discount = this.discountValue;
      break;
      
    default:
      discount = 0;
  }
  
  return Math.min(discount, orderAmount);
};

// Method to use offer
offerSchema.methods.useOffer = function(userId, orderAmount) {
  // Check if user can use the offer
  const canUse = this.canUserUseOffer(userId, orderAmount);
  if (!canUse.canUse) {
    throw new Error(canUse.reason);
  }
  
  // Update usage count
  this.usage.usedCount += 1;
  
  // Update user usage
  let userUsage = this.usage.userUsage.find(usage => 
    usage.user.toString() === userId.toString()
  );
  
  if (userUsage) {
    userUsage.count += 1;
    userUsage.lastUsed = new Date();
  } else {
    this.usage.userUsage.push({
      user: userId,
      count: 1,
      lastUsed: new Date()
    });
  }
  
  // Update analytics
  this.analytics.conversions += 1;
  this.analytics.revenue += orderAmount;
  
  return this.save();
};

// Static method to find applicable offers
offerSchema.statics.findApplicableOffers = function(branchId, userId, orderAmount, partySize, items = []) {
  const now = new Date();
  
  return this.find({
    branch: branchId,
    isActive: true,
    'validity.startDate': { $lte: now },
    'validity.endDate': { $gte: now },
    $or: [
      { 'usage.maxUses': null },
      { 'usage.usedCount': { $lt: '$usage.maxUses' } }
    ]
  })
  .sort({ priority: -1, 'analytics.conversions': -1 })
  .populate('branch', 'name location');
};

// Static method to get offer statistics
offerSchema.statics.getOfferStats = function(branchId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        branch: mongoose.Types.ObjectId(branchId),
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalUses: { $sum: '$usage.usedCount' },
        totalRevenue: { $sum: '$analytics.revenue' },
        averageConversion: { $avg: '$analytics.conversions' }
      }
    }
  ]);
};

module.exports = mongoose.model('Offer', offerSchema);
