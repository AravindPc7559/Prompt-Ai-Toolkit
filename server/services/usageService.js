/**
 * Service for tracking usage history
 */
import { UsageHistory } from '../models/UsageHistory.js';
import { User } from '../models/User.js';
import { invalidateUserCache } from '../utils/cache.js';

/**
 * Log usage to database
 */
export const logUsage = async (userId, action, data = {}) => {
  try {
    const usage = new UsageHistory({
      userId,
      action,
      inputLength: data.inputLength || 0,
      outputLength: data.outputLength || 0,
      model: data.model || 'gpt-4o-mini',
      tokensUsed: data.tokensUsed || 0,
      cost: data.cost || 0,
      success: data.success !== false,
      error: data.error || null
    });

    await usage.save();
    return usage;
  } catch (error) {
    console.error('Error logging usage:', error);
    // Don't throw error - usage logging shouldn't break the main flow
    return null;
  }
};

/**
 * Get usage statistics for a user
 */
export const getUserUsageStats = async (userId, startDate, endDate) => {
  try {
    const query = { userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const stats = await UsageHistory.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          totalTokens: { $sum: '$tokensUsed' },
          totalCost: { $sum: '$cost' },
          totalInputLength: { $sum: '$inputLength' },
          totalOutputLength: { $sum: '$outputLength' }
        }
      }
    ]);

    return stats;
  } catch (error) {
    console.error('Error getting usage stats:', error);
    throw error;
  }
};

/**
 * Check and update subscription expiration status
 */
export const checkAndUpdateSubscriptionExpiration = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('isSubscribed subscriptionExpiresAt');
    if (!user) {
      return false;
    }

    // Check if user is subscribed and subscription has expired
    if (user.isSubscribed && user.subscriptionExpiresAt) {
      const now = new Date();
      if (user.subscriptionExpiresAt <= now) {
        // Subscription has expired - update user status
        user.isSubscribed = false;
        user.subscriptionExpiresAt = undefined;
        await user.save();
        console.log(`Subscription expired for user ${userId}`);
        
        // Invalidate user cache after expiration
        invalidateUserCache(userId);
        
        return true; // Subscription was expired and updated
      }
    }
    return false; // Subscription is still valid or user is not subscribed
  } catch (error) {
    console.error('Error checking subscription expiration:', error);
    return false;
  }
};

/**
 * Check if user can use the service (has free trials or is subscribed)
 */
export const canUseService = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('freeTrialsUsed isSubscribed subscriptionExpiresAt');
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Check and update subscription expiration
    await checkAndUpdateSubscriptionExpiration(userId);
    
    // Refresh user data after potential update
    const updatedUser = await User.findById(userId)
      .select('freeTrialsUsed isSubscribed subscriptionExpiresAt');
    if (!updatedUser) {
      return { allowed: false, reason: 'User not found' };
    }

    // Check if user is subscribed and subscription is valid
    if (updatedUser.isSubscribed && updatedUser.subscriptionExpiresAt) {
      const now = new Date();
      if (updatedUser.subscriptionExpiresAt > now) {
        return { allowed: true, reason: 'subscribed' };
      }
    }

    // Check free trials
    const FREE_TRIAL_LIMIT = 10;
    if (updatedUser.freeTrialsUsed < FREE_TRIAL_LIMIT) {
      return { 
        allowed: true, 
        reason: 'free_trial',
        remainingTrials: FREE_TRIAL_LIMIT - updatedUser.freeTrialsUsed
      };
    }

    return { 
      allowed: false, 
      reason: 'trial_exhausted',
      message: 'Free trial exhausted. Please subscribe to continue using the service.'
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return { allowed: false, reason: 'error', message: 'Error checking usage limit' };
  }
};

/**
 * Increment free trial usage for a user
 */
export const incrementFreeTrialUsage = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('freeTrialsUsed isSubscribed');
    if (!user) {
      return false;
    }

    // Only increment if user is not subscribed
    if (!user.isSubscribed) {
      user.freeTrialsUsed = (user.freeTrialsUsed || 0) + 1;
      await user.save();
      
      // Invalidate user cache after trial increment
      invalidateUserCache(userId);
    }

    return true;
  } catch (error) {
    console.error('Error incrementing free trial usage:', error);
    return false;
  }
};
