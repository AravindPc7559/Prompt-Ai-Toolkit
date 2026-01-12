import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Get OpenAI model from environment or use default
export const getModel = () => {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
};

// Validate OpenAI API key
export const validateApiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }
};
