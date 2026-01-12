import express from 'express';
import { createOrder, verifyPayment, getPaymentStatus } from '../controllers/paymentController.js';
import { validateToken as validateTokenMiddleware } from '../middleware/auth.js';
import { validatePaymentOrder, validatePaymentVerification } from '../middleware/validators.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All payment routes require authentication and rate limiting
router.post(
  '/create-order', 
  paymentLimiter,
  validateTokenMiddleware, 
  validatePaymentOrder,
  asyncHandler(createOrder)
);

router.post(
  '/verify-payment', 
  paymentLimiter,
  validateTokenMiddleware, 
  validatePaymentVerification,
  asyncHandler(verifyPayment)
);

router.get(
  '/payment-status', 
  validateTokenMiddleware, 
  asyncHandler(getPaymentStatus)
);

export default router;
