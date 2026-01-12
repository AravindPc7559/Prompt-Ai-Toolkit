import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index for automatic expiration
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
tokenSchema.index({ userId: 1, isActive: 1 });
tokenSchema.index({ token: 1, isActive: 1 });

// Method to check if token is valid
tokenSchema.methods.isValid = function() {
  return this.isActive && this.expiresAt > new Date();
};

// Static method to find valid token
tokenSchema.statics.findValidToken = async function(token) {
  const tokenDoc = await this.findOne({ 
    token, 
    isActive: true 
  });
  
  if (!tokenDoc) {
    return null;
  }
  
  if (tokenDoc.expiresAt <= new Date()) {
    // Token expired, mark as inactive
    tokenDoc.isActive = false;
    await tokenDoc.save();
    return null;
  }
  
  // Update last used timestamp
  tokenDoc.lastUsedAt = new Date();
  await tokenDoc.save();
  
  return tokenDoc;
};

export const Token = mongoose.model('Token', tokenSchema);
