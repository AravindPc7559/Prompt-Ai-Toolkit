/**
 * User controller for getting user information and usage stats
 */
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { canUseService, getUserUsageStats } from '../services/usageService.js';
import { dataCache, getUsageCacheKey, invalidateUserCache } from '../utils/cache.js';

/**
 * Get current user's usage information
 */
export const getUserUsage = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check cache first
    const cacheKey = getUsageCacheKey(userId);
    const cached = dataCache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for user ${userId}`);
      return res.json(cached);
    }

    // Fetch user first (required for everything else) - with projection
    const user = await User.findById(userId).select('email name freeTrialsUsed isSubscribed subscriptionExpiresAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check subscription expiration before checking service availability
    if (user.isSubscribed && user.subscriptionExpiresAt) {
      const now = new Date();
      if (user.subscriptionExpiresAt <= now) {
        user.isSubscribed = false;
        user.subscriptionExpiresAt = undefined;
        await user.save();
        console.log(`Subscription expired for user ${userId}`);
      }
    }

    // Use Promise.allSettled to handle partial failures gracefully
    // This ensures that if one query fails, others can still succeed
    const [usageCheckResult, statsResult, paymentsResult] = await Promise.allSettled([
      canUseService(userId),
      getUserUsageStats(userId),
      Payment.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('razorpayOrderId razorpayPaymentId amount currency plan status subscriptionExpiresAt createdAt')
        .lean()
    ]);

    // Handle usage check - provide defaults if it fails
    let usageCheck;
    if (usageCheckResult.status === 'fulfilled') {
      usageCheck = usageCheckResult.value;
    } else {
      console.error('Error checking usage:', usageCheckResult.reason);
      usageCheck = { allowed: false, reason: 'error', remainingTrials: 0 };
    }

    // Handle stats - provide defaults if it fails
    let stats;
    if (statsResult.status === 'fulfilled') {
      stats = statsResult.value;
    } else {
      console.error('Error fetching stats:', statsResult.reason);
      stats = { totalUsage: 0, lastUsed: null };
    }

    // Handle payments - provide empty array if it fails
    let payments = [];
    if (paymentsResult.status === 'fulfilled') {
      payments = paymentsResult.value || [];
    } else {
      console.error('Error fetching payments:', paymentsResult.reason);
      payments = [];
    }

    const responseData = {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        freeTrialsUsed: user.freeTrialsUsed || 0,
        freeTrialsRemaining: Math.max(0, 10 - (user.freeTrialsUsed || 0)),
        isSubscribed: user.isSubscribed || false,
        subscriptionExpiresAt: user.subscriptionExpiresAt || null
      },
      usage: {
        canUse: usageCheck.allowed || false,
        reason: usageCheck.reason || 'unknown',
        remainingTrials: usageCheck.remainingTrials || 0,
        requiresSubscription: !usageCheck.allowed && usageCheck.reason === 'trial_exhausted'
      },
      stats: stats,
      payments: payments
    };

    // Cache the response for 3 minutes
    dataCache.set(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Error in getUserUsage:', error);
    next(error);
  }
};
