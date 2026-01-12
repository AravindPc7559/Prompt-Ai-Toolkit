/**
 * Global error handler middleware
 * Must have exactly 4 parameters for Express to recognize it as an error handler
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // If response was already sent, don't try to send again
  if (res.headersSent) {
    return;
  }
  
  // Handle OpenAI API errors
  if (err.status) {
    return res.status(err.status).json({
      error: err.message || 'OpenAI API error',
      details: err.error?.message || err.message
    });
  }
  
  // Handle validation errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message || 'Validation error'
    });
  }
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: errors.join(', ')
    });
  }
  
  // Default error handling
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  return res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Ensure next is always a function
    if (typeof next !== 'function') {
      console.error('Warning: next is not a function in asyncHandler');
      next = (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: err.message || 'Internal server error' });
        }
      };
    }
    
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (typeof next === 'function') {
        next(error);
      } else if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    });
  };
};
