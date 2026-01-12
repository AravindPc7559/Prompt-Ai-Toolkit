/**
 * Extension configuration - centralized URL and settings management
 */

// Default configuration
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:3000',
  loginUrl: 'http://localhost:5173',
  pricingPath: '/pricing',
  dashboardPath: '/dashboard'
};

/**
 * Get configuration from chrome.storage or return defaults
 */
export const getConfig = async () => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverUrl', 'loginUrl'], (result) => {
      resolve({
        serverUrl: result.serverUrl || DEFAULT_CONFIG.serverUrl,
        loginUrl: result.loginUrl || DEFAULT_CONFIG.loginUrl,
        pricingPath: DEFAULT_CONFIG.pricingPath,
        dashboardPath: DEFAULT_CONFIG.dashboardPath
      });
    });
  });
};

/**
 * Normalize URL by removing trailing slashes
 */
const normalizeUrl = (url) => {
  if (!url) return url;
  return url.replace(/\/+$/, '');
};

/**
 * Get full pricing URL
 */
export const getPricingUrl = async () => {
  const config = await getConfig();
  const baseUrl = normalizeUrl(config.loginUrl);
  return `${baseUrl}${config.pricingPath}`;
};

/**
 * Get full login URL
 */
export const getLoginUrl = async () => {
  const config = await getConfig();
  const baseUrl = normalizeUrl(config.loginUrl);
  return `${baseUrl}/login`;
};

/**
 * Get full dashboard URL
 */
export const getDashboardUrl = async () => {
  const config = await getConfig();
  const baseUrl = normalizeUrl(config.loginUrl);
  return `${baseUrl}${config.dashboardPath}`;
};
