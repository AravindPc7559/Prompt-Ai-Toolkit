// Background service worker for the extension

import { CONFIG } from './config.js';

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Prompt AI Toolkit extension installed');
    // Set default server URL and auth config
    chrome.storage.sync.set({
      serverUrl: CONFIG.API_URL,
      loginUrl: CONFIG.LOGIN_URL
    });
  }
});

// Monitor storage changes to detect when token is set/removed
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.authToken) {
    try {
      const authenticated = changes.authToken.newValue !== undefined && changes.authToken.newValue !== null;
      notifyAllTabs({ type: 'auth_changed', authenticated });
    } catch (error) {
      console.error('Error handling storage change:', error);
    }
  }
});

/**
 * Notify all content scripts about authentication status change
 */
async function notifyAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that don't have content script loaded
        });
      }
    });
  } catch (error) {
    console.error('Error notifying tabs:', error);
  }
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'check_auth') {
    // Handle auth check requests if needed
    checkAuthStatus().then(authenticated => {
      sendResponse({ authenticated });
    }).catch(error => {
      sendResponse({ authenticated: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  // Handle token set from login website
  if (request.type === 'AUTH_TOKEN_SET') {
    const authData = {
      token: request.token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    chrome.storage.sync.set({
      authToken: authData,
      serverUrl: CONFIG.API_URL
    }, () => {
      console.log('Token stored in extension storage from login website');
      notifyAllTabs({ type: 'auth_changed', authenticated: true });
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  return true;
});

/**
 * Check authentication status
 */
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.sync.get(['loginUrl', 'cookieName']);
    const loginUrl = result.loginUrl || CONFIG.LOGIN_URL;
    const cookieName = result.cookieName || 'prompt_rewriter_token';

    const cookie = await chrome.cookies.get({
      url: loginUrl,
      name: cookieName
    });

    return cookie !== null && cookie.value !== null && cookie.value !== '';
  } catch (error) {
    console.error('Error checking auth status:', error);
    return false;
  }
}
