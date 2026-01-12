/**
 * Authentication configuration
 */

export const AUTH_CONFIG = {
  // Default login URL - should be configured via extension settings
  defaultLoginUrl: 'http://localhost:5173/',
  
  // Cookie name for storing the token
  cookieName: 'prompt_rewriter_token',
  
  // Token validation endpoint
  validationEndpoint: '/api/validate-token'
};

/**
 * Get authentication configuration from storage or use defaults
 * @returns {Promise<Object>} Configuration object
 */
export async function getAuthConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['loginUrl', 'cookieName'], (result) => {
      resolve({
        loginUrl: result.loginUrl || AUTH_CONFIG.defaultLoginUrl,
        cookieName: result.cookieName || AUTH_CONFIG.cookieName,
        validationEndpoint: AUTH_CONFIG.validationEndpoint
      });
    });
  });
}
