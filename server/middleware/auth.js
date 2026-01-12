/**
 * Authentication middleware for protecting routes
 */
import { User } from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware to validate JWT token from request
 * Expects token in Authorization header or request body
 */
export const validateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header or request body
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body && req.body.token) {
      token = req.body.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Token is missing'
      });
    }

    // Validate token format
    if (typeof token !== 'string' || token.length < 10) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token format is invalid'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        message: error.message || 'Token is invalid or has expired'
      });
    }

    // Get user information
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User account is inactive',
        message: 'User account has been deactivated'
      });
    }

    // Attach token and user to request for use in controllers
    req.token = token;
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    next(error);
  }
};
