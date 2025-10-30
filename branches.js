const express = require('express');
const { body, validationResult } = require('express-validator');
const Branch = require('../models/Branch');
const Table = require('../models/Table');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/branches
// @desc    Get all branches
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { city, state, features, search, limit = 20, page = 1 } = req.query;
    
    // Build query
    const query = { isActive: true };
    
    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }
    
    if (state) {
      query['location.state'] = new RegExp(state, 'i');
    }
    
    if (features) {
      const featureArray = features.split(',');
      query.features = { $in: featureArray };
    }
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'location.city': new RegExp(search, 'i') },
        { 'location.state': new RegExp(search, 'i') }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const branches = await Branch.find(query)
      .select('-operatingHours -amenities -images -settings')
      .sort({ rating: -1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Branch.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        branches,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching branches',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/branches/:id
// @desc    Get single branch by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('manager', 'name email phone')
      .populate({
        path: 'tables',
        select: 'tableNumber seats themeType priceMultiplier location isAvailable specialFeatures'
      });
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    if (!branch.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Branch is not available'
      });
    }
    
    res.json({
      success: true,
      data: {
        branch
      }
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/branches/:id/tables
// @desc    Get tables for a specific branch
// @access  Public
router.get('/:id/tables', async (req, res) => {
  try {
    const { theme, minSeats, maxSeats, available } = req.query;
    
    const query = {
      branch: req.params.id,
      isActive: true
    };
    
    if (theme) {
      query.themeType = theme;
    }
    
    if (minSeats) {
      query.seats = { $gte: parseInt(minSeats) };
    }
    
    if (maxSeats) {
      query.seats = { ...query.seats, $lte: parseInt(maxSeats) };
    }
    
    if (available === 'true') {
      query.isAvailable = true;
    }
    
    const tables = await Table.find(query)
      .populate('branch', 'name location')
      .sort({ themeType: 1, seats: 1 });
    
    res.json({
      success: true,
      data: {
        tables
      }
    });
  } catch (error) {
    console.error('Get branch tables error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tables',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/branches/:id/availability
// @desc    Check table availability for specific date/time
// @access  Public
router.get('/:id/availability', async (req, res) => {
  try {
    const { date, startTime, endTime, partySize, theme } = req.query;
    
    if (!date || !startTime || !endTime || !partySize) {
      return res.status(400).json({
        success: false,
        message: 'Date, start time, end time, and party size are required'
      });
    }
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Check if branch is open on the requested date
    const requestedDate = new Date(date);
    const dayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const daySchedule = branch.operatingHours[dayName];
    
    if (!daySchedule || !daySchedule.isOpen) {
      return res.json({
        success: true,
        data: {
          available: false,
          reason: 'Branch is closed on this day',
          availableTables: []
        }
      });
    }
    
    // Check if requested time is within operating hours
    if (startTime < daySchedule.open || endTime > daySchedule.close) {
      return res.json({
        success: true,
        data: {
          available: false,
          reason: `Branch is open from ${daySchedule.open} to ${daySchedule.close}`,
          availableTables: []
        }
      });
    }
    
    // Find available tables
    const availableTables = await Table.findAvailableTables(
      req.params.id,
      new Date(`${date}T${startTime}:00`),
      new Date(`${date}T${endTime}:00`),
      parseInt(partySize),
      20, // max seats
      theme
    );
    
    res.json({
      success: true,
      data: {
        available: availableTables.length > 0,
        availableTables,
        operatingHours: {
          open: daySchedule.open,
          close: daySchedule.close
        }
      }
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/branches
// @desc    Create new branch (Admin only)
// @access  Private (Admin)
router.post('/', [
  protect,
  authorize('admin', 'manager'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('location.state').notEmpty().withMessage('State is required'),
  body('location.pincode').matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('contactInfo.phone').matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('contactInfo.email').isEmail().withMessage('Please provide a valid email'),
  body('capacity.totalSeats').isInt({ min: 1 }).withMessage('Total seats must be at least 1')
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
    
    const branch = await Branch.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: {
        branch
      }
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/branches/:id
// @desc    Update branch (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  protect,
  authorize('admin', 'manager'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('location.pincode').optional().matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('contactInfo.phone').optional().matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('contactInfo.email').optional().isEmail().withMessage('Please provide a valid email')
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
    
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: {
        branch
      }
    });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   DELETE /api/branches/:id
// @desc    Delete branch (Admin only)
// @access  Private (Admin)
router.delete('/:id', [protect, authorize('admin')], async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Branch deactivated successfully'
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting branch',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/branches/:id/stats
// @desc    Get branch statistics (Admin only)
// @access  Private (Admin)
router.get('/:id/stats', [protect, authorize('admin', 'manager')], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Get table count
    const tableCount = await Table.countDocuments({ branch: req.params.id, isActive: true });
    const availableTableCount = await Table.countDocuments({ 
      branch: req.params.id, 
      isActive: true, 
      isAvailable: true 
    });
    
    // Get booking stats if date range provided
    let bookingStats = null;
    if (startDate && endDate) {
      const Booking = require('../models/Booking');
      bookingStats = await Booking.getBookingStats(req.params.id, startDate, endDate);
    }
    
    res.json({
      success: true,
      data: {
        branch: {
          name: branch.name,
          location: branch.fullAddress,
          rating: branch.rating
        },
        tables: {
          total: tableCount,
          available: availableTableCount,
          occupied: tableCount - availableTableCount
        },
        bookings: bookingStats
      }
    });
  } catch (error) {
    console.error('Get branch stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching branch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
