const express = require('express');
const { body, validationResult } = require('express-validator');
const MenuItem = require('../models/MenuItem');
const Branch = require('../models/Branch');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/menu
// @desc    Get menu items with filters
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      branch, 
      category, 
      search, 
      dietary, 
      priceMin, 
      priceMax, 
      tags,
      popular,
      chefRecommendation,
      bestSeller,
      limit = 20, 
      page = 1 
    } = req.query;
    
    // Build query
    const query = { isAvailable: true, isActive: true };
    
    if (branch) {
      query.branch = branch;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (dietary) {
      const dietaryArray = dietary.split(',');
      const dietaryQuery = {};
      dietaryArray.forEach(diet => {
        dietaryQuery[`dietaryInfo.${diet}`] = true;
      });
      Object.assign(query, dietaryQuery);
    }
    
    if (priceMin || priceMax) {
      query.price = {};
      if (priceMin) query.price.$gte = parseFloat(priceMin);
      if (priceMax) query.price.$lte = parseFloat(priceMax);
    }
    
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }
    
    if (popular === 'true') {
      query.popularity = { $gt: 0 };
    }
    
    if (chefRecommendation === 'true') {
      query.chefRecommendation = true;
    }
    
    if (bestSeller === 'true') {
      query.bestSeller = true;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sortBy = { popularity: -1, rating: -1 };
    if (search) {
      sortBy = { score: { $meta: 'textScore' }, popularity: -1 };
    }
    
    const menuItems = await MenuItem.find(query)
      .populate('branch', 'name location')
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await MenuItem.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        menuItems,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching menu items',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/menu/:id
// @desc    Get single menu item by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('branch', 'name location contactInfo');
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    if (!menuItem.isAvailable || !menuItem.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Menu item is not available'
      });
    }
    
    res.json({
      success: true,
      data: {
        menuItem
      }
    });
  } catch (error) {
    console.error('Get menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching menu item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/menu/branch/:branchId
// @desc    Get menu items for specific branch
// @access  Public
router.get('/branch/:branchId', async (req, res) => {
  try {
    const { category, search, dietary } = req.query;
    
    const branch = await Branch.findById(req.params.branchId);
    if (!branch || !branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found or inactive'
      });
    }
    
    const filters = {};
    if (category) filters.category = category;
    if (dietary) {
      const dietaryArray = dietary.split(',');
      dietaryArray.forEach(diet => {
        filters[`dietaryInfo.${diet}`] = true;
      });
    }
    
    const menuItems = await MenuItem.searchMenuItems(req.params.branchId, search, filters);
    
    // Group by category
    const groupedMenu = menuItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        branch: {
          name: branch.name,
          location: branch.fullAddress
        },
        menuItems: groupedMenu
      }
    });
  } catch (error) {
    console.error('Get branch menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching branch menu',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/menu/popular/:branchId
// @desc    Get popular menu items for branch
// @access  Public
router.get('/popular/:branchId', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const popularItems = await MenuItem.getPopularItems(req.params.branchId, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        menuItems: popularItems
      }
    });
  } catch (error) {
    console.error('Get popular menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching popular menu items',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/menu/chef-recommendations/:branchId
// @desc    Get chef recommendations for branch
// @access  Public
router.get('/chef-recommendations/:branchId', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const recommendations = await MenuItem.getChefRecommendations(req.params.branchId, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        menuItems: recommendations
      }
    });
  } catch (error) {
    console.error('Get chef recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching chef recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/menu
// @desc    Create new menu item (Admin only)
// @access  Private (Admin)
router.post('/', [
  protect,
  authorize('admin', 'manager'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('branch').isMongoId().withMessage('Valid branch ID is required'),
  body('category').isIn(['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Salads', 'Soups', 'Breads', 'Combo Meals', 'Specials', 'Kids Menu'])
    .withMessage('Invalid category'),
  body('description').isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('preparationTime').optional().isInt({ min: 1 }).withMessage('Preparation time must be a positive integer')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    // Check if branch exists
    const branch = await Branch.findById(req.body.branch);
    if (!branch) {
      return res.status(400).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    const menuItem = await MenuItem.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: {
        menuItem
      }
    });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating menu item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/menu/:id
// @desc    Update menu item (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  protect,
  authorize('admin', 'manager'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('description').optional().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: {
        menuItem
      }
    });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating menu item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/menu/:id
// @desc    Delete menu item (Admin only)
// @access  Private (Admin)
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Menu item deactivated successfully'
    });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting menu item',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/menu/:id/review
// @desc    Add review to menu item
// @access  Private
router.post('/:id/review', [
  protect,
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 300 }).withMessage('Comment cannot exceed 300 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { rating, comment } = req.body;
    
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    await menuItem.addReview(req.user._id, rating, comment);
    
    res.json({
      success: true,
      message: 'Review added successfully',
      data: {
        menuItem
      }
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/menu/categories
// @desc    Get available menu categories
// @access  Public
router.get('/categories', (req, res) => {
  const categories = [
    { value: 'Appetizers', label: 'Appetizers', icon: '🥗' },
    { value: 'Main Course', label: 'Main Course', icon: '🍽️' },
    { value: 'Desserts', label: 'Desserts', icon: '🍰' },
    { value: 'Beverages', label: 'Beverages', icon: '🥤' },
    { value: 'Salads', label: 'Salads', icon: '🥙' },
    { value: 'Soups', label: 'Soups', icon: '🍲' },
    { value: 'Breads', label: 'Breads', icon: '🍞' },
    { value: 'Combo Meals', label: 'Combo Meals', icon: '🍱' },
    { value: 'Specials', label: 'Specials', icon: '⭐' },
    { value: 'Kids Menu', label: 'Kids Menu', icon: '👶' }
  ];
  
  res.json({
    success: true,
    data: {
      categories
    }
  });
});

// @route   GET /api/menu/dietary-options
// @desc    Get available dietary options
// @access  Public
router.get('/dietary-options', (req, res) => {
  const dietaryOptions = [
    { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
    { value: 'vegan', label: 'Vegan', icon: '🌱' },
    { value: 'glutenFree', label: 'Gluten Free', icon: '🌾' },
    { value: 'dairyFree', label: 'Dairy Free', icon: '🥛' },
    { value: 'nutFree', label: 'Nut Free', icon: '🥜' },
    { value: 'spicy', label: 'Spicy', icon: '🌶️' },
    { value: 'halal', label: 'Halal', icon: '☪️' },
    { value: 'keto', label: 'Keto', icon: '🥑' },
    { value: 'lowCalorie', label: 'Low Calorie', icon: '💪' }
  ];
  
  res.json({
    success: true,
    data: {
      dietaryOptions
    }
  });
});

module.exports = router;
