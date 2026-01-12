import express from 'express';
import { rewritePrompt } from '../controllers/rewriteController.js';
import { grammarizeText } from '../controllers/grammarController.js';
import { formatEmail } from '../controllers/emailController.js';
import { validateRewriteRequest, validateTextRequest, validateApiKey } from '../middleware/validators.js';
import { validateToken as validateTokenMiddleware } from '../middleware/auth.js';
import { checkUsageLimit } from '../middleware/usageLimit.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rewrite prompt endpoint
router.post(
  '/rewrite-prompt',
  apiLimiter,
  validateTokenMiddleware,
  checkUsageLimit,
  validateApiKey,
  validateRewriteRequest,
  asyncHandler(rewritePrompt)
);

// Grammarize endpoint
router.post(
  '/grammarize',
  apiLimiter,
  validateTokenMiddleware,
  checkUsageLimit,
  validateApiKey,
  validateTextRequest,
  asyncHandler(grammarizeText)
);

// Format Email endpoint
router.post(
  '/format-email',
  apiLimiter,
  validateTokenMiddleware,
  checkUsageLimit,
  validateApiKey,
  validateTextRequest,
  asyncHandler(formatEmail)
);

export default router;
