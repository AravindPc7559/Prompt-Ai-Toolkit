import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import responseTime from 'response-time';
import apiRoutes from './routes/apiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { validateEnv } from './config/validateEnv.js';
import { performanceMonitor } from './middleware/performance.js';

// Validate environment variables on startup
try {
  validateEnv();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();

// Compression middleware - compress all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balance between speed and compression ratio
}));

// Response time header - track API performance
app.use(responseTime((req, res, time) => {
  // Log slow requests
  if (time > 1000) {
    console.warn(`⚠️ Slow request: ${req.method} ${req.url} - ${time.toFixed(2)}ms`);
  }
}));

// Security middleware - Helmet for HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false // Allow Razorpay iframes
}));

// CORS configuration - allow all origins
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring
app.use(performanceMonitor);

// HTTP request logging with Morgan
// Custom format to include more details
morgan.token('user-id', (req) => {
  return req.user?.id || 'anonymous';
});

morgan.token('body', (req) => {
  // Don't log sensitive data like passwords
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitized = { ...req.body };
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    if (sanitized.razorpay_signature) sanitized.razorpay_signature = '[REDACTED]';
    return JSON.stringify(sanitized);
  }
  return '-';
});

// Use different formats for development and production
if (process.env.NODE_ENV === 'production') {
  // Production: JSON format for log aggregation
  app.use(morgan(':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'));
} else {
  // Development: Detailed colorful format
  app.use(morgan(':method :url :status :response-time ms - :res[content-length] - :user-id'));
}

// Routes
app.use('/health', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contact', contactRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
