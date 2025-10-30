const express = require('express');
const { body, validationResult } = require('express-validator');
const Table = require('../models/Table');
const Branch = require('../models/Branch');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tables
// @desc    Get all tables with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      branch, 
      theme, 
      minSeats, 
      maxSeats, 
      available, 
      floor, 
      section,
      limit = 20, 
      page = 1 
    } = req.query;
    
    // Build query
    const query = { isActive: true };
    
    if (branch) {
      query.branch = branch;
    }
    
    if (theme) {
      query.themeType = theme;
    }
    
    if (minSeats) {
      query.seats = { $gte: parseInt(minSeats) };
    }
    
    if (maxSeats) {
      query.seats = { ...query.seats, $lte: parseInt(maxSeats) };
    }
    
    if (available !== undefined) {
      query.isAvailable = available === 'true';
    }
    
    if (floor) {
      query['location.floor'] = floor;
    }
    
    if (section) {
      query['location.section'] = new RegExp(section, 'i');
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tables = await Table.find(query)
      .populate('branch', 'name location')
      .sort({ themeType: 1, seats: 1, tableNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Table.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        tables,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tables',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/tables/:id
// @desc    Get single table by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const table = await Table.findById(req.params.id)
      .populate('branch', 'name location operatingHours');
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    if (!table.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Table is not available'
      });
    }
    
    // Get theme details
    const themeDetails = table.getThemeDetails();
    
    res.json({
      success: true,
      data: {
        table: {
          ...table.toObject(),
          themeDetails
        }
      }
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching table',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/tables/availability/check
// @desc    Check table availability for specific time slot
// @access  Public
router.get('/availability/check', async (req, res) => {
  try {
    const { 
      tableId, 
      date, 
      startTime, 
      endTime 
    } = req.query;
    
    if (!tableId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Table ID, date, start time, and end time are required'
      });
    }
    
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    const isAvailable = await table.isAvailableForSlot(
      new Date(`${date}T${startTime}:00`),
      new Date(`${date}T${endTime}:00`)
    );
    
    res.json({
      success: true,
      data: {
        available: isAvailable,
        table: {
          id: table._id,
          tableNumber: table.tableNumber,
          seats: table.seats,
          themeType: table.themeType,
          priceMultiplier: table.priceMultiplier
        }
      }
    });
  } catch (error) {
    console.error('Check table availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/tables
// @desc    Create new table (Admin only)
// @access  Private (Admin)
router.post('/', [
  protect,
  authorize('admin', 'manager'),
  body('tableNumber').notEmpty().withMessage('Table number is required'),
  body('branch').isMongoId().withMessage('Valid branch ID is required'),
  body('seats').isInt({ min: 1, max: 20 }).withMessage('Seats must be between 1 and 20'),
  body('themeType').isIn(['Premium', 'Gen Z', 'Royal', 'Family', 'Friends', 'Business', 'Romantic', 'Casual'])
    .withMessage('Invalid theme type'),
  body('priceMultiplier').isFloat({ min: 0.5, max: 3.0 }).withMessage('Price multiplier must be between 0.5 and 3.0'),
  body('location.floor').notEmpty().withMessage('Floor is required'),
  body('location.section').notEmpty().withMessage('Section is required'),
  body('location.position.x').isNumeric().withMessage('X position must be a number'),
  body('location.position.y').isNumeric().withMessage('Y position must be a number')
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
    
    // Check if table number already exists in the branch
    const existingTable = await Table.findOne({
      branch: req.body.branch,
      tableNumber: req.body.tableNumber
    });
    
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: 'Table number already exists in this branch'
      });
    }
    
    const table = await Table.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Table created successfully',
      data: {
        table
      }
    });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating table',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/tables/:id
// @desc    Update table (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  protect,
  authorize('admin', 'manager'),
  body('seats').optional().isInt({ min: 1, max: 20 }).withMessage('Seats must be between 1 and 20'),
  body('themeType').optional().isIn(['Premium', 'Gen Z', 'Royal', 'Family', 'Friends', 'Business', 'Romantic', 'Casual'])
    .withMessage('Invalid theme type'),
  body('priceMultiplier').optional().isFloat({ min: 0.5, max: 3.0 }).withMessage('Price multiplier must be between 0.5 and 3.0')
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
    
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Table updated successfully',
      data: {
        table
      }
    });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating table',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/tables/:id
// @desc    Delete table (Admin only)
// @access  Private (Admin)
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Table deactivated successfully'
    });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting table',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/tables/:id/availability
// @desc    Update table availability (Admin only)
// @access  Private (Admin)
router.put('/:id/availability', [
  protect,
  authorize('admin', 'manager'),
  body('isAvailable').isBoolean().withMessage('Availability must be a boolean value')
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
    
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { isAvailable: req.body.isAvailable },
      { new: true }
    );
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    res.json({
      success: true,
      message: `Table ${req.body.isAvailable ? 'made available' : 'made unavailable'} successfully`,
      data: {
        table
      }
    });
  } catch (error) {
    console.error('Update table availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating table availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/tables/themes
// @desc    Get available theme types
// @access  Public
router.get('/themes', (req, res) => {
  const themes = [
    {
      type: 'Premium',
      name: 'Premium',
      color: '#8B4513',
      description: 'Elegant and sophisticated dining experience',
      features: ['Premium seating', 'Exclusive service', 'Fine dining atmosphere']
    },
    {
      type: 'Gen Z',
      name: 'Gen Z',
      color: '#FF6B6B',
      description: 'Vibrant and trendy space for young diners',
      features: ['Instagram-worthy decor', 'Social media friendly', 'Modern vibes']
    },
    {
      type: 'Royal',
      name: 'Royal',
      color: '#DAA520',
      description: 'Luxurious royal dining experience',
      features: ['Regal ambiance', 'Premium service', 'Exclusive atmosphere']
    },
    {
      type: 'Family',
      name: 'Family',
      color: '#4ECDC4',
      description: 'Comfortable space perfect for family gatherings',
      features: ['Kid-friendly', 'Spacious seating', 'Family-oriented']
    },
    {
      type: 'Friends',
      name: 'Friends',
      color: '#45B7D1',
      description: 'Casual and fun space for friends to hang out',
      features: ['Group-friendly', 'Social atmosphere', 'Relaxed vibes']
    },
    {
      type: 'Business',
      name: 'Business',
      color: '#96CEB4',
      description: 'Professional setting for business meetings',
      features: ['Quiet environment', 'Professional service', 'Meeting-friendly']
    },
    {
      type: 'Romantic',
      name: 'Romantic',
      color: '#F8BBD9',
      description: 'Intimate and romantic dining space',
      features: ['Intimate lighting', 'Couple-friendly', 'Romantic ambiance']
    },
    {
      type: 'Casual',
      name: 'Casual',
      color: '#A8E6CF',
      description: 'Relaxed and comfortable dining experience',
      features: ['Comfortable seating', 'Relaxed atmosphere', 'All-purpose']
    }
  ];
  
  res.json({
    success: true,
    data: {
      themes
    }
  });
});

module.exports = router;
