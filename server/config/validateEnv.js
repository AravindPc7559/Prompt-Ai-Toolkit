/**
 * Validate required environment variables
 */
export const validateEnv = () => {
  const required = [
    'JWT_SECRET',
    'MONGODB_URI',
    'OPENAI_API_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters long for production');
  }
  
  // Validate MongoDB URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MONGODB_URI format');
  }
  
  console.log('✅ Environment variables validated');
};
