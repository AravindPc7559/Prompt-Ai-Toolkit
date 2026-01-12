import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/prompt-rewriter';

// Enable MongoDB security features
mongoose.set('sanitizeFilter', true); // Prevent NoSQL injection
mongoose.set('sanitizeProjection', true); // Prevent projection injection

/**
 * Connect to MongoDB
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      // These options are recommended for Mongoose 6+
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

export default mongoose;
