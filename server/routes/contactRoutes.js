import express from 'express';
import { submitContact, getUserContacts } from '../controllers/contactController.js';
import { validateToken as validateTokenMiddleware } from '../middleware/auth.js';
import { contactLimiter, apiLimiter, readOnlyLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All contact routes require authentication and rate limiting
router.post('/submit', contactLimiter, validateTokenMiddleware, asyncHandler(submitContact));
router.get('/history', readOnlyLimiter, validateTokenMiddleware, asyncHandler(getUserContacts));

export default router;
