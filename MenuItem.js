const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Menu item name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch reference is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Salads', 'Soups', 'Breads', 'Combo Meals', 'Specials', 'Kids Menu']
  },
  subcategory: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  ingredients: [{
    name: String,
    allergen: { type: Boolean, default: false },
    allergenType: {
      type: String,
      enum: ['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'Seafood', 'Sesame']
    }
  }],
  nutritionalInfo: {
    calories: Number,
    protein: Number, // in grams
    carbs: Number,   // in grams
    fat: Number,     // in grams
    fiber: Number,   // in grams
    sugar: Number,   // in grams
    sodium: Number   // in mg
  },
  dietaryInfo: {
    vegetarian: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    glutenFree: { type: Boolean, default: false },
    dairyFree: { type: Boolean, default: false },
    nutFree: { type: Boolean, default: false },
    spicy: { type: Boolean, default: false },
    halal: { type: Boolean, default: false },
    keto: { type: Boolean, default: false },
    lowCalorie: { type: Boolean, default: false }
  },
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  popularity: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [300, 'Review comment cannot exceed 300 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  customizations: [{
    name: String,
    options: [{
      name: String,
      price: { type: Number, default: 0 }
    }],
    required: { type: Boolean, default: false },
    maxSelections: { type: Number, default: 1 }
  }],
  comboItems: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    quantity: {
      type: Number,
      default: 1
    }
  }],
  tags: [String],
  chefRecommendation: {
    type: Boolean,
    default: false
  },
  bestSeller: {
    type: Boolean,
    default: false
  },
  seasonal: {
    type: Boolean,
    default: false
  },
  availabilitySchedule: {
    days: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    timeSlots: [{
      start: String, // HH:MM format
      end: String    // HH:MM format
    }]
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
menuItemSchema.index({ branch: 1, category: 1, isAvailable: 1, isActive: 1 });
menuItemSchema.index({ branch: 1, isAvailable: 1, popularity: -1 });
menuItemSchema.index({ branch: 1, tags: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

// Virtual for discount percentage
menuItemSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for is on sale
menuItemSchema.virtual('isOnSale').get(function() {
  return this.originalPrice && this.originalPrice > this.price;
});

// Method to update rating
menuItemSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = Math.round((totalRating / this.reviews.length) * 10) / 10;
    this.rating.count = this.reviews.length;
  }
  
  return this.save();
};

// Method to add review
menuItemSchema.methods.addReview = function(userId, rating, comment) {
  // Remove existing review by same user
  this.reviews = this.reviews.filter(review => 
    review.user.toString() !== userId.toString()
  );
  
  // Add new review
  this.reviews.push({
    user: userId,
    rating,
    comment,
    createdAt: new Date()
  });
  
  // Update rating
  return this.updateRating();
};

// Method to check availability for specific time
menuItemSchema.methods.isAvailableAt = function(dateTime) {
  if (!this.isAvailable || !this.isActive) {
    return false;
  }
  
  // Check if item is available on this day
  const dayName = dateTime.toLocaleDateString('en-US', { weekday: 'long' });
  if (this.availabilitySchedule.days.length > 0 && 
      !this.availabilitySchedule.days.includes(dayName)) {
    return false;
  }
  
  // Check if item is available at this time
  if (this.availabilitySchedule.timeSlots.length > 0) {
    const currentTime = dateTime.toTimeString().slice(0, 5);
    return this.availabilitySchedule.timeSlots.some(slot => 
      currentTime >= slot.start && currentTime <= slot.end
    );
  }
  
  return true;
};

// Static method to search menu items
menuItemSchema.statics.searchMenuItems = function(branchId, searchTerm, filters = {}) {
  const query = {
    branch: branchId,
    isAvailable: true,
    isActive: true
  };
  
  // Add filters
  if (filters.category) {
    query.category = filters.category;
  }
  
  if (filters.dietary) {
    const dietaryQuery = {};
    filters.dietary.forEach(diet => {
      dietaryQuery[`dietaryInfo.${diet}`] = true;
    });
    Object.assign(query, dietaryQuery);
  }
  
  if (filters.priceRange) {
    query.price = {
      $gte: filters.priceRange.min || 0,
      $lte: filters.priceRange.max || Infinity
    };
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }
  
  // Text search
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }
  
  return this.find(query)
    .populate('branch', 'name location')
    .sort({ popularity: -1, rating: -1 });
};

// Static method to get popular items
menuItemSchema.statics.getPopularItems = function(branchId, limit = 10) {
  return this.find({
    branch: branchId,
    isAvailable: true,
    isActive: true
  })
  .sort({ popularity: -1, rating: -1 })
  .limit(limit)
  .populate('branch', 'name location');
};

// Static method to get chef recommendations
menuItemSchema.statics.getChefRecommendations = function(branchId, limit = 5) {
  return this.find({
    branch: branchId,
    isAvailable: true,
    isActive: true,
    chefRecommendation: true
  })
  .sort({ rating: -1 })
  .limit(limit)
  .populate('branch', 'name location');
};

module.exports = mongoose.model('MenuItem', menuItemSchema);
