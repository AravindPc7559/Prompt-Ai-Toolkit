import mongoose from 'mongoose';

const usageHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Token',
    index: true,
    required: false // Optional since we're using JWT now
  },
  action: {
    type: String,
    required: true,
    enum: ['rewrite', 'grammarize', 'format-email'],
    index: true
  },
  inputLength: {
    type: Number,
    default: 0
  },
  outputLength: {
    type: Number,
    default: 0
  },
  model: {
    type: String,
    default: 'gpt-4o-mini'
  },
  tokensUsed: {
    type: Number,
    default: 0
  },
  cost: {
    type: Number,
    default: 0
  },
  success: {
    type: Boolean,
    default: true
  },
  error: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for performance
usageHistorySchema.index({ userId: 1, createdAt: -1 });
usageHistorySchema.index({ userId: 1, action: 1, createdAt: -1 });
usageHistorySchema.index({ createdAt: -1 });

export const UsageHistory = mongoose.model('UsageHistory', usageHistorySchema);
