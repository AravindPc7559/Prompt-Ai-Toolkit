/**
 * Authentication controller for user registration, login, and token validation
 */
import { User } from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken, verifyToken } from '../utils/jwt.js';
import { canUseService } from '../services/usageService.js';

/**
 * Register a new user
 */
export const register = async (req, res, next) => {
  try {
    const { email, name, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      name,
      passwordHash
    });

    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }
    // Let asyncHandler catch and handle the error
    throw error;
  }
};

/**
 * Login user
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    // Let asyncHandler catch and handle the error
    throw error;
  }
};

/**
 * Validate a JWT token
 */
export const validateToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: 'Token is required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.json({
        valid: false,
        error: error.message || 'Token is invalid or expired'
      });
    }

    // Get user information
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.json({
        valid: false,
        error: 'User account is inactive'
      });
    }

    // Check subscription expiration before checking service availability
    if (user.isSubscribed && user.subscriptionExpiresAt) {
      const now = new Date();
      if (user.subscriptionExpiresAt <= now) {
        // Subscription has expired - update user status
        user.isSubscribed = false;
        user.subscriptionExpiresAt = undefined;
        await user.save();
        console.log(`Subscription expired for user ${user._id}`);
      }
    }

    // Check if user can use the service (this also checks expiration)
    const usageStatus = await canUseService(user._id);
    
    // Refresh user data to get latest subscription status after potential updates
    const updatedUser = await User.findById(user._id).select('-passwordHash');

    res.json({
      valid: true,
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        freeTrialsUsed: updatedUser.freeTrialsUsed || 0,
        isSubscribed: updatedUser.isSubscribed || false,
        subscriptionExpiresAt: updatedUser.subscriptionExpiresAt || null
      },
      canUseService: usageStatus.allowed,
      message: usageStatus.message || '',
      remainingTrials: usageStatus.remainingTrials || 0
    });
  } catch (error) {
    // Let asyncHandler catch and handle the error
    throw error;
  }
};
