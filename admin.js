const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Table = require('../models/Table');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const Offer = require('../models/Offer');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin/manager role
router.use(protect);
router.use(authorize('admin', 'manager'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : now;
    
    // Get basic counts
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalBranches = await Branch.countDocuments({ isActive: true });
    const totalTables = await Table.countDocuments({ isActive: true });
    const totalBookings = await Booking.countDocuments({
      createdAt: { $gte: start, $lte: end }
    });
    
    // Get booking statistics
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get recent bookings
    const recentBookings = await Booking.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .populate('user', 'name email')
    .populate('branch', 'name location')
    .populate('table', 'tableNumber themeType')
    .sort({ createdAt: -1 })
    .limit(10);
    
    // Get branch-wise statistics
    const branchStats = await Branch.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'branch',
          as: 'bookings'
        }
      },
      {
        $project: {
          name: 1,
          location: 1,
          totalBookings: { $size: '$bookings' },
          confirmedBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.status', 'confirmed'] }
              }
            }
          },
          totalRevenue: {
            $sum: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.paymentStatus', 'paid'] }
              }
            }
          }
        }
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalBranches,
          totalTables,
          totalBookings
        },
        bookingStats,
        paymentStats,
        recentBookings,
        branchStats,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Private (Admin)
router.get('/users', async (req, res) => {
  try {
    const { 
      search, 
      role, 
      membershipTier, 
      isActive, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }
    
    if (role) query.role = role;
    if (membershipTier) query['profileInfo.membershipTier'] = membershipTier;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password -resetPasswordToken -emailVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Private (Admin)
router.put('/users/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be a boolean value')
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
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: `User ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/bookings
// @desc    Get all bookings with filters
// @access  Private (Admin)
router.get('/bookings', async (req, res) => {
  try {
    const { 
      status, 
      branch, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (branch) query.branch = branch;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('branch', 'name location')
      .populate('table', 'tableNumber themeType seats')
      .populate('payment', 'amount status method')
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
    console.error('Get admin bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/reports/revenue
// @desc    Get revenue reports
// @access  Private (Admin)
router.get('/reports/revenue', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    let groupFormat;
    switch (groupBy) {
      case 'hour':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'month':
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        groupFormat = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
    
    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: groupFormat,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageOrderValue: { $avg: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        revenueData,
        groupBy,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching revenue report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/reports/bookings
// @desc    Get booking reports
// @access  Private (Admin)
router.get('/reports/bookings', async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const matchStage = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    if (branchId) {
      matchStage.branch = require('mongoose').Types.ObjectId(branchId);
    }
    
    const bookingStats = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const hourlyDistribution = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    const themePopularity = await Booking.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'tables',
          localField: 'table',
          foreignField: '_id',
          as: 'tableData'
        }
      },
      { $unwind: '$tableData' },
      {
        $group: {
          _id: '$tableData.themeType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        bookingStats,
        hourlyDistribution,
        themePopularity,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get booking report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/analytics/overview
// @desc    Get analytics overview
// @access  Private (Admin)
router.get('/analytics/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate;
    const now = new Date();
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get key metrics
    const totalBookings = await Booking.countDocuments({
      createdAt: { $gte: startDate }
    });
    
    const totalRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const averageOrderValue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          average: { $avg: '$amount' }
        }
      }
    ]);
    
    const topBranches = await Branch.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'branch',
          as: 'bookings'
        }
      },
      {
        $project: {
          name: 1,
          location: 1,
          totalBookings: { $size: '$bookings' },
          confirmedBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                cond: { $eq: ['$$this.status', 'confirmed'] }
              }
            }
          }
        }
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        averageOrderValue: averageOrderValue[0]?.average || 0,
        topBranches
      }
    });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics overview',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
