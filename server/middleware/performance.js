/**
 * Performance monitoring middleware
 * Tracks request performance and logs slow requests
 */

/**
 * Track slow requests and log performance metrics
 */
export const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  // Override the end function to measure time
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Add performance header
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.url} - ${duration}ms`, {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id || 'anonymous',
      });
    }
    
    // Log very slow requests (> 3 seconds)
    if (duration > 3000) {
      console.error(`🐌 Very slow request: ${req.method} ${req.url} - ${duration}ms`, {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id || 'anonymous',
        query: req.query,
        body: sanitizeBody(req.body),
      });
    }
    
    // Call the original end function
    originalEnd.apply(res, args);
  };
  
  next();
};

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'razorpay_signature', 'passwordHash'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Memory usage monitoring
 */
export const memoryMonitor = () => {
  const used = process.memoryUsage();
  const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
  
  console.log('📊 Memory Usage:', {
    rss: `${mb(used.rss)} MB`, // Resident Set Size
    heapTotal: `${mb(used.heapTotal)} MB`,
    heapUsed: `${mb(used.heapUsed)} MB`,
    external: `${mb(used.external)} MB`,
  });
  
  // Warn if heap usage is high
  if (used.heapUsed / used.heapTotal > 0.9) {
    console.warn('⚠️ High memory usage detected! Consider restarting or investigating memory leaks.');
  }
};

/**
 * Start memory monitoring (check every 5 minutes)
 */
export const startMemoryMonitoring = () => {
  setInterval(memoryMonitor, 5 * 60 * 1000); // Every 5 minutes
  console.log('📊 Memory monitoring started');
};
