/**
 * Middleware to check usage limits before processing requests
 */
import { canUseService, checkAndUpdateSubscriptionExpiration } from '../services/usageService.js';

/**
 * Middleware to check if user has free trials left or is subscribed
 */
export const checkUsageLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found'
      });
    }

    // Check and update subscription expiration before checking usage
    await checkAndUpdateSubscriptionExpiration(userId);

    const usageCheck = await canUseService(userId);

    if (!usageCheck.allowed) {
      return res.status(403).json({
        error: 'Usage limit exceeded',
        message: usageCheck.message || 'You have exhausted your free trials. Please subscribe to continue.',
        reason: usageCheck.reason,
        requiresSubscription: true
      });
    }

    // Attach usage info to request for controllers
    req.usageInfo = {
      isSubscribed: usageCheck.reason === 'subscribed',
      remainingTrials: usageCheck.remainingTrials || 0
    };

    next();
  } catch (error) {
    next(error);
  }
};
