import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/apiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { validateEnv } from './config/validateEnv.js';

// Validate environment variables on startup
try {
  validateEnv();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();

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

// CORS configuration - allow client URL and Chrome extension requests
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, or Chrome extensions)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
    
    // Allow Chrome extension origins (chrome-extension://*)
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For extension content scripts, they run in the context of the webpage
    // So we need to allow requests from any origin but validate via token
    // This is safe because we validate the JWT token on every request
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/health', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contact', contactRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
