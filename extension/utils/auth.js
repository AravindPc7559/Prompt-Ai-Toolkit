/**
 * Authentication utilities for token management using Chrome Cookies API
 */

/**
 * Get the authentication token from cookie
 * @returns {Promise<string|null>} The token or null if not found
 */
export async function getToken() {
  try {
    const config = await getAuthConfig();
    const cookie = await chrome.cookies.get({
      url: config.loginUrl,
      name: config.cookieName
    });
    
    return cookie ? cookie.value : null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

/**
 * Check if a token exists
 * @returns {Promise<boolean>} True if token exists
 */
export async function hasToken() {
  const token = await getToken();
  return token !== null && token !== '';
}

/**
 * Delete the authentication token cookie
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteToken() {
  try {
    const config = await getAuthConfig();
    const url = new URL(config.loginUrl);
    const deleted = await chrome.cookies.remove({
      url: config.loginUrl,
      name: config.cookieName
    });
    
    return deleted !== null;
  } catch (error) {
    console.error('Error deleting token:', error);
    return false;
  }
}

/**
 * Get authentication configuration
 * @returns {Promise<Object>} Auth configuration object
 */
async function getAuthConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['loginUrl', 'cookieName'], (result) => {
      resolve({
        loginUrl: result.loginUrl || 'http://localhost:5173/',
        cookieName: result.cookieName || 'prompt_rewriter_token'
      });
    });
  });
}

/**
 * Validate token with backend
 * @param {string} token - The token to validate
 * @returns {Promise<{valid: boolean, user?: Object, error?: string}>}
 */
export async function validateToken(token) {
  try {
    const serverUrl = await new Promise((resolve) => {
      chrome.storage.sync.get(['serverUrl'], (result) => {
        resolve(result.serverUrl || 'http://localhost:3000');
      });
    });

    const response = await fetch(`${serverUrl}/api/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: errorData.error || `Server error: ${response.status}`
      };
    }

    const data = await response.json();
    return {
      valid: data.valid || false,
      user: data.user || null
    };
  } catch (error) {
    console.error('Error validating token:', error);
    return {
      valid: false,
      error: error.message || 'Network error'
    };
  }
}
