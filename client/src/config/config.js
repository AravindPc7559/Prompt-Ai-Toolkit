/**
 * Client configuration - centralized URL management
 */

// Get API URL from environment variable or use default
export const API_URL = import.meta.env.VITE_API_URL || 'https://aiprompttoolkitbackend-vi1bvpjw.b4a.run';

// Client URLs
export const CLIENT_URLS = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  pricing: '/pricing'
};

/**
 * Get full URL for a client route
 */
export const getClientUrl = (path) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}${path}`;
};

/**
 * Get pricing URL
 */
export const getPricingUrl = () => {
  return getClientUrl(CLIENT_URLS.pricing);
};
