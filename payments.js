const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// Razorpay integration
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret'
});

const router = express.Router();

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order
// @access  Private
router.post('/create-order', [
  protect,
  body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1')
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

    const { bookingId, amount } = req.body;

    // Get booking details
    const booking = await Booking.findById(bookingId)
      .populate('user', 'name email phone')
      .populate('branch', 'name location');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking is in pending status
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be paid for'
      });
    }

    // Check if payment already exists
    if (booking.payment) {
      return res.status(400).json({
        success: false,
        message: 'Payment already exists for this booking'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `booking_${booking.bookingId}`,
      notes: {
        bookingId: booking.bookingId,
        userId: req.user._id.toString(),
        branchName: booking.branch.name
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Create payment record
    const payment = await Payment.create({
      booking: bookingId,
      user: req.user._id,
      amount: amount,
      method: 'razorpay',
      status: 'pending',
      gatewayDetails: {
        gateway: 'razorpay',
        gatewayOrderId: razorpayOrder.id
      }
    });

    // Update booking with payment reference
    booking.payment = payment._id;
    await booking.save();

    res.json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentId: payment.paymentId,
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment
// @access  Private
router.post('/verify', [
  protect,
  body('orderId').notEmpty().withMessage('Order ID is required'),
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('signature').notEmpty().withMessage('Signature is required')
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

    const { orderId, paymentId, signature } = req.body;

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      'gatewayDetails.gatewayOrderId': orderId,
      user: req.user._id
    }).populate('booking');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Get payment details from Razorpay
    const razorpayPayment = await razorpay.payments.fetch(paymentId);

    // Update payment record
    payment.status = 'completed';
    payment.gatewayDetails.gatewayPaymentId = paymentId;
    payment.gatewayDetails.gatewaySignature = signature;
    payment.gatewayDetails.gatewayResponse = razorpayPayment;
    payment.transactionDetails = {
      transactionId: paymentId,
      transactionDate: new Date(razorpayPayment.created_at * 1000),
      processedAt: new Date(),
      gatewayFees: razorpayPayment.fee || 0
    };

    await payment.save();

    // Update booking status
    const booking = payment.booking;
    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    await booking.save();

    // Update user loyalty points
    const loyaltyPoints = Math.floor(amount / 100); // 1 point per ₹100
    await req.user.updateLoyaltyPoints(loyaltyPoints);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        payment,
        booking: {
          bookingId: booking.bookingId,
          status: booking.status,
          paymentStatus: booking.paymentStatus
        },
        loyaltyPointsEarned: loyaltyPoints
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payments/refund
// @desc    Initiate payment refund
// @access  Private
router.post('/refund', [
  protect,
  body('paymentId').isMongoId().withMessage('Valid payment ID is required'),
  body('reason').notEmpty().withMessage('Refund reason is required'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Refund amount must be positive')
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

    const { paymentId, reason, amount } = req.body;

    // Find payment record
    const payment = await Payment.findById(paymentId)
      .populate('booking')
      .populate('user');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment or is admin
    if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if payment is completed
    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    // Check if already refunded
    if (payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been refunded'
      });
    }

    const refundAmount = amount || payment.amount;

    // Initiate refund with Razorpay
    let razorpayRefund;
    try {
      razorpayRefund = await razorpay.payments.refund(payment.gatewayDetails.gatewayPaymentId, {
        amount: Math.round(refundAmount * 100), // Convert to paise
        notes: {
          reason: reason,
          refundedBy: req.user._id.toString()
        }
      });
    } catch (razorpayError) {
      console.error('Razorpay refund error:', razorpayError);
      return res.status(400).json({
        success: false,
        message: 'Failed to process refund with payment gateway',
        error: razorpayError.message
      });
    }

    // Update payment record
    await payment.initiateRefund(refundAmount, reason);
    await payment.completeRefund(razorpayRefund.id);

    // Update booking status if full refund
    if (refundAmount >= payment.amount) {
      const booking = payment.booking;
      await booking.cancelBooking('system', reason);
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: payment.refund.refundId,
        amount: refundAmount,
        status: payment.refund.refundStatus
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing refund',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/payments
// @desc    Get user's payment history
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, method, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;
    if (method) query.method = method;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const payments = await Payment.find(query)
      .populate('booking', 'bookingId branch table date startTime endTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/payments/:id
// @desc    Get single payment by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('booking', 'bookingId branch table date startTime endTime')
      .populate('user', 'name email phone');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user owns this payment or is admin
    if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: {
        payment
      }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/payments/stats
// @desc    Get payment statistics (Admin only)
// @access  Private (Admin)
router.get('/stats', [protect, authorize('admin', 'manager')], async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const stats = await Payment.getPaymentStats(startDate, endDate, branchId);
    const revenueByMethod = await Payment.getRevenueByMethod(startDate, endDate);
    
    res.json({
      success: true,
      data: {
        stats,
        revenueByMethod
      }
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Razorpay webhooks
// @access  Public (but should be secured in production)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;
    
    // Verify webhook signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret')
      .update(body)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }
    
    const event = JSON.parse(body);
    
    switch (event.event) {
      case 'payment.captured':
        // Handle successful payment
        console.log('Payment captured:', event.payload.payment.entity.id);
        break;
        
      case 'payment.failed':
        // Handle failed payment
        console.log('Payment failed:', event.payload.payment.entity.id);
        break;
        
      case 'refund.created':
        // Handle refund creation
        console.log('Refund created:', event.payload.refund.entity.id);
        break;
        
      default:
        console.log('Unhandled webhook event:', event.event);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

module.exports = router;
