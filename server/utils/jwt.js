import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

/**
 * Generate a JWT token for a user
 * @param {Object} payload - Token payload (userId, email, etc.)
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Decode token without verification (for inspection)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
export const decodeToken = (token) => {
  return jwt.decode(token);
};
