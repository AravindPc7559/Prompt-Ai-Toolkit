import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
