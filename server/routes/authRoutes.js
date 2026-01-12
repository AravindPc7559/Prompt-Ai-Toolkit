import express from 'express';
import { register, login, validateToken } from '../controllers/authController.js';
import { getUserUsage } from '../controllers/userController.js';
import { validateRegisterRequest, validateLoginRequest, validateTokenRequest } from '../middleware/validators.js';
import { validateToken as validateTokenMiddleware } from '../middleware/auth.js';
import { authLimiter, apiLimiter, readOnlyLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /api/register
 * Register a new user with email, name, and password
 */
router.post(
  '/register',
  authLimiter,
  validateRegisterRequest,
  asyncHandler(register)
);

/**
 * POST /api/login
 * Login user with email and password
 */
router.post(
  '/login',
  authLimiter,
  validateLoginRequest,
  asyncHandler(login)
);

/**
 * POST /api/validate-token
 * Validates a JWT token and returns user information if valid
 */
router.post(
  '/validate-token',
  apiLimiter,
  validateTokenRequest,
  asyncHandler(validateToken)
);

/**
 * GET /api/user/usage
 * Get current user's usage information and stats
 * Uses readOnlyLimiter for more lenient rate limiting since this is frequently accessed
 */
router.get(
  '/user/usage',
  readOnlyLimiter,
  validateTokenMiddleware,
  asyncHandler(getUserUsage)
);

export default router;
