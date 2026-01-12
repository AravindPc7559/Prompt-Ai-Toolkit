/**
 * Payment controller for Razorpay integration
 */
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { config } from '../config/app.js';

// Lazy initialization of Razorpay instance
let razorpay = null;

const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
    }
    
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpay;
};

/**
 * Create a Razorpay order
 */
export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { amount, currency = 'INR', plan = 'monthly' } = req.body;

    // Validate amount range (additional server-side check)
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 10000;
    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}`
      });
    }

    // Validate amount matches plan pricing
    const PRICING = {
      monthly: 130
    };
    
    if (amount !== PRICING[plan]) {
      return res.status(400).json({
        success: false,
        error: `Amount does not match plan pricing. Expected ₹${PRICING[plan]} for ${plan} plan`
      });
    }

    // Amount should be in paise (smallest currency unit for INR)
    const amountInPaise = Math.round(amount * 100);

    // Generate receipt ID (must be max 40 characters)
    // Format: rec_<shortUserId>_<timestamp>
    const shortUserId = userId.toString().slice(-8); // Last 8 chars of userId
    const timestamp = Date.now().toString().slice(-10); // Last 10 digits of timestamp
    const receipt = `rec_${shortUserId}_${timestamp}`.slice(0, 40); // Ensure max 40 chars

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receipt,
      notes: {
        userId: userId,
        plan: plan,
        timestamp: new Date().toISOString()
      }
    };

    const razorpayInstance = getRazorpayInstance();
    const order = await razorpayInstance.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    next(error);
  }
};

/**
 * Verify payment and update user subscription
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification data'
      });
    }

    // Check if payment already exists (prevent duplicate processing)
    const existingPayment = await Payment.findOne({ 
      razorpayPaymentId: razorpay_payment_id 
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        error: 'Payment has already been processed'
      });
    }

    // Verify the payment signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error(`Invalid payment signature for order ${razorpay_order_id} by user ${userId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Fetch order details from Razorpay
    const razorpayInstance = getRazorpayInstance();
    const order = await razorpayInstance.orders.fetch(razorpay_order_id);
    
    // Verify order belongs to this user
    if (order.notes?.userId !== userId) {
      console.error(`Order ${razorpay_order_id} does not belong to user ${userId}`);
      return res.status(403).json({
        success: false,
        error: 'Order does not belong to this user'
      });
    }
    
    // Fetch payment details from Razorpay to verify status
    const razorpayPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    
    // Verify payment status
    if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
      return res.status(400).json({
        success: false,
        error: `Payment not completed. Status: ${razorpayPayment.status}`
      });
    }
    
    // Verify payment order_id matches
    if (razorpayPayment.order_id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Payment does not match order'
      });
    }
    
    // Update user subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Calculate subscription expiry (30 days from now for monthly plan)
    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

    user.isSubscribed = true;
    user.subscriptionExpiresAt = subscriptionExpiresAt;
    await user.save();

    // Save payment record with audit information
    const payment = new Payment({
      userId: user._id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: order.amount / 100, // Convert from paise to rupees
      currency: order.currency,
      plan: order.notes?.plan || 'monthly',
      status: 'completed',
      subscriptionExpiresAt: subscriptionExpiresAt
    });
    await payment.save();
    
    // Log successful payment (without sensitive data)
    console.log(`Payment successful: Order ${razorpay_order_id}, User ${userId}, Amount ₹${order.amount / 100}`);

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      subscriptionExpiresAt: subscriptionExpiresAt,
      amount: order.amount / 100,
      currency: order.currency
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    next(error);
  }
};

/**
 * Get payment status
 */
export const getPaymentStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const razorpayInstance = getRazorpayInstance();
    const order = await razorpayInstance.orders.fetch(orderId);
    const user = await User.findById(userId).select('isSubscribed subscriptionExpiresAt');

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount / 100, // Convert from paise to rupees
        currency: order.currency,
        status: order.status
      },
      user: {
        isSubscribed: user?.isSubscribed || false,
        subscriptionExpiresAt: user?.subscriptionExpiresAt || null
      }
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    next(error);
  }
};
