// Content script to show floating popup on text selection and rewrite prompts

// Import config utilities
let configUtils = null;
(async () => {
  try {
    // For Chrome extensions, we'll use a different approach since content scripts can't use ES6 imports directly
    // Config functions are defined inline below
  } catch (e) {
    console.error('Error loading config utils:', e);
  }
})();

let floatingPopup = null;
let grammarPopup = null;
let emailPopup = null;
let loginPopup = null;
let selectionTimeout = null;
let isProcessingRewrite = false;
let isProcessingGrammar = false;
let isProcessingEmail = false;
let authToken = null;
let isAuthenticated = false;
let extensionContextValid = true;

/**
 * Check if extension context is still valid
 * This prevents "Extension context invalidated" errors
 */
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime.id - if this throws, context is invalid
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Safely access chrome.storage with error handling
 */
function safeChromeStorage(operation) {
  return new Promise((resolve, reject) => {
    if (!isExtensionContextValid()) {
      extensionContextValid = false;
      reject(new Error('Extension context invalidated'));
      return;
    }
    
    try {
      operation((result) => {
        // Check if there was a runtime error
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          if (error && error.includes('Extension context invalidated')) {
            extensionContextValid = false;
            reject(new Error('Extension context invalidated'));
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          resolve(result);
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
      }
      reject(e);
    }
  });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Listen for text selection
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('selectionchange', handleSelectionChange);
  
  // Listen for auth token from login website
  window.addEventListener('promptRewriterAuth', handleAuthToken);
  
  // Listen for logout event from login website
  window.addEventListener('promptRewriterLogout', handleLogout);
  
  // Listen for storage changes (when token is updated from other tabs/pages)
  if (isExtensionContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (!isExtensionContextValid()) {
          return; // Don't process if context is invalid
        }
        
        if (areaName === 'sync' && changes.authToken) {
          console.log('Auth token changed in storage, re-checking auth status');
          const newToken = changes.authToken.newValue;
          
          if (newToken && newToken.token) {
            // Token was added or updated
            authToken = newToken.token;
            isAuthenticated = true;
            checkAuthStatus().then((status) => {
              console.log('Auth status after storage change:', status);
              // Re-check selection if there's one
              setTimeout(() => {
                checkSelection();
              }, 100);
            }).catch((err) => {
              if (!err.message || !err.message.includes('Extension context invalidated')) {
                console.error('Error checking auth status after storage change:', err);
              }
            });
          } else {
            // Token was removed
            authToken = null;
            isAuthenticated = false;
            hideFloatingPopup();
          }
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
        console.warn('Extension context invalidated, storage listener not available');
      }
    }
  }
  
  // Check if we're on the client origin and sync token from localStorage
  syncTokenFromLocalStorage();
  
  // Also periodically check for token sync (in case event was missed)
  // This helps when user logs in and then navigates to another page
  const syncInterval = setInterval(() => {
    if (!isExtensionContextValid()) {
      clearInterval(syncInterval);
      return;
    }
    syncTokenFromLocalStorage();
  }, 2000); // Check every 2 seconds
  
  // Also check for existing token in storage on page load
  checkAuthStatus().then((status) => {
    console.log('Initial auth check on page load:', status);
  }).catch((err) => {
    console.error('Error in initial auth check:', err);
  });
  
  // Add CSS styles first
  addStyles();
}

/**
 * Sync token from localStorage to chrome.storage.sync
 * This allows the token to be accessible from other websites
 * Checks on any page that has access to localStorage (same origin as login page)
 */
async function syncTokenFromLocalStorage() {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      return; // Silently return if context is invalid
    }
    
    // Check if we're on the same origin as the login page (localhost:5173)
    const isClientOrigin = window.location.hostname === 'localhost' && 
                          (window.location.port === '5173' || window.location.port === '');
    
    if (isClientOrigin) {
      // Check localStorage for token
      const authDataStr = localStorage.getItem('authToken');
      if (authDataStr) {
        try {
          const authData = JSON.parse(authDataStr);
          if (authData && authData.token) {
            // Sync to chrome.storage.sync
            const config = await getConfig();
            
            try {
              await safeChromeStorage((callback) => {
                chrome.storage.sync.set({
                  authToken: authData,
                  serverUrl: config.serverUrl
                }, callback);
              });
              
              console.log('Token synced from localStorage to extension storage');
              // Update local state
              authToken = authData.token;
              isAuthenticated = true;
              // Re-check auth status to get service availability
              checkAuthStatus().then((status) => {
                console.log('Auth status after sync:', status);
              }).catch((err) => {
                if (!err.message || !err.message.includes('Extension context invalidated')) {
                  console.error('Error checking auth status after sync:', err);
                }
              });
            } catch (e) {
              if (e.message && e.message.includes('Extension context invalidated')) {
                extensionContextValid = false;
                console.warn('Extension context invalidated, cannot sync token');
              } else {
                console.error('Error syncing token to chrome.storage:', e);
              }
            }
          }
        } catch (e) {
          if (e.message && !e.message.includes('Extension context invalidated')) {
            console.error('Error parsing auth data from localStorage:', e);
          }
        }
      } else {
        // If localStorage doesn't have token, clear chrome.storage.sync too
        try {
          await safeChromeStorage((callback) => {
            chrome.storage.sync.remove(['authToken'], callback);
          });
          console.log('Token cleared from extension storage (localStorage empty)');
          authToken = null;
          isAuthenticated = false;
        } catch (e) {
          if (e.message && !e.message.includes('Extension context invalidated')) {
            console.error('Error clearing token from chrome.storage:', e);
          }
        }
      }
    }
  } catch (error) {
    if (error.message && !error.message.includes('Extension context invalidated')) {
      console.error('Error syncing token from localStorage:', error);
    }
  }
}

/**
 * Handle auth token from login website
 */
async function handleAuthToken(event) {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated, cannot handle auth token');
      return;
    }
    
    const { token, serverUrl } = event.detail;
    console.log('Received auth token event:', { hasToken: !!token, serverUrl });
    
    if (!token) {
      console.error('No token in event detail');
      return;
    }
    
    const authData = {
      token: token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    
    // Use provided serverUrl or get from config
    const config = await getConfig();
    const finalServerUrl = serverUrl || config.serverUrl;
    
    try {
      await safeChromeStorage((callback) => {
        chrome.storage.sync.set({
          authToken: authData,
          serverUrl: finalServerUrl
        }, callback);
      });
      
      console.log('Token stored in extension storage from login website');
      // Update local state
      authToken = token;
      isAuthenticated = true;
      console.log('Auth state updated - authenticated:', isAuthenticated);
      
      // Force a re-check of auth status to get service availability
      checkAuthStatus().then((status) => {
        console.log('Auth status after login:', status);
        // If we have a selection, re-check it to show icons
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const selectedText = selection.toString().trim();
          if (selectedText.length >= 5) {
            const range = selection.getRangeAt(0);
            if (range && !range.collapsed && isSelectionInFormField(range)) {
              // Re-check selection to show appropriate icons
              setTimeout(() => {
                checkSelection();
              }, 100);
            }
          }
        }
      }).catch((err) => {
        if (!err.message || !err.message.includes('Extension context invalidated')) {
          console.error('Error checking auth status after login:', err);
        }
      });
      
      // Notify background script
      if (isExtensionContextValid()) {
        chrome.runtime.sendMessage({
          type: 'AUTH_TOKEN_SET',
          token: token
        }).catch(() => {
          // Ignore errors
        });
      }
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
        console.warn('Extension context invalidated, cannot store token');
      } else {
        console.error('Error storing token:', e);
      }
    }
  } catch (error) {
    if (error.message && !error.message.includes('Extension context invalidated')) {
      console.error('Error handling auth token:', error);
    }
  }
}

/**
 * Handle logout event from login website
 */
async function handleLogout() {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      // Update local state even if context is invalid
      authToken = null;
      isAuthenticated = false;
      hideFloatingPopup();
      return;
    }
    
    // Clear token from chrome.storage.sync
    try {
      await safeChromeStorage((callback) => {
        chrome.storage.sync.remove(['authToken'], callback);
      });
      
      console.log('Token removed from extension storage on logout');
      // Update local state
      authToken = null;
      isAuthenticated = false;
      
      // Hide any visible popups
      hideFloatingPopup();
      
      // Notify background script
      if (isExtensionContextValid()) {
        chrome.runtime.sendMessage({
          type: 'AUTH_TOKEN_REMOVED'
        }).catch(() => {
          // Ignore errors
        });
      }
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
      }
      // Still update local state
      authToken = null;
      isAuthenticated = false;
      hideFloatingPopup();
    }
  } catch (error) {
    if (error.message && !error.message.includes('Extension context invalidated')) {
      console.error('Error handling logout:', error);
    }
    // Still update local state
    authToken = null;
    isAuthenticated = false;
    hideFloatingPopup();
  }
}

function handleMouseUp() {
  clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    checkSelection();
  }, 100);
}

function handleSelectionChange() {
  clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    checkSelection();
  }, 100);
}

async function checkSelection() {
  try {
    // Don't show popup if we're currently processing
    if (isProcessingRewrite || isProcessingGrammar || isProcessingEmail) {
      return;
    }
    
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      hideFloatingPopup();
      return;
    }
    
    const selectedText = selection.toString().trim();
    
    if (selectedText.length >= 5) {
      const range = selection.getRangeAt(0);
      if (range && !range.collapsed) {
        // Only show popup if selection is in a form field
        if (isSelectionInFormField(range)) {
          // Check authentication status before showing popup
          // If check fails, show login button as fallback
          let authStatus = { authenticated: false, canUseService: false };
          try {
            authStatus = await checkAuthStatus();
            console.log('Auth check result:', authStatus);
          } catch (error) {
            console.error('Error checking auth status:', error);
            authStatus = { authenticated: false, canUseService: false };
          }
          
          if (authStatus.authenticated) {
            if (authStatus.canUseService) {
              console.log('User authenticated and can use service, showing icons');
              showFloatingPopup(range, selectedText);
            } else {
              console.log('User authenticated but cannot use service, showing purchase icon');
              showPurchaseIcon(range, selectedText, authStatus.message || 'Free trial exhausted. Please subscribe to continue.');
            }
          } else {
            console.log('User not authenticated, showing login button');
            showLoginButton(range, selectedText);
          }
        } else {
          hideFloatingPopup();
        }
      }
    } else {
      hideFloatingPopup();
    }
  } catch (error) {
    console.error('Error in checkSelection:', error);
    // On error, try to show login button as fallback
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const selectedText = selection.toString().trim();
        if (selectedText.length >= 5) {
          const range = selection.getRangeAt(0);
          if (range && !range.collapsed && isSelectionInFormField(range)) {
            showLoginButton(range, selectedText);
          }
        }
      }
    } catch (fallbackError) {
      console.error('Error in fallback:', fallbackError);
    }
  }
}

function isSelectionInFormField(range) {
  if (!range || range.collapsed) {
    return false;
  }
  
  // Get the common ancestor container
  let container = range.commonAncestorContainer;
  
  // If it's a text node, get its parent
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement;
  }
  
  // If container is not an element, return false
  if (!container || container.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  
  // Helper function to check if an element is a form field
  function isFormFieldElement(el) {
    if (!el || !el.nodeType || el.nodeType !== Node.ELEMENT_NODE) return false;
    
    // Check for textarea
    if (el.tagName === 'TEXTAREA') {
      return true;
    }
    
    // Check for input fields (editable types)
    if (el.tagName === 'INPUT') {
      const inputType = (el.type || '').toLowerCase();
      const editableTypes = ['text', 'email', 'search', 'url', 'tel', 'password', 'number'];
      // If no type specified, default to text (editable)
      if (!inputType || editableTypes.includes(inputType)) {
        return true;
      }
    }
    
    // Check for contenteditable elements (including partial matches)
    const contentEditable = el.contentEditable;
    if (contentEditable === 'true' || contentEditable === true || el.isContentEditable) {
      return true;
    }
    
    // Check for role="textbox" (common in React/Vue components)
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'combobox' || role === 'searchbox') {
      return true;
    }
    
    // Check for aria attributes that indicate editable fields
    const ariaMultiline = el.getAttribute && el.getAttribute('aria-multiline');
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaMultiline === 'true' || (ariaLabel && (ariaLabel.toLowerCase().includes('input') || ariaLabel.toLowerCase().includes('text')))) {
      // Additional check: make sure it's actually editable
      if (el.contentEditable === 'true' || el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'email', 'search', 'url', 'tel', 'password'].includes((el.type || '').toLowerCase()))) {
        return true;
      }
    }
    
    // Check for common form field classes/attributes used in frameworks
    const className = el.className || '';
    if (typeof className === 'string') {
      const lowerClass = className.toLowerCase();
      // Expanded list of common form field class patterns
      if (lowerClass.includes('textarea') || 
          lowerClass.includes('input-field') || 
          lowerClass.includes('text-input') ||
          lowerClass.includes('form-control') ||
          lowerClass.includes('form-input') ||
          lowerClass.includes('editable') ||
          lowerClass.includes('editor') ||
          lowerClass.includes('ql-editor') || // Quill editor
          lowerClass.includes('ce-paragraph') || // ContentEditable patterns
          lowerClass.includes('contenteditable') ||
          lowerClass.includes('input-text') ||
          lowerClass.includes('textfield') ||
          lowerClass.includes('text-field') ||
          lowerClass.includes('input-text') ||
          lowerClass.includes('cm-editor') || // CodeMirror
          lowerClass.includes('monaco-editor') || // Monaco editor
          lowerClass.includes('ace_editor') || // Ace editor
          lowerClass.includes('wysiwyg') ||
          lowerClass.includes('rich-text') ||
          lowerClass.includes('rich-text-editor') ||
          lowerClass.includes('prosemirror') || // ProseMirror
          lowerClass.includes('slate') || // Slate editor
          lowerClass.includes('draft') || // Draft.js
          lowerClass.includes('lexical') || // Lexical editor
          lowerClass.includes('tiptap')) { // Tiptap editor
        return true;
      }
    }
    
    // Check for ID patterns that might indicate editable fields
    const id = el.id || '';
    if (typeof id === 'string' && id.length > 0) {
      const lowerId = id.toLowerCase();
      if (lowerId.includes('input') || 
          lowerId.includes('textarea') || 
          lowerId.includes('editor') ||
          lowerId.includes('textfield') ||
          lowerId.includes('prompt') ||
          lowerId.includes('message')) {
        // Additional verification: check if it's actually editable
        if (el.contentEditable === 'true' || el.isContentEditable || 
            el.tagName === 'TEXTAREA' || 
            (el.tagName === 'INPUT' && ['text', 'email', 'search', 'url', 'tel', 'password'].includes((el.type || '').toLowerCase()))) {
          return true;
        }
      }
    }
    
    // Check for data attributes that might indicate editable fields
    if (el.getAttribute) {
      const dataEditable = el.getAttribute('data-editable');
      const dataContentEditable = el.getAttribute('data-contenteditable');
      if (dataEditable === 'true' || dataContentEditable === 'true') {
        return true;
      }
    }
    
    // Check if element can receive focus and is likely editable
    // This is a fallback for complex frameworks
    try {
      const tabIndex = el.getAttribute && el.getAttribute('tabindex');
      if (tabIndex !== null && tabIndex !== '-1') {
        // Check if it's likely an input by checking if it can be focused
        // and has text selection capability
        if (el.contentEditable === 'true' || el.isContentEditable) {
          return true;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return false;
  }
  
  // Traverse up the DOM tree to find form fields
  let element = container;
  let depth = 0;
  const maxDepth = 30; // Increased depth for complex nested structures
  
  while (element && depth < maxDepth) {
    // Check current element
    if (isFormFieldElement(element)) {
      return true;
    }
    
    // Check if element is inside shadow DOM
    try {
      const rootNode = element.getRootNode ? element.getRootNode() : null;
      if (rootNode instanceof ShadowRoot) {
        const shadowHost = rootNode.host;
        if (shadowHost && isFormFieldElement(shadowHost)) {
          return true;
        }
        // Also check elements within shadow DOM
        if (isFormFieldElement(element)) {
          return true;
        }
      }
    } catch (e) {
      // Ignore shadow DOM errors
    }
    
    // Move to parent element
    element = element.parentElement;
    depth++;
    
    // Stop if we've reached the body or html element
    if (!element || element.tagName === 'BODY' || element.tagName === 'HTML') {
      break;
    }
  }
  
  // Final fallback: check if the selection is within an element that can be edited
  // This handles edge cases where frameworks use non-standard structures
  try {
    const startContainer = range.startContainer;
    let checkElement = startContainer.nodeType === Node.TEXT_NODE 
      ? startContainer.parentElement 
      : startContainer;
    
    while (checkElement && checkElement !== document.body) {
      // Check if element or any parent has contenteditable
      if (checkElement.contentEditable === 'true' || checkElement.isContentEditable) {
        return true;
      }
      // Check if it's an input or textarea
      if (checkElement.tagName === 'INPUT' || checkElement.tagName === 'TEXTAREA') {
        return true;
      }
      // More aggressive check: if element can receive focus and has text selection,
      // it's likely editable (common in modern frameworks)
      try {
        if (checkElement.focus && typeof checkElement.focus === 'function') {
          // Check if it has a value property or textContent that can be modified
          if ('value' in checkElement || checkElement.textContent !== undefined) {
            // Additional check: see if it's in a form-like context
            const parent = checkElement.parentElement;
            if (parent && (
              parent.tagName === 'FORM' || 
              parent.getAttribute('role') === 'form' ||
              parent.className && typeof parent.className === 'string' && 
                (parent.className.toLowerCase().includes('form') || 
                 parent.className.toLowerCase().includes('input') ||
                 parent.className.toLowerCase().includes('editor'))
            )) {
              return true;
            }
          }
        }
      } catch (e) {
        // Ignore focus check errors
      }
      checkElement = checkElement.parentElement;
    }
  } catch (e) {
    // Ignore errors in fallback
  }
  
  return false;
}

/**
 * Check authentication status and validate token
 * @returns {Promise<boolean>} True if user is authenticated
 */
async function checkAuthStatus() {
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      return { authenticated: false, canUseService: false };
    }
    
    // Get token from chrome.storage (JWT token stored after login)
    let result;
    try {
      result = await safeChromeStorage((callback) => {
        chrome.storage.sync.get(['authToken'], callback);
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        extensionContextValid = false;
        return { authenticated: false, canUseService: false };
      }
      throw e;
    }
    
    if (!result.authToken || !result.authToken.token) {
      console.log('No token found in storage');
      authToken = null;
      isAuthenticated = false;
      return { authenticated: false, canUseService: false };
    }
    
    const token = result.authToken.token;
    
    // If we already have a valid token in memory and it matches, we still need to check service availability
    // So we'll proceed to validate with backend to get latest status
    
    const serverUrl = await getServerUrl();
    
    if (!serverUrl) {
      console.error('Server URL not configured');
      return { authenticated: false, canUseService: false };
    }
    
    // Validate token with backend
    const response = await fetch(`${serverUrl}/api/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      // Add mode and credentials for CORS
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      console.log('Token validation failed, response not ok:', response.status);
      // Token is invalid, delete it
      await deleteToken();
      authToken = null;
      isAuthenticated = false;
      return { authenticated: false, canUseService: false };
    }
    
    const data = await response.json();
    if (data.valid) {
      console.log('Token is valid, user authenticated');
      authToken = token;
      isAuthenticated = true;
      // Return object with auth status and service availability
      return {
        authenticated: true,
        canUseService: data.canUseService || false,
        message: data.message || '',
        remainingTrials: data.remainingTrials || 0
      };
    } else {
      console.log('Token validation returned invalid');
      await deleteToken();
      authToken = null;
      isAuthenticated = false;
      return { authenticated: false, canUseService: false };
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    
    // Provide more detailed error information
    if (error.message && error.message.includes('Failed to fetch')) {
      const serverUrl = await getServerUrl().catch(() => 'unknown');
      console.error('Network error - check if server is running at:', serverUrl);
      console.error('This could be due to:');
      console.error('1. Server is not running');
      console.error('2. CORS configuration blocking the request');
      console.error('3. Network connectivity issues');
    }
    
    // On error, don't block - show login button
    authToken = null;
    isAuthenticated = false;
    return { authenticated: false, canUseService: false };
  }
}

/**
 * Get configuration from chrome.storage
 */
async function getConfig() {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    // Return default config if context is invalid
    return {
      serverUrl: 'http://localhost:3000',
      loginUrl: 'http://localhost:5173',
      pricingPath: '/pricing',
      dashboardPath: '/dashboard'
    };
  }
  
  try {
    const result = await safeChromeStorage((callback) => {
      chrome.storage.sync.get(['serverUrl', 'loginUrl'], callback);
    });
    
    return {
      serverUrl: result.serverUrl || 'http://localhost:3000',
      loginUrl: result.loginUrl || 'http://localhost:5173',
      pricingPath: '/pricing',
      dashboardPath: '/dashboard'
    };
  } catch (e) {
    if (e.message && e.message.includes('Extension context invalidated')) {
      extensionContextValid = false;
    }
    // Return default config on error
    return {
      serverUrl: 'http://localhost:3000',
      loginUrl: 'http://localhost:5173',
      pricingPath: '/pricing',
      dashboardPath: '/dashboard'
    };
  }
}

/**
 * Get server URL
 */
async function getServerUrl() {
  try {
    const config = await getConfig();
    const url = config.serverUrl || 'http://localhost:3000';
    
    // Validate URL format
    if (!url || typeof url !== 'string') {
      console.error('Invalid server URL:', url);
      return 'http://localhost:3000'; // Fallback
    }
    
    // Remove trailing slash
    return url.replace(/\/$/, '');
  } catch (error) {
    console.error('Error getting server URL:', error);
    return 'http://localhost:3000'; // Fallback
  }
}

/**
 * Get pricing URL
 */
/**
 * Normalize URL by removing trailing slashes
 */
function normalizeUrl(url) {
  if (!url) return url;
  return url.replace(/\/+$/, '');
}

async function getPricingUrl() {
  const config = await getConfig();
  const baseUrl = normalizeUrl(config.loginUrl);
  return `${baseUrl}${config.pricingPath}`;
}

/**
 * Get login URL
 */
async function getLoginUrl() {
  const config = await getConfig();
  const baseUrl = normalizeUrl(config.loginUrl);
  return `${baseUrl}/login`;
}

/**
 * Delete token from storage
 */
async function deleteToken() {
  try {
    if (!isExtensionContextValid()) {
      return; // Silently return if context is invalid
    }
    
    await safeChromeStorage((callback) => {
      chrome.storage.sync.remove(['authToken'], callback);
    });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextValid = false;
      // Silently handle - extension will reload
    } else {
      console.error('Error deleting token:', error);
    }
  }
}

/**
 * Redirect to login website
 */
async function redirectToLogin() {
  try {
    const loginUrl = await getLoginUrl();
    window.open(loginUrl, '_blank');
  } catch (error) {
    console.error('Error redirecting to login:', error);
  }
}

/**
 * Redirect to pricing page
 */
async function redirectToPricing() {
  try {
    const pricingUrl = await getPricingUrl();
    window.open(pricingUrl, '_blank');
  } catch (error) {
    console.error('Error redirecting to pricing:', error);
  }
}

/**
 * Show login button instead of feature icons
 */
function showLoginButton(range, selectedText) {
  hideFloatingPopup();
  
  try {
    // Get the position of the first character/word in the selection
    const firstCharRange = range.cloneRange();
    firstCharRange.collapse(true);
    
    let firstCharRect;
    try {
      const testRange = range.cloneRange();
      testRange.collapse(true);
      testRange.setEnd(testRange.startContainer, Math.min(testRange.startOffset + 1, testRange.startContainer.textContent?.length || 1));
      firstCharRect = testRange.getBoundingClientRect();
    } catch (e) {
      firstCharRect = range.getBoundingClientRect();
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = startContainer;
        const tempRange = document.createRange();
        tempRange.setStart(textNode, range.startOffset);
        tempRange.setEnd(textNode, Math.min(range.startOffset + 1, textNode.textContent.length));
        firstCharRect = tempRange.getBoundingClientRect();
      } else {
        firstCharRect = range.getBoundingClientRect();
      }
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      return;
    }
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const iconSize = 40;
    let left = firstCharRect.left + scrollX - 5;
    let top = firstCharRect.top + scrollY - iconSize - 8;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minMargin = 10;
    
    // Create login button
    loginPopup = document.createElement('button');
    loginPopup.id = 'prompt-login-popup';
    loginPopup.className = 'pr-icon-btn pr-login-btn';
    loginPopup.innerHTML = '<span class="pr-icon-emoji">🔐</span><span class="pr-tooltip">Login Required</span>';
    
    loginPopup.style.left = `${Math.round(left)}px`;
    loginPopup.style.top = `${Math.round(top)}px`;
    
    // Adjust if button goes outside viewport
    if (left + iconSize > scrollX + viewportWidth - minMargin) {
      left = scrollX + viewportWidth - iconSize - minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (left < scrollX + minMargin) {
      left = scrollX + minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (top < scrollY + minMargin) {
      top = firstCharRect.bottom + scrollY + 8;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    if (top + iconSize > scrollY + viewportHeight - minMargin) {
      top = scrollY + viewportHeight - iconSize - minMargin;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    document.body.appendChild(loginPopup);
    
    loginPopup.addEventListener('click', async (e) => {
      e.stopPropagation();
      await redirectToLogin();
    });
    
    setTimeout(() => {
      const handleClick = (e) => {
        if (loginPopup && !loginPopup.contains(e.target)) {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < 5) {
            hideFloatingPopup();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('mousedown', handleClick, true);
          }
        }
      };
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mousedown', handleClick, true);
    }, 50);
    
  } catch (error) {
    console.error('Error showing login button:', error);
  }
}

/**
 * Show purchase icon when user is logged in but trial exhausted and not subscribed
 * This is shown when user selects text (before trying to use a feature)
 */
function showPurchaseIcon(range, selectedText, message = 'Free trial exhausted. Please subscribe to continue.') {
  hideFloatingPopup();
  
  try {
    // Get the position of the first character/word in the selection
    const firstCharRange = range.cloneRange();
    firstCharRange.collapse(true);
    
    let firstCharRect;
    try {
      const testRange = range.cloneRange();
      testRange.collapse(true);
      testRange.setEnd(testRange.startContainer, Math.min(testRange.startOffset + 1, testRange.startContainer.textContent?.length || 1));
      firstCharRect = testRange.getBoundingClientRect();
    } catch (e) {
      firstCharRect = range.getBoundingClientRect();
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = startContainer;
        const tempRange = document.createRange();
        tempRange.setStart(textNode, range.startOffset);
        tempRange.setEnd(textNode, Math.min(range.startOffset + 1, textNode.textContent.length));
        firstCharRect = tempRange.getBoundingClientRect();
      } else {
        firstCharRect = range.getBoundingClientRect();
      }
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      return;
    }
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const iconSize = 40;
    let left = firstCharRect.left + scrollX - 5;
    let top = firstCharRect.top + scrollY - iconSize - 8;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minMargin = 10;
    
    // Create purchase button
    loginPopup = document.createElement('button');
    loginPopup.id = 'prompt-purchase-popup';
    loginPopup.className = 'pr-icon-btn pr-subscription-btn';
    loginPopup.innerHTML = `<span class="pr-icon-emoji">💳</span><span class="pr-tooltip">${message}</span>`;
    
    loginPopup.style.left = `${Math.round(left)}px`;
    loginPopup.style.top = `${Math.round(top)}px`;
    
    // Adjust if button goes outside viewport
    if (left + iconSize > scrollX + viewportWidth - minMargin) {
      left = scrollX + viewportWidth - iconSize - minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (left < scrollX + minMargin) {
      left = scrollX + minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (top < scrollY + minMargin) {
      top = firstCharRect.bottom + scrollY + 8;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    if (top + iconSize > scrollY + viewportHeight - minMargin) {
      top = scrollY + viewportHeight - iconSize - minMargin;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    document.body.appendChild(loginPopup);
    
    loginPopup.addEventListener('click', async (e) => {
      e.stopPropagation();
      await redirectToPricing();
    });
    
    setTimeout(() => {
      const handleClick = (e) => {
        if (loginPopup && !loginPopup.contains(e.target)) {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < 5) {
            hideFloatingPopup();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('mousedown', handleClick, true);
          }
        }
      };
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mousedown', handleClick, true);
    }, 50);
    
  } catch (error) {
    console.error('Error showing purchase icon:', error);
  }
}

/**
 * Show subscription required button when free trial is exhausted
 * (This is called when user tries to use a feature and gets 403 error)
 */
function showSubscriptionRequired(range, selectedText, message) {
  hideFloatingPopup();
  
  try {
    // Get the position of the first character/word in the selection
    const firstCharRange = range.cloneRange();
    firstCharRange.collapse(true);
    
    let firstCharRect;
    try {
      const testRange = range.cloneRange();
      testRange.collapse(true);
      testRange.setEnd(testRange.startContainer, Math.min(testRange.startOffset + 1, testRange.startContainer.textContent?.length || 1));
      firstCharRect = testRange.getBoundingClientRect();
    } catch (e) {
      firstCharRect = range.getBoundingClientRect();
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = startContainer;
        const tempRange = document.createRange();
        tempRange.setStart(textNode, range.startOffset);
        tempRange.setEnd(textNode, Math.min(range.startOffset + 1, textNode.textContent.length));
        firstCharRect = tempRange.getBoundingClientRect();
      } else {
        firstCharRect = range.getBoundingClientRect();
      }
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      return;
    }
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const iconSize = 40;
    let left = firstCharRect.left + scrollX - 5;
    let top = firstCharRect.top + scrollY - iconSize - 8;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minMargin = 10;
    
    // Create subscription required button
    loginPopup = document.createElement('button');
    loginPopup.id = 'prompt-subscription-popup';
    loginPopup.className = 'pr-icon-btn pr-subscription-btn';
    loginPopup.innerHTML = '<span class="pr-icon-emoji">💳</span><span class="pr-tooltip">Subscribe Required</span>';
    
    loginPopup.style.left = `${Math.round(left)}px`;
    loginPopup.style.top = `${Math.round(top)}px`;
    
    // Adjust if button goes outside viewport
    if (left + iconSize > scrollX + viewportWidth - minMargin) {
      left = scrollX + viewportWidth - iconSize - minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (left < scrollX + minMargin) {
      left = scrollX + minMargin;
      loginPopup.style.left = `${Math.round(left)}px`;
    }
    
    if (top < scrollY + minMargin) {
      top = firstCharRect.bottom + scrollY + 8;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    if (top + iconSize > scrollY + viewportHeight - minMargin) {
      top = scrollY + viewportHeight - iconSize - minMargin;
      loginPopup.style.top = `${Math.round(top)}px`;
    }
    
    document.body.appendChild(loginPopup);
    
    loginPopup.addEventListener('click', async (e) => {
      e.stopPropagation();
      await redirectToPricing();
    });
    
    setTimeout(() => {
      const handleClick = (e) => {
        if (loginPopup && !loginPopup.contains(e.target)) {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < 5) {
            hideFloatingPopup();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('mousedown', handleClick, true);
          }
        }
      };
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mousedown', handleClick, true);
    }, 50);
    
  } catch (error) {
    console.error('Error showing subscription required button:', error);
  }
}

function showFloatingPopup(range, selectedText) {
  hideFloatingPopup();
  
  try {
    // Get the position of the first character/word in the selection
    const firstCharRange = range.cloneRange();
    firstCharRange.collapse(true); // Collapse to start
    
    // Try to get the bounding rect of the first character
    let firstCharRect;
    try {
      // Create a range for just the first character
      const testRange = range.cloneRange();
      testRange.collapse(true);
      testRange.setEnd(testRange.startContainer, Math.min(testRange.startOffset + 1, testRange.startContainer.textContent?.length || 1));
      firstCharRect = testRange.getBoundingClientRect();
    } catch (e) {
      // Fallback to the start position
      firstCharRect = range.getBoundingClientRect();
    }
    
    // If we can't get first char rect, use the start container position
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      // Try to get position from start container
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = startContainer;
        const tempRange = document.createRange();
        tempRange.setStart(textNode, range.startOffset);
        tempRange.setEnd(textNode, Math.min(range.startOffset + 1, textNode.textContent.length));
        firstCharRect = tempRange.getBoundingClientRect();
      } else {
        firstCharRect = range.getBoundingClientRect();
      }
    }
    
    if (!firstCharRect || (firstCharRect.width === 0 && firstCharRect.height === 0)) {
      return;
    }
    
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const iconSize = 40;
    const iconGap = 8;
    
    // Position at the top beginning of the first character
    let left = firstCharRect.left + scrollX - 5; // Slightly to the left of first char
    let top = firstCharRect.top + scrollY - iconSize - 8; // Above the first line
    
    // Keep within viewport horizontally
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minMargin = 10;
    
    // Create rewrite icon with tooltip
    floatingPopup = document.createElement('button');
    floatingPopup.id = 'prompt-rewriter-popup';
    floatingPopup.className = 'pr-icon-btn';
    floatingPopup.innerHTML = '<span class="pr-icon-emoji">✨</span><span class="pr-tooltip">Refine Prompt</span>';
    
    floatingPopup.style.left = `${Math.round(left)}px`;
    floatingPopup.style.top = `${Math.round(top)}px`;
    
    // Create grammar icon with tooltip (positioned next to rewrite icon)
    grammarPopup = document.createElement('button');
    grammarPopup.id = 'prompt-grammar-popup';
    grammarPopup.className = 'pr-icon-btn pr-grammar-btn';
    grammarPopup.innerHTML = '<span class="pr-icon-emoji">✏️</span><span class="pr-tooltip">Grammarize</span>';
    
    grammarPopup.style.left = `${Math.round(left + iconSize + iconGap)}px`;
    grammarPopup.style.top = `${Math.round(top)}px`;
    
    // Create email icon with tooltip (positioned next to grammar icon)
    emailPopup = document.createElement('button');
    emailPopup.id = 'prompt-email-popup';
    emailPopup.className = 'pr-icon-btn pr-email-btn';
    emailPopup.innerHTML = '<span class="pr-icon-emoji">📧</span><span class="pr-tooltip">Format Email</span>';
    
    emailPopup.style.left = `${Math.round(left + (iconSize * 2) + (iconGap * 2))}px`;
    emailPopup.style.top = `${Math.round(top)}px`;
    
    // Adjust if icons go outside viewport
    const totalWidth = (iconSize * 3) + (iconGap * 2);
    if (left + totalWidth > scrollX + viewportWidth - minMargin) {
      left = scrollX + viewportWidth - totalWidth - minMargin;
      floatingPopup.style.left = `${Math.round(left)}px`;
      grammarPopup.style.left = `${Math.round(left + iconSize + iconGap)}px`;
      emailPopup.style.left = `${Math.round(left + (iconSize * 2) + (iconGap * 2))}px`;
    }
    
    if (left < scrollX + minMargin) {
      left = scrollX + minMargin;
      floatingPopup.style.left = `${Math.round(left)}px`;
      grammarPopup.style.left = `${Math.round(left + iconSize + iconGap)}px`;
      emailPopup.style.left = `${Math.round(left + (iconSize * 2) + (iconGap * 2))}px`;
    }
    
    // If not enough space above, show below
    if (top < scrollY + minMargin) {
      top = firstCharRect.bottom + scrollY + 8;
      floatingPopup.style.top = `${Math.round(top)}px`;
      grammarPopup.style.top = `${Math.round(top)}px`;
      emailPopup.style.top = `${Math.round(top)}px`;
    }
    
    // Ensure it's within viewport vertically
    if (top + iconSize > scrollY + viewportHeight - minMargin) {
      top = scrollY + viewportHeight - iconSize - minMargin;
      floatingPopup.style.top = `${Math.round(top)}px`;
      grammarPopup.style.top = `${Math.round(top)}px`;
      emailPopup.style.top = `${Math.round(top)}px`;
    }
    
    document.body.appendChild(floatingPopup);
    document.body.appendChild(grammarPopup);
    document.body.appendChild(emailPopup);
    
    floatingPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      rewriteSelectedText(selectedText, range);
    });
    
    grammarPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      grammarizeSelectedText(selectedText, range);
    });
    
    emailPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      formatEmailSelectedText(selectedText, range);
    });
    
    setTimeout(() => {
      const handleClick = (e) => {
        if ((floatingPopup && !floatingPopup.contains(e.target)) && 
            (grammarPopup && !grammarPopup.contains(e.target)) &&
            (emailPopup && !emailPopup.contains(e.target))) {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < 5) {
            hideFloatingPopup();
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('mousedown', handleClick, true);
          }
        }
      };
      document.addEventListener('click', handleClick, true);
      document.addEventListener('mousedown', handleClick, true);
    }, 50);
    
  } catch (error) {
    console.error('Error showing popup:', error);
  }
}

function hideFloatingPopup() {
  if (floatingPopup) {
    floatingPopup.remove();
    floatingPopup = null;
  }
  if (grammarPopup) {
    grammarPopup.remove();
    grammarPopup = null;
  }
  if (emailPopup) {
    emailPopup.remove();
    emailPopup = null;
  }
  if (loginPopup) {
    loginPopup.remove();
    loginPopup = null;
  }
}

async function rewriteSelectedText(selectedText, range) {
  // Set flag to prevent popup from being recreated during processing
  isProcessingRewrite = true;
  
  try {
    // Validate token before making request
    if (!authToken) {
      const authenticated = await checkAuthStatus();
      if (!authenticated) {
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingRewrite = false;
        return;
      }
    }
    
    // Get server URL
    const serverUrl = await getServerUrl();
    
    // Show loading icon when request starts
    if (floatingPopup) {
      floatingPopup.innerHTML = '<div class="pr-spinner-icon"></div>';
      floatingPopup.disabled = true;
      floatingPopup.classList.add('pr-loading');
      floatingPopup.style.pointerEvents = 'none';
    }
    
    // Send request to backend with token
    const response = await fetch(`${serverUrl}/api/rewrite-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ 
        prompt: selectedText, 
        format: 'default',
        token: authToken
      }),
    });
    
    // Loading continues until response is received
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle usage limit exceeded (403)
      if (response.status === 403 && errorData.requiresSubscription) {
        hideFloatingPopup();
        showSubscriptionRequired(range, selectedText, errorData.message || 'Free trial exhausted. Please subscribe to continue.');
        isProcessingRewrite = false;
        return;
      }
      
      // Handle authentication errors (401)
      if (response.status === 401) {
        await deleteToken();
        authToken = null;
        isAuthenticated = false;
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingRewrite = false;
        return;
      }
      
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    const rewrittenText = data.rewrittenPrompt;
    
    // Replace text while loading is still showing
    replaceSelectedText(range, selectedText, rewrittenText);
    
    // Keep loading visible for a moment to ensure replacement is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Now hide popup and show success - loading ends here
    hideFloatingPopup();
    showSuccessIndicator();
    
  } catch (error) {
    console.error('Error rewriting prompt:', error);
    showErrorIndicator(error.message);
    
    // Reset to prompt icon on error
    if (floatingPopup) {
      floatingPopup.innerHTML = '<span class="pr-icon-emoji">✨</span><span class="pr-tooltip">Refine Prompt</span>';
      floatingPopup.disabled = false;
      floatingPopup.classList.remove('pr-loading');
      floatingPopup.style.pointerEvents = 'auto';
    }
  } finally {
    // Reset flag after processing is complete
    isProcessingRewrite = false;
  }
}

async function grammarizeSelectedText(selectedText, range) {
  // Set flag to prevent popup from being recreated during processing
  isProcessingGrammar = true;
  
  try {
    // Validate token before making request
    if (!authToken) {
      const authenticated = await checkAuthStatus();
      if (!authenticated) {
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingGrammar = false;
        return;
      }
    }
    
    // Get server URL
    const serverUrl = await getServerUrl();
    
    // Show loading icon when request starts
    if (grammarPopup) {
      grammarPopup.innerHTML = '<div class="pr-spinner-icon"></div>';
      grammarPopup.disabled = true;
      grammarPopup.classList.add('pr-loading');
      grammarPopup.style.pointerEvents = 'none';
    }
    
    // Send request to backend with token
    const response = await fetch(`${serverUrl}/api/grammarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ 
        text: selectedText,
        token: authToken
      }),
    });
    
    // Loading continues until response is received
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // If unauthorized, token is invalid
      if (response.status === 401) {
        await deleteToken();
        authToken = null;
        isAuthenticated = false;
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingGrammar = false;
        return;
      }
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    const grammarizedText = data.grammarizedText;
    
    // Replace text while loading is still showing
    replaceSelectedText(range, selectedText, grammarizedText);
    
    // Keep loading visible for a moment to ensure replacement is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Now hide popup and show success - loading ends here
    hideFloatingPopup();
    showSuccessIndicator();
    
  } catch (error) {
    console.error('Error grammarizing text:', error);
    showErrorIndicator(error.message);
    
    // Reset to grammar icon on error
    if (grammarPopup) {
      grammarPopup.innerHTML = '<span class="pr-icon-emoji">✏️</span><span class="pr-tooltip">Grammarize</span>';
      grammarPopup.disabled = false;
      grammarPopup.classList.remove('pr-loading');
      grammarPopup.style.pointerEvents = 'auto';
    }
  } finally {
    // Reset flag after processing is complete
    isProcessingGrammar = false;
  }
}

async function formatEmailSelectedText(selectedText, range) {
  // Set flag to prevent popup from being recreated during processing
  isProcessingEmail = true;
  
  try {
    // Validate token before making request
    if (!authToken) {
      const authenticated = await checkAuthStatus();
      if (!authenticated) {
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingEmail = false;
        return;
      }
    }
    
    // Get server URL
    const serverUrl = await getServerUrl();
    
    // Show loading icon when request starts
    if (emailPopup) {
      emailPopup.innerHTML = '<div class="pr-spinner-icon"></div>';
      emailPopup.disabled = true;
      emailPopup.classList.add('pr-loading');
      emailPopup.style.pointerEvents = 'none';
    }
    
    // Send request to backend with token
    const response = await fetch(`${serverUrl}/api/format-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ 
        text: selectedText,
        token: authToken
      }),
    });
    
    // Loading continues until response is received
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle usage limit exceeded (403)
      if (response.status === 403 && errorData.requiresSubscription) {
        hideFloatingPopup();
        showSubscriptionRequired(range, selectedText, errorData.message || 'Free trial exhausted. Please subscribe to continue.');
        isProcessingEmail = false;
        return;
      }
      
      // Handle authentication errors (401)
      if (response.status === 401) {
        await deleteToken();
        authToken = null;
        isAuthenticated = false;
        hideFloatingPopup();
        showLoginButton(range, selectedText);
        isProcessingEmail = false;
        return;
      }
      
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    const formattedEmail = data.formattedEmail;
    
    // Replace text while loading is still showing (preserve formatting for email)
    replaceSelectedText(range, selectedText, formattedEmail, true);
    
    // Keep loading visible for a moment to ensure replacement is complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Now hide popup and show success - loading ends here
    hideFloatingPopup();
    showSuccessIndicator();
    
  } catch (error) {
    console.error('Error formatting email:', error);
    showErrorIndicator(error.message);
    
    // Reset to email icon on error
    if (emailPopup) {
      emailPopup.innerHTML = '<span class="pr-icon-emoji">📧</span><span class="pr-tooltip">Format Email</span>';
      emailPopup.disabled = false;
      emailPopup.classList.remove('pr-loading');
      emailPopup.style.pointerEvents = 'auto';
    }
  } finally {
    // Reset flag after processing is complete
    isProcessingEmail = false;
  }
}

function replaceSelectedText(range, originalText, rewrittenText, preserveFormatting = false) {
  try {
    range.deleteContents();
    
    // If we need to preserve formatting (like for emails), use innerHTML with line breaks
    if (preserveFormatting) {
      // Convert newlines to <br> tags for proper formatting
      const formattedText = rewrittenText.replace(/\n/g, '<br>');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedText;
      
      // Try to insert as HTML if parent supports it
      const parent = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
      
      if (parent && (parent.tagName === 'DIV' || parent.tagName === 'P' || parent.contentEditable === 'true' || parent.isContentEditable)) {
        // Use innerHTML for elements that support HTML
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        range.insertNode(fragment);
      } else {
        // Fallback to text node with preserved line breaks using white-space
        const textNode = document.createTextNode(rewrittenText);
        const span = document.createElement('span');
        span.style.whiteSpace = 'pre-line';
        span.appendChild(textNode);
        range.insertNode(span);
      }
    } else {
      // Regular text replacement
      const textNode = document.createTextNode(rewrittenText);
      range.insertNode(textNode);
    }
    
    window.getSelection().removeAllRanges();
  } catch (error) {
    console.error('Error replacing text:', error);
    try {
      const parent = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
      
      if (parent) {
        const text = parent.textContent || parent.innerText || '';
        if (text.includes(originalText)) {
          let newText = rewrittenText;
          
          // If preserving formatting and parent supports HTML
          if (preserveFormatting && (parent.tagName === 'DIV' || parent.tagName === 'P' || parent.contentEditable === 'true')) {
            const formattedText = rewrittenText.replace(/\n/g, '<br>');
            parent.innerHTML = text.replace(originalText, formattedText);
          } else if (preserveFormatting) {
            // Use white-space pre-line to preserve line breaks
            const span = document.createElement('span');
            span.style.whiteSpace = 'pre-line';
            span.textContent = rewrittenText;
            const textToReplace = parent.textContent || parent.innerText || '';
            if (textToReplace.includes(originalText)) {
              parent.innerHTML = textToReplace.replace(originalText, span.outerHTML);
            }
          } else {
            if (parent.textContent !== undefined) {
              parent.textContent = text.replace(originalText, newText);
            } else {
              parent.innerText = text.replace(originalText, newText);
            }
          }
        }
      }
    } catch (e) {
      console.error('Fallback failed:', e);
    }
  }
}

function showSuccessIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'pr-success-indicator';
  indicator.textContent = '✓ Prompt rewritten!';
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 2000);
}

function showErrorIndicator(message) {
  const indicator = document.createElement('div');
  indicator.className = 'pr-error-indicator';
  indicator.textContent = `✗ ${message}`;
  document.body.appendChild(indicator);
  
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'replacePrompt') {
    try {
      const textareas = document.querySelectorAll('textarea');
      const inputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      
      for (const textarea of textareas) {
        if (textarea.value.includes(request.originalPrompt)) {
          textarea.value = request.rewrittenPrompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          showSuccessIndicator();
          sendResponse({ success: true });
          return true;
        }
      }
      
      for (const input of inputs) {
        if (input.value.includes(request.originalPrompt)) {
          input.value = request.rewrittenPrompt;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          showSuccessIndicator();
          sendResponse({ success: true });
          return true;
        }
      }
      
      sendResponse({ success: false });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

function addStyles() {
  if (document.getElementById('pr-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'pr-styles';
  style.textContent = `
    .pr-icon-btn {
      position: absolute;
      z-index: 999999;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
      pointer-events: auto;
      padding: 0;
      line-height: 1;
    }
    .pr-tooltip {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(-4px);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .pr-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: rgba(0, 0, 0, 0.9);
    }
    .pr-icon-btn:hover .pr-tooltip {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .pr-icon-emoji {
      display: inline-block;
      line-height: 1;
    }
    .pr-icon-btn .pr-tooltip {
      display: block;
    }
    .pr-icon-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
    }
    .pr-icon-btn:active {
      transform: scale(0.95);
    }
    .pr-icon-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }
    .pr-icon-btn.pr-loading {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .pr-grammar-btn {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .pr-grammar-btn:hover {
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
    }
    .pr-email-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    .pr-email-btn:hover {
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    }
    .pr-login-btn {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }
    .pr-login-btn:hover {
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
    }
    .pr-subscription-btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .pr-subscription-btn:hover {
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
    }
    .pr-spinner-icon {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: pr-spin 0.8s linear infinite;
    }
    @keyframes pr-spin {
      to { transform: rotate(360deg); }
    }
    .pr-success-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1000000;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: pr-slideIn 0.3s ease-out;
      transition: opacity 0.3s;
    }
    .pr-error-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1000000;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: pr-slideIn 0.3s ease-out;
      transition: opacity 0.3s;
      max-width: 300px;
    }
    @keyframes pr-slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
