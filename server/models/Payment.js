import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  plan: {
    type: String,
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  subscriptionExpiresAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ razorpayOrderId: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
