/**
 * Cache utility using node-cache
 * Provides in-memory caching for frequently accessed data
 */
import NodeCache from 'node-cache';

// Create cache instances with different TTLs
export const userCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Don't clone objects for better performance
});

export const authCache = new NodeCache({
  stdTTL: 600, // 10 minutes
  checkperiod: 120,
  useClones: false,
});

export const dataCache = new NodeCache({
  stdTTL: 180, // 3 minutes
  checkperiod: 60,
  useClones: false,
});

/**
 * Generate cache key for user data
 */
export const getUserCacheKey = (userId) => `user:${userId}`;

/**
 * Generate cache key for usage data
 */
export const getUsageCacheKey = (userId) => `usage:${userId}`;

/**
 * Generate cache key for payments
 */
export const getPaymentsCacheKey = (userId, limit = 10) => `payments:${userId}:${limit}`;

/**
 * Invalidate all cache entries for a user
 */
export const invalidateUserCache = (userId) => {
  const keys = [
    getUserCacheKey(userId),
    getUsageCacheKey(userId),
    `payments:${userId}:10`,
  ];
  
  keys.forEach(key => {
    userCache.del(key);
    dataCache.del(key);
  });
  
  console.log(`Cache invalidated for user ${userId}`);
};

/**
 * Clear all caches
 */
export const clearAllCaches = () => {
  userCache.flushAll();
  authCache.flushAll();
  dataCache.flushAll();
  console.log('All caches cleared');
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return {
    user: userCache.getStats(),
    auth: authCache.getStats(),
    data: dataCache.getStats(),
  };
};
