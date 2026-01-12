/**
 * JWT utility functions for decoding tokens
 */

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
export const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Extract user info from JWT token
 * @param {string} token - JWT token
 * @returns {object|null} User info or null
 */
export const getUserFromToken = (token) => {
  const decoded = decodeToken(token);
  if (!decoded) {
    return null;
  }

  return {
    id: decoded.userId || decoded.id,
    email: decoded.email,
    name: decoded.name
  };
};
