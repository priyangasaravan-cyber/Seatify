const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Table = require('../models/Table');
const Branch = require('../models/Branch');
const Payment = require('../models/Payment');
const { protect, checkOwnership } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', [
  protect,
  body('branch').isMongoId().withMessage('Valid branch ID is required'),
  body('table').isMongoId().withMessage('Valid table ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
  body('partySize').isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('specialRequests').optional().isLength({ max: 500 }).withMessage('Special requests cannot exceed 500 characters')
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

    const { branch, table, date, startTime, endTime, partySize, specialRequests, preOrderedItems } = req.body;

    // Check if branch exists and is active
    const branchDoc = await Branch.findById(branch);
    if (!branchDoc || !branchDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Branch not found or inactive'
      });
    }

    // Check if table exists and is active
    const tableDoc = await Table.findById(table);
    if (!tableDoc || !tableDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Table not found or inactive'
      });
    }

    // Check if table belongs to the branch
    if (tableDoc.branch.toString() !== branch) {
      return res.status(400).json({
        success: false,
        message: 'Table does not belong to the selected branch'
      });
    }

    // Check if party size fits the table
    if (partySize > tableDoc.seats) {
      return res.status(400).json({
        success: false,
        message: `Table can only accommodate ${tableDoc.seats} people`
      });
    }

    // Check if branch is open on the requested date
    const requestedDate = new Date(date);
    const dayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const daySchedule = branchDoc.operatingHours[dayName];
    
    if (!daySchedule || !daySchedule.isOpen) {
      return res.status(400).json({
        success: false,
        message: 'Branch is closed on this day'
      });
    }

    // Check if requested time is within operating hours
    if (startTime < daySchedule.open || endTime > daySchedule.close) {
      return res.status(400).json({
        success: false,
        message: `Branch is open from ${daySchedule.open} to ${daySchedule.close}`
      });
    }

    // Check table availability
    const isAvailable = await tableDoc.isAvailableForSlot(
      new Date(`${date}T${startTime}:00`),
      new Date(`${date}T${endTime}:00`)
    );

    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Table is not available for the selected time slot'
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    
    // Base amount (could be table booking fee)
    const baseAmount = 0; // Assuming no base booking fee
    
    // Add pre-ordered items cost
    if (preOrderedItems && preOrderedItems.length > 0) {
      // This would need menu item validation and pricing
      // For now, we'll assume preOrderedItems have price included
      totalAmount = preOrderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // Apply table price multiplier
    totalAmount *= tableDoc.priceMultiplier;

    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      branch,
      table,
      date: requestedDate,
      startTime,
      endTime,
      partySize,
      specialRequests,
      preOrderedItems: preOrderedItems || [],
      totalAmount
    });

    // Populate the booking with related data
    await booking.populate([
      { path: 'branch', select: 'name location contactInfo' },
      { path: 'table', select: 'tableNumber seats themeType location' },
      { path: 'user', select: 'name email phone' }
    ]);

    // Emit real-time update
    if (req.io) {
      req.io.to(`branch-${branch}`).emit('booking-created', {
        bookingId: booking.bookingId,
        tableId: table,
        startTime,
        endTime
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await Booking.find(query)
      .populate([
        { path: 'branch', select: 'name location contactInfo' },
        { path: 'table', select: 'tableNumber seats themeType' },
        { path: 'payment', select: 'amount status method' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate([
        { path: 'branch', select: 'name location contactInfo operatingHours' },
        { path: 'table', select: 'tableNumber seats themeType location specialFeatures' },
        { path: 'user', select: 'name email phone' },
        { path: 'payment', select: 'amount status method transactionDetails' }
      ]);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if user owns this booking or is admin
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: {
        booking
      }
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel booking
// @access  Private
router.put('/:id/cancel', [
  protect,
  body('reason').optional().isLength({ max: 200 }).withMessage('Reason cannot exceed 200 characters')
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

    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if user owns this booking or is admin
    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled at this time'
      });
    }
    
    // Cancel the booking
    await booking.cancelBooking('user', req.body.reason);
    
    // Emit real-time update
    if (req.io) {
      req.io.to(`branch-${booking.branch}`).emit('booking-cancelled', {
        bookingId: booking.bookingId,
        tableId: booking.table
      });
    }
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
        refundAmount: booking.cancellation.refundAmount
      }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/bookings/:id/confirm
// @desc    Confirm booking (Admin only)
// @access  Private (Admin)
router.put('/:id/confirm', protect, async (req, res) => {
  try {
    // Check if user is admin or manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be confirmed'
      });
    }
    
    await booking.confirmBooking();
    
    // Emit real-time update
    if (req.io) {
      req.io.to(`branch-${booking.branch}`).emit('booking-confirmed', {
        bookingId: booking.bookingId,
        tableId: booking.table
      });
    }
    
    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        booking
      }
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/bookings/:id/checkin
// @desc    Check in to booking
// @access  Private
router.post('/:id/checkin', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if user owns this booking or is admin
    if (booking.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }
    
    // Check if it's the right time for check-in (within 30 minutes of start time)
    const now = new Date();
    const bookingDateTime = booking.bookingDateTime;
    const timeDiff = Math.abs(now - bookingDateTime) / (1000 * 60); // in minutes
    
    if (timeDiff > 30) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is only allowed within 30 minutes of booking time'
      });
    }
    
    booking.checkIn = {
      checkedInAt: now,
      checkedInBy: req.user._id
    };
    
    await booking.save();
    
    res.json({
      success: true,
      message: 'Check-in successful',
      data: {
        booking
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/bookings/:id/rate
// @desc    Rate and review booking
// @access  Private
router.post('/:id/rate', [
  protect,
  body('food').isInt({ min: 1, max: 5 }).withMessage('Food rating must be between 1 and 5'),
  body('service').isInt({ min: 1, max: 5 }).withMessage('Service rating must be between 1 and 5'),
  body('ambiance').isInt({ min: 1, max: 5 }).withMessage('Ambiance rating must be between 1 and 5'),
  body('overall').isInt({ min: 1, max: 5 }).withMessage('Overall rating must be between 1 and 5'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters')
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

    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if user owns this booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed bookings can be rated'
      });
    }
    
    if (booking.rating.overall) {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been rated'
      });
    }
    
    const { food, service, ambiance, overall, review } = req.body;
    
    booking.rating = {
      food,
      service,
      ambiance,
      overall,
      review,
      ratedAt: new Date()
    };
    
    await booking.save();
    
    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        booking
      }
    });
  } catch (error) {
    console.error('Rate booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting rating',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
