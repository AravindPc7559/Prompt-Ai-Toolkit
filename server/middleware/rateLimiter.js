/**
 * Rate limiting middleware
 */
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register)
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
});

/**
 * Rate limiter for API endpoints
 * Prevents abuse of API resources
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for payment endpoints
 * Prevents payment abuse and fraud
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: {
    success: false,
    error: 'Too many payment attempts, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for contact form submissions
 */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 contact submissions per hour
  message: {
    success: false,
    error: 'Too many contact submissions, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for read-only endpoints (dashboard, usage, etc.)
 * More lenient since these are frequently accessed and don't modify data
 */
export const readOnlyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (allows for retries and multiple tabs)
  message: {
    success: false,
    error: 'Too many requests, please try again in a moment'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});
