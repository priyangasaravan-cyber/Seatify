const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  method: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['razorpay', 'stripe', 'paypal', 'cash', 'card', 'upi', 'netbanking', 'wallet']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  gatewayDetails: {
    gateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'paypal'],
      required: function() {
        return ['razorpay', 'stripe', 'paypal'].includes(this.method);
      }
    },
    gatewayPaymentId: String,
    gatewayOrderId: String,
    gatewaySignature: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  transactionDetails: {
    transactionId: String,
    transactionDate: Date,
    processedAt: Date,
    failureReason: String,
    gatewayFees: {
      type: Number,
      default: 0
    }
  },
  refund: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    },
    refundedAt: Date,
    refundMethod: String,
    gatewayRefundId: String
  },
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' }
    }
  },
  metadata: {
    deviceInfo: String,
    ipAddress: String,
    userAgent: String,
    source: { type: String, default: 'web' } // web, mobile, admin
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ 'gatewayDetails.gatewayPaymentId': 1 });

// Pre-save middleware to generate payment ID
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.paymentId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Generate random 6-digit number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    this.paymentId = `PAY${year}${month}${day}${randomNum}`;
  }
  next();
});

// Method to process payment
paymentSchema.methods.processPayment = function(gatewayResponse) {
  this.status = 'processing';
  this.gatewayDetails.gatewayResponse = gatewayResponse;
  this.transactionDetails.transactionDate = new Date();
  
  return this.save();
};

// Method to complete payment
paymentSchema.methods.completePayment = function(transactionId) {
  this.status = 'completed';
  this.transactionDetails.transactionId = transactionId;
  this.transactionDetails.processedAt = new Date();
  
  return this.save();
};

// Method to fail payment
paymentSchema.methods.failPayment = function(reason) {
  this.status = 'failed';
  this.transactionDetails.failureReason = reason;
  
  return this.save();
};

// Method to initiate refund
paymentSchema.methods.initiateRefund = function(refundAmount, reason, refundMethod = 'original') {
  this.refund = {
    refundId: `REF${Date.now()}${Math.floor(Math.random() * 1000)}`,
    refundAmount: refundAmount || this.amount,
    refundReason: reason,
    refundStatus: 'pending',
    refundMethod
  };
  
  return this.save();
};

// Method to complete refund
paymentSchema.methods.completeRefund = function(gatewayRefundId) {
  this.status = 'refunded';
  this.refund.refundStatus = 'processed';
  this.refund.refundedAt = new Date();
  this.refund.gatewayRefundId = gatewayRefundId;
  
  return this.save();
};

// Method to fail refund
paymentSchema.methods.failRefund = function(reason) {
  this.refund.refundStatus = 'failed';
  this.refund.failureReason = reason;
  
  return this.save();
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = function(startDate, endDate, branchId = null) {
  const matchStage = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (branchId) {
    matchStage['booking.branch'] = mongoose.Types.ObjectId(branchId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Static method to get revenue by payment method
paymentSchema.statics.getRevenueByMethod = function(startDate, endDate) {
  return this.aggregate([
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
        _id: '$method',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
