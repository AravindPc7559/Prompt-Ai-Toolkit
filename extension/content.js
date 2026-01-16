/**
 * Prompt AI Toolkit - Content Script
 * Handles text selection, authentication, and AI-powered text transformations
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  MIN_SELECTION_LENGTH: 5,
  ICON_SIZE: 40,
  ICON_GAP: 8,
  MIN_MARGIN: 10,
  SELECTION_DEBOUNCE: 100,
  SYNC_INTERVAL: 10000, // 10 seconds to avoid quota issues
  NETWORK_ERROR_LOG_INTERVAL: 30000, // 30 seconds
  TOKEN_EXPIRY_DAYS: 30,
  MAX_DOM_DEPTH: 30,
  DEFAULT_SERVER_URL: 'http://localhost:3000',
  DEFAULT_CLIENT_URL: 'http://localhost:5173',
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
  floatingPopup: null,
  grammarPopup: null,
  emailPopup: null,
  loginPopup: null,
  userPopup: null,
  selectionTimeout: null,
  syncInterval: null,
  isProcessingRewrite: false,
  isProcessingGrammar: false,
  isProcessingEmail: false,
  authToken: null,
  isAuthenticated: false,
  extensionContextValid: true,

  // Auth status cache
  authStatusCache: {
    status: null,
    timestamp: 0,
    ttl: 60000, // 1 minute cache
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if extension context is still valid
 */
function isExtensionContextValid() {
  try {
    return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
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
      state.extensionContextValid = false;
      reject(new Error('Extension context invalidated'));
      return;
    }

    try {
      operation((result) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          if (error && error.includes('Extension context invalidated')) {
            state.extensionContextValid = false;
            reject(new Error('Extension context invalidated'));
          } else {
            reject(new Error(error));
          }
        } else {
          resolve(result);
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        state.extensionContextValid = false;
      }
      reject(e);
    }
  });
}

/**
 * Normalize URL by removing trailing slashes
 */
function normalizeUrl(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

/**
 * Log error only if it's not an extension context error
 */
function logError(context, error) {
  if (!error) return;

  const isContextError = error.message &&
    (error.message.includes('Extension context invalidated') ||
      error.message.includes('Extension context'));

  if (!isContextError) {
    console.error(`[${context}]`, error);
  }
}

/**
 * Log network error with throttling to avoid console spam
 */
async function logNetworkError(error) {
  if (!error || !error.message || !error.message.includes('Failed to fetch')) {
    return;
  }

  const lastLog = window.lastNetworkErrorLog || 0;
  const now = Date.now();

  if (now - lastLog > CONFIG.NETWORK_ERROR_LOG_INTERVAL) {
    window.lastNetworkErrorLog = now;
    const serverUrl = await getServerUrl().catch(() => 'unknown');
    console.warn('Network error - check if server is running at:', serverUrl);
    console.warn('Possible causes: Server not running or network problems');
  }
}

// ============================================================================
// CONFIGURATION & STORAGE
// ============================================================================

/**
 * Get configuration from chrome.storage
 */
async function getConfig() {
  if (!isExtensionContextValid()) {
    state.extensionContextValid = false;
    const error = new Error('Extension context invalidated');
    error.contextInvalidated = true;
    throw error;
  }

  try {
    const result = await safeChromeStorage((callback) => {
      chrome.storage.sync.get(['serverUrl', 'loginUrl'], callback);
    });

    return {
      serverUrl: result.serverUrl || CONFIG.DEFAULT_SERVER_URL,
      loginUrl: result.loginUrl || CONFIG.DEFAULT_CLIENT_URL,
      pricingPath: '/pricing',
      dashboardPath: '/dashboard',
    };
  } catch (e) {
    if (e && e.message && e.message.includes('Extension context invalidated')) {
      state.extensionContextValid = false;
      const error = new Error('Extension context invalidated');
      error.contextInvalidated = true;
      throw error;
    }

    // Return default config for other errors
    return {
      serverUrl: CONFIG.DEFAULT_SERVER_URL,
      loginUrl: CONFIG.DEFAULT_CLIENT_URL,
      pricingPath: '/pricing',
      dashboardPath: '/dashboard',
    };
  }
}

/**
 * Get server URL
 */
async function getServerUrl() {
  try {
    const config = await getConfig();
    const url = config.serverUrl || CONFIG.DEFAULT_SERVER_URL;

    if (!url || typeof url !== 'string') {
      console.error('Invalid server URL:', url);
      return CONFIG.DEFAULT_SERVER_URL;
    }

    return normalizeUrl(url);
  } catch (error) {
    logError('getServerUrl', error);
    return CONFIG.DEFAULT_SERVER_URL;
  }
}

/**
 * Get pricing URL
 */
async function getPricingUrl() {
  try {
    const config = await getConfig();
    const baseUrl = normalizeUrl(config.loginUrl);
    return `${baseUrl}${config.pricingPath}`;
  } catch (error) {
    logError('getPricingUrl', error);
    return `${CONFIG.DEFAULT_CLIENT_URL}/pricing`;
  }
}

/**
 * Get login URL
 */
async function getLoginUrl() {
  try {
    const config = await getConfig();
    const baseUrl = normalizeUrl(config.loginUrl);
    return `${baseUrl}/login`;
  } catch (error) {
    logError('getLoginUrl', error);
    return `${CONFIG.DEFAULT_CLIENT_URL}/login`;
  }
}

/**
 * Get dashboard URL
 */
async function getDashboardUrl() {
  try {
    const config = await getConfig();
    const baseUrl = normalizeUrl(config.loginUrl);
    return `${baseUrl}${config.dashboardPath}`;
  } catch (error) {
    logError('getDashboardUrl', error);
    return `${CONFIG.DEFAULT_CLIENT_URL}/dashboard`;
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Check authentication status and validate token
 */
async function checkAuthStatus() {
  try {
    if (!isExtensionContextValid()) {
      return { authenticated: false, canUseService: false };
    }

    // Check cache first
    const now = Date.now();
    if (state.authStatusCache.status &&
      (now - state.authStatusCache.timestamp) < state.authStatusCache.ttl) {
      return state.authStatusCache.status;
    }

    // Get token from chrome.storage
    let result;
    try {
      result = await safeChromeStorage((callback) => {
        chrome.storage.sync.get(['authToken'], callback);
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        state.extensionContextValid = false;
        return { authenticated: false, canUseService: false };
      }
      throw e;
    }

    if (!result.authToken || !result.authToken.token) {
      state.authToken = null;
      state.isAuthenticated = false;
      return { authenticated: false, canUseService: false };
    }

    const token = result.authToken.token;
    const serverUrl = await getServerUrl();

    if (!serverUrl) {
      console.error('Server URL not configured');
      return { authenticated: false, canUseService: false };
    }

    // Validate token with backend
    const response = await fetch(`${serverUrl}/api/validate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      await deleteToken();
      state.authToken = null;
      state.isAuthenticated = false;
      return { authenticated: false, canUseService: false, message: 'Token validation failed' };
    }

    const data = await response.json();

    if (data.valid) {
      state.authToken = token;
      state.isAuthenticated = true;
      const authStatus = {
        authenticated: true,
        canUseService: data.canUseService === true,
        message: data.message || '',
        remainingTrials: data.remainingTrials || 0,
      };

      // Cache the auth status
      state.authStatusCache.status = authStatus;
      state.authStatusCache.timestamp = Date.now();

      return authStatus;
    } else {
      await deleteToken();
      state.authToken = null;
      state.isAuthenticated = false;

      // Cache the negative result
      const authStatus = { authenticated: false, canUseService: false };
      state.authStatusCache.status = authStatus;
      state.authStatusCache.timestamp = Date.now();

      return authStatus;
    }
  } catch (error) {
    await logNetworkError(error);

    if (error && error.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
      logError('checkAuthStatus', error);
    }

    state.authToken = null;
    state.isAuthenticated = false;
    return { authenticated: false, canUseService: false };
  }
}

/**
 * Delete token from storage
 */
async function deleteToken() {
  try {
    if (!isExtensionContextValid()) return;

    await safeChromeStorage((callback) => {
      chrome.storage.sync.remove(['authToken'], callback);
    });

    // Clear auth status cache
    state.authStatusCache.status = null;
    state.authStatusCache.timestamp = 0;
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      state.extensionContextValid = false;
    } else if (error.message && error.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
      console.warn('Storage quota exceeded, will retry later');
    } else {
      logError('deleteToken', error);
    }
  }
}

/**
 * Sync token from localStorage to chrome.storage.sync
 */
async function syncTokenFromLocalStorage() {
  try {
    if (!isExtensionContextValid()) return;

    const isClientOrigin = window.location.hostname === 'localhost' &&
      (window.location.port === '5173' || window.location.port === '');

    if (!isClientOrigin) return;

    const authDataStr = localStorage.getItem('authToken');

    if (authDataStr) {
      if (!isExtensionContextValid()) {
        state.extensionContextValid = false;
        return;
      }

      try {
        const authData = JSON.parse(authDataStr);
        if (!authData || !authData.token) return;

        // Get config
        let config;
        try {
          config = await getConfig();
        } catch (configError) {
          if (configError && (configError.message && configError.message.includes('Extension context invalidated') || configError.contextInvalidated)) {
            state.extensionContextValid = false;
            return;
          }
          config = {
            serverUrl: CONFIG.DEFAULT_SERVER_URL,
            loginUrl: CONFIG.DEFAULT_CLIENT_URL,
          };
        }

        if (!isExtensionContextValid()) {
          state.extensionContextValid = false;
          return;
        }

        // Check if token has changed before writing
        let shouldSync = true;
        try {
          const existing = await safeChromeStorage((callback) => {
            chrome.storage.sync.get(['authToken'], callback);
          });
          if (existing.authToken && existing.authToken.token === authData.token) {
            shouldSync = false;
          }
        } catch (e) {
          // Proceed with sync if check fails
        }

        if (shouldSync) {
          try {
            await safeChromeStorage((callback) => {
              chrome.storage.sync.set({
                authToken: authData,
                serverUrl: config.serverUrl,
              }, callback);
            });

            console.log('Token synced from localStorage to extension storage');

            // Update auth status
            checkAuthStatus().then((status) => {
              if (status.authenticated) {
                state.authToken = authData.token;
                state.isAuthenticated = true;
                setTimeout(() => checkSelection(), 100);
              }
            }).catch((err) => {
              if (err && err.message && !err.message.includes('Extension context invalidated') && !err.message.includes('Failed to fetch')) {
                logError('checkAuthStatus after sync', err);
              }
            });
          } catch (e) {
            if (e.message && e.message.includes('Extension context invalidated')) {
              state.extensionContextValid = false;
              return;
            } else if (e.message && e.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
              console.warn('Storage quota exceeded, will retry later');
            } else {
              logError('syncTokenFromLocalStorage', e);
            }
          }
        } else {
          // Token hasn't changed, just update local state
          if (!state.authToken || state.authToken !== authData.token) {
            state.authToken = authData.token;
            state.isAuthenticated = true;
          }
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.error('JSON parse error in syncTokenFromLocalStorage:', e);
        } else if (e && e.message && e.message.includes('Extension context invalidated')) {
          state.extensionContextValid = false;
          return;
        }
      }
    } else {
      // Clear token if localStorage is empty
      try {
        await safeChromeStorage((callback) => {
          chrome.storage.sync.remove(['authToken'], callback);
        });
        state.authToken = null;
        state.isAuthenticated = false;
      } catch (e) {
        if (!e.message || !e.message.includes('Extension context invalidated')) {
          logError('clearToken', e);
        }
      }
    }
  } catch (error) {
    if (!error.message || !error.message.includes('Extension context invalidated')) {
      logError('syncTokenFromLocalStorage', error);
    }
  }
}

/**
 * Handle auth token from login website
 */
async function handleAuthToken(event) {
  try {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated, cannot handle auth token');
      return;
    }

    const { token, serverUrl } = event.detail;

    if (!token) {
      console.error('No token in event detail');
      return;
    }

    const authData = {
      token: token,
      expiresAt: new Date(Date.now() + CONFIG.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };

    const config = await getConfig();
    const finalServerUrl = serverUrl || config.serverUrl;

    try {
      // Check if token has changed before writing
      let shouldWrite = true;
      try {
        const existing = await safeChromeStorage((callback) => {
          chrome.storage.sync.get(['authToken'], callback);
        });
        if (existing.authToken && existing.authToken.token === token) {
          shouldWrite = false;
        }
      } catch (e) {
        // Proceed with write if check fails
      }

      if (shouldWrite) {
        await safeChromeStorage((callback) => {
          chrome.storage.sync.set({
            authToken: authData,
            serverUrl: finalServerUrl,
          }, callback);
        });

        console.log('Token stored in extension storage from login website');
      }

      // Update auth status and show icons
      checkAuthStatus().then((status) => {
        if (status.authenticated) {
          state.authToken = token;
          state.isAuthenticated = true;
        } else {
          state.authToken = null;
          state.isAuthenticated = false;
        }

        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const selectedText = selection.toString().trim();
            if (selectedText.length >= CONFIG.MIN_SELECTION_LENGTH) {
              const range = selection.getRangeAt(0);
              if (range && !range.collapsed && isSelectionInFormField(range)) {
                checkSelection();
              }
            }
          } else {
            checkSelection();
          }
        }, 300);
      }).catch((err) => {
        logError('checkAuthStatus after login', err);
        // Optimistic update on error
        state.authToken = token;
        state.isAuthenticated = true;
        setTimeout(() => checkSelection(), 300);
      });

      // Notify background script
      if (isExtensionContextValid()) {
        chrome.runtime.sendMessage({
          type: 'AUTH_TOKEN_SET',
          token: token,
        }).catch(() => { });
      }
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        state.extensionContextValid = false;
        console.warn('Extension context invalidated, cannot store token');
      } else if (e.message && e.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
        console.warn('Storage quota exceeded, will retry later');
      } else {
        logError('handleAuthToken', e);
      }
    }
  } catch (error) {
    logError('handleAuthToken', error);
  }
}

/**
 * Handle logout event from login website
 */
async function handleLogout() {
  try {
    if (!isExtensionContextValid()) {
      state.authToken = null;
      state.isAuthenticated = false;
      hideFloatingPopup();
      return;
    }

    try {
      await safeChromeStorage((callback) => {
        chrome.storage.sync.remove(['authToken'], callback);
      });

      console.log('Token removed from extension storage on logout');
      state.authToken = null;
      state.isAuthenticated = false;
      hideFloatingPopup();

      if (isExtensionContextValid()) {
        chrome.runtime.sendMessage({ type: 'AUTH_TOKEN_REMOVED' }).catch(() => { });
      }
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        state.extensionContextValid = false;
      }
      state.authToken = null;
      state.isAuthenticated = false;
      hideFloatingPopup();
    }
  } catch (error) {
    logError('handleLogout', error);
    state.authToken = null;
    state.isAuthenticated = false;
    hideFloatingPopup();
  }
}

// ============================================================================
// SELECTION DETECTION
// ============================================================================

/**
 * Handle mouse up event
 */
function handleMouseUp() {
  clearTimeout(state.selectionTimeout);
  state.selectionTimeout = setTimeout(() => checkSelection(), CONFIG.SELECTION_DEBOUNCE);
}

/**
 * Handle selection change event
 */
function handleSelectionChange() {
  clearTimeout(state.selectionTimeout);
  state.selectionTimeout = setTimeout(() => checkSelection(), CONFIG.SELECTION_DEBOUNCE);
}

/**
 * Check current selection and show appropriate popup
 */
async function checkSelection() {
  try {
    if (state.isProcessingRewrite || state.isProcessingGrammar || state.isProcessingEmail) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      hideFloatingPopup();
      return;
    }

    const selectedText = selection.toString().trim();

    if (selectedText.length >= CONFIG.MIN_SELECTION_LENGTH) {
      const range = selection.getRangeAt(0);
      if (range && !range.collapsed && isSelectionInFormField(range)) {
        // Check authentication status
        let authStatus = { authenticated: false, canUseService: false };

        try {
          authStatus = await checkAuthStatus();

          // Update local state
          if (authStatus.authenticated) {
            try {
              const result = await safeChromeStorage((callback) => {
                chrome.storage.sync.get(['authToken'], callback);
              });
              if (result.authToken && result.authToken.token) {
                state.authToken = result.authToken.token;
                state.isAuthenticated = true;
              }
            } catch (e) {
              // Continue with existing state
            }
          } else {
            state.authToken = null;
            state.isAuthenticated = false;
          }
        } catch (error) {
          logError('checkAuthStatus in checkSelection', error);
          authStatus = { authenticated: false, canUseService: false };
        }

        // Show appropriate popup
        if (authStatus.authenticated) {
          if (authStatus.canUseService === true) {
            showFloatingPopup(range, selectedText);
          } else {
            showPurchaseIcon(range, selectedText, authStatus.message || 'Free trial exhausted. Please subscribe to continue.');
          }
        } else {
          showLoginButton(range, selectedText);
        }
      } else {
        hideFloatingPopup();
      }
    } else {
      hideFloatingPopup();
    }
  } catch (error) {
    logError('checkSelection', error);

    // Fallback to login button
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const selectedText = selection.toString().trim();
        if (selectedText.length >= CONFIG.MIN_SELECTION_LENGTH) {
          const range = selection.getRangeAt(0);
          if (range && !range.collapsed && isSelectionInFormField(range)) {
            showLoginButton(range, selectedText);
          }
        }
      }
    } catch (fallbackError) {
      logError('checkSelection fallback', fallbackError);
    }
  }
}

/**
 * Check if selection is in a form field
 */
function isSelectionInFormField(range) {
  if (!range || range.collapsed) return false;

  let container = range.commonAncestorContainer;

  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement;
  }

  if (!container || container.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  /**
   * Check if element is a form field
   */
  function isFormFieldElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    // Check for textarea
    if (el.tagName === 'TEXTAREA') return true;

    // Check for input fields
    if (el.tagName === 'INPUT') {
      const inputType = (el.type || '').toLowerCase();
      const editableTypes = ['text', 'email', 'search', 'url', 'tel', 'password', 'number'];
      return !inputType || editableTypes.includes(inputType);
    }

    // Check for contenteditable
    if (el.contentEditable === 'true' || el.isContentEditable) return true;

    // Check for role attributes
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'combobox' || role === 'searchbox') return true;

    // Check for aria attributes
    const ariaMultiline = el.getAttribute && el.getAttribute('aria-multiline');
    if (ariaMultiline === 'true') {
      if (el.contentEditable === 'true' || el.isContentEditable || el.tagName === 'TEXTAREA') {
        return true;
      }
    }

    // Check for common form field classes
    const className = el.className || '';
    if (typeof className === 'string') {
      const lowerClass = className.toLowerCase();
      const formFieldPatterns = [
        'textarea', 'input-field', 'text-input', 'form-control', 'form-input',
        'editable', 'editor', 'ql-editor', 'ce-paragraph', 'contenteditable',
        'textfield', 'text-field', 'cm-editor', 'monaco-editor', 'ace_editor',
        'wysiwyg', 'rich-text', 'prosemirror', 'slate', 'draft', 'lexical', 'tiptap',
      ];
      if (formFieldPatterns.some(pattern => lowerClass.includes(pattern))) {
        return true;
      }
    }

    // Check for ID patterns
    const id = el.id || '';
    if (typeof id === 'string' && id.length > 0) {
      const lowerId = id.toLowerCase();
      const idPatterns = ['input', 'textarea', 'editor', 'textfield', 'prompt', 'message'];
      if (idPatterns.some(pattern => lowerId.includes(pattern))) {
        if (el.contentEditable === 'true' || el.isContentEditable || el.tagName === 'TEXTAREA' ||
          (el.tagName === 'INPUT' && ['text', 'email', 'search', 'url', 'tel', 'password'].includes((el.type || '').toLowerCase()))) {
          return true;
        }
      }
    }

    // Check for data attributes
    if (el.getAttribute) {
      const dataEditable = el.getAttribute('data-editable');
      const dataContentEditable = el.getAttribute('data-contenteditable');
      if (dataEditable === 'true' || dataContentEditable === 'true') return true;
    }

    return false;
  }

  // Traverse up the DOM tree
  let element = container;
  let depth = 0;

  while (element && depth < CONFIG.MAX_DOM_DEPTH) {
    if (isFormFieldElement(element)) return true;

    // Check shadow DOM
    try {
      const rootNode = element.getRootNode ? element.getRootNode() : null;
      if (rootNode instanceof ShadowRoot) {
        const shadowHost = rootNode.host;
        if (shadowHost && isFormFieldElement(shadowHost)) return true;
        if (isFormFieldElement(element)) return true;
      }
    } catch (e) {
      // Ignore shadow DOM errors
    }

    element = element.parentElement;
    depth++;

    if (!element || element.tagName === 'BODY' || element.tagName === 'HTML') {
      break;
    }
  }

  // Final fallback check
  try {
    const startContainer = range.startContainer;
    let checkElement = startContainer.nodeType === Node.TEXT_NODE
      ? startContainer.parentElement
      : startContainer;

    while (checkElement && checkElement !== document.body) {
      if (checkElement.contentEditable === 'true' || checkElement.isContentEditable) return true;
      if (checkElement.tagName === 'INPUT' || checkElement.tagName === 'TEXTAREA') return true;

      try {
        if (checkElement.focus && typeof checkElement.focus === 'function') {
          if ('value' in checkElement || checkElement.textContent !== undefined) {
            const parent = checkElement.parentElement;
            if (parent && (
              parent.tagName === 'FORM' ||
              parent.getAttribute('role') === 'form' ||
              (parent.className && typeof parent.className === 'string' &&
                (parent.className.toLowerCase().includes('form') ||
                  parent.className.toLowerCase().includes('input') ||
                  parent.className.toLowerCase().includes('editor')))
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

// ============================================================================
// POPUP POSITIONING & DISPLAY
// ============================================================================

/**
 * Get position for popup based on selection range
 */
function getPopupPosition(range) {
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
    return null;
  }

  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  return {
    rect: firstCharRect,
    scrollX,
    scrollY,
  };
}

/**
 * Adjust position to keep within viewport
 */
function adjustPosition(left, top, width = CONFIG.ICON_SIZE, height = CONFIG.ICON_SIZE, positionData) {
  const { rect, scrollX, scrollY } = positionData;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust horizontal position
  if (left + width > scrollX + viewportWidth - CONFIG.MIN_MARGIN) {
    left = scrollX + viewportWidth - width - CONFIG.MIN_MARGIN;
  }
  if (left < scrollX + CONFIG.MIN_MARGIN) {
    left = scrollX + CONFIG.MIN_MARGIN;
  }

  // Adjust vertical position
  if (top < scrollY + CONFIG.MIN_MARGIN) {
    top = rect.bottom + scrollY + 8;
  }
  if (top + height > scrollY + viewportHeight - CONFIG.MIN_MARGIN) {
    top = scrollY + viewportHeight - height - CONFIG.MIN_MARGIN;
  }

  return { left, top };
}

/**
 * Setup click outside handler for popup
 */
function setupClickOutsideHandler(popup) {
  setTimeout(() => {
    const handleClick = (e) => {
      // Check if click is outside the popup and also outside userPopup if it exists
      const isOutsidePopup = popup && !popup.contains(e.target);
      const isOutsideUserPopup = !state.userPopup || !state.userPopup.contains(e.target);

      if (isOutsidePopup && isOutsideUserPopup) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < CONFIG.MIN_SELECTION_LENGTH) {
          hideFloatingPopup();
          document.removeEventListener('click', handleClick, true);
          document.removeEventListener('mousedown', handleClick, true);
        }
      }
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleClick, true);
  }, 50);
}

/**
 * Show login button
 */
function showLoginButton(range, selectedText) {
  hideFloatingPopup();

  try {
    const positionData = getPopupPosition(range);
    if (!positionData) return;

    const { rect, scrollX, scrollY } = positionData;
    let left = rect.left + scrollX - 5;
    let top = rect.top + scrollY - CONFIG.ICON_SIZE - 8;

    const adjusted = adjustPosition(left, top, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE, positionData);

    state.loginPopup = document.createElement('button');
    state.loginPopup.id = 'prompt-login-popup';
    state.loginPopup.className = 'pr-icon-btn pr-login-btn';
    state.loginPopup.innerHTML = '<span class="pr-icon-emoji">🔐</span><span class="pr-tooltip">Login Required</span>';
    state.loginPopup.style.left = `${Math.round(adjusted.left)}px`;
    state.loginPopup.style.top = `${Math.round(adjusted.top)}px`;

    document.body.appendChild(state.loginPopup);

    state.loginPopup.addEventListener('click', async (e) => {
      e.stopPropagation();
      await redirectToLogin();
    });

    setupClickOutsideHandler(state.loginPopup);

    // Create user icon after lock icon (no need for separate handler, loginPopup handler covers it)
    createUserIcon(adjusted.left + CONFIG.ICON_SIZE + CONFIG.ICON_GAP, adjusted.top, positionData, false);
  } catch (error) {
    logError('showLoginButton', error);
  }
}

/**
 * Show purchase icon
 */
function showPurchaseIcon(range, selectedText, message = 'Free trial exhausted. Please subscribe to continue.') {
  hideFloatingPopup();

  try {
    const positionData = getPopupPosition(range);
    if (!positionData) return;

    const { rect, scrollX, scrollY } = positionData;
    let left = rect.left + scrollX - 5;
    let top = rect.top + scrollY - CONFIG.ICON_SIZE - 8;

    const adjusted = adjustPosition(left, top, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE, positionData);

    state.loginPopup = document.createElement('button');
    state.loginPopup.id = 'prompt-purchase-popup';
    state.loginPopup.className = 'pr-icon-btn pr-subscription-btn';
    state.loginPopup.innerHTML = `<span class="pr-icon-emoji">💳</span><span class="pr-tooltip">${message}</span>`;
    state.loginPopup.style.left = `${Math.round(adjusted.left)}px`;
    state.loginPopup.style.top = `${Math.round(adjusted.top)}px`;

    document.body.appendChild(state.loginPopup);

    state.loginPopup.addEventListener('click', async (e) => {
      e.stopPropagation();
      await redirectToPricing();
    });

    setupClickOutsideHandler(state.loginPopup);

    // Create user icon after card icon (no need for separate handler, loginPopup handler covers it)
    createUserIcon(adjusted.left + CONFIG.ICON_SIZE + CONFIG.ICON_GAP, adjusted.top, positionData, false);
  } catch (error) {
    logError('showPurchaseIcon', error);
  }
}

/**
 * Show subscription required button (after 403 error)
 */
function showSubscriptionRequired(range, selectedText, message) {
  // Reuse showPurchaseIcon since they're identical
  showPurchaseIcon(range, selectedText, message);
}

/**
 * Show floating popup with 3 feature icons
 */
function showFloatingPopup(range, selectedText) {
  hideFloatingPopup();

  try {
    const positionData = getPopupPosition(range);
    if (!positionData) return;

    const { rect, scrollX, scrollY } = positionData;
    let left = rect.left + scrollX - 5;
    let top = rect.top + scrollY - CONFIG.ICON_SIZE - 8;

    const totalWidth = (CONFIG.ICON_SIZE * 3) + (CONFIG.ICON_GAP * 2);
    const adjusted = adjustPosition(left, top, totalWidth, CONFIG.ICON_SIZE, positionData);
    left = adjusted.left;
    top = adjusted.top;

    // Create rewrite icon
    state.floatingPopup = document.createElement('button');
    state.floatingPopup.id = 'prompt-rewriter-popup';
    state.floatingPopup.className = 'pr-icon-btn';
    state.floatingPopup.innerHTML = '<span class="pr-icon-emoji">✨</span><span class="pr-tooltip">Refine Prompt</span>';
    state.floatingPopup.style.left = `${Math.round(left)}px`;
    state.floatingPopup.style.top = `${Math.round(top)}px`;

    // Create grammar icon
    state.grammarPopup = document.createElement('button');
    state.grammarPopup.id = 'prompt-grammar-popup';
    state.grammarPopup.className = 'pr-icon-btn pr-grammar-btn';
    state.grammarPopup.innerHTML = '<span class="pr-icon-emoji">✏️</span><span class="pr-tooltip">Grammarize</span>';
    state.grammarPopup.style.left = `${Math.round(left + CONFIG.ICON_SIZE + CONFIG.ICON_GAP)}px`;
    state.grammarPopup.style.top = `${Math.round(top)}px`;

    // Create email icon
    state.emailPopup = document.createElement('button');
    state.emailPopup.id = 'prompt-email-popup';
    state.emailPopup.className = 'pr-icon-btn pr-email-btn';
    state.emailPopup.innerHTML = '<span class="pr-icon-emoji">📧</span><span class="pr-tooltip">Format Email</span>';
    state.emailPopup.style.left = `${Math.round(left + (CONFIG.ICON_SIZE * 2) + (CONFIG.ICON_GAP * 2))}px`;
    state.emailPopup.style.top = `${Math.round(top)}px`;

    document.body.appendChild(state.floatingPopup);
    document.body.appendChild(state.grammarPopup);
    document.body.appendChild(state.emailPopup);

    // Create user icon after the 3 feature icons
    createUserIcon(left + (CONFIG.ICON_SIZE * 3) + (CONFIG.ICON_GAP * 3), top, positionData);

    // Add event listeners
    state.floatingPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      rewriteSelectedText(selectedText, range);
    });

    state.grammarPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      grammarizeSelectedText(selectedText, range);
    });

    state.emailPopup.addEventListener('click', (e) => {
      e.stopPropagation();
      formatEmailSelectedText(selectedText, range);
    });

    // Setup click outside handler
    setTimeout(() => {
      const handleClick = (e) => {
        if ((state.floatingPopup && !state.floatingPopup.contains(e.target)) &&
          (state.grammarPopup && !state.grammarPopup.contains(e.target)) &&
          (state.emailPopup && !state.emailPopup.contains(e.target)) &&
          (state.userPopup && !state.userPopup.contains(e.target))) {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0 || sel.toString().trim().length < CONFIG.MIN_SELECTION_LENGTH) {
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
    logError('showFloatingPopup', error);
  }
}

/**
 * Hide all floating popups
 */
function hideFloatingPopup() {
  if (state.floatingPopup) {
    state.floatingPopup.remove();
    state.floatingPopup = null;
  }
  if (state.grammarPopup) {
    state.grammarPopup.remove();
    state.grammarPopup = null;
  }
  if (state.emailPopup) {
    state.emailPopup.remove();
    state.emailPopup = null;
  }
  if (state.loginPopup) {
    state.loginPopup.remove();
    state.loginPopup = null;
  }
  if (state.userPopup) {
    state.userPopup.remove();
    state.userPopup = null;
  }
}

// ============================================================================
// API REQUESTS
// ============================================================================

/**
 * Make API request with authentication
 */
async function makeAuthenticatedRequest(endpoint, body) {
  if (!state.authToken) {
    const authStatus = await checkAuthStatus();
    if (!authStatus.authenticated) {
      throw new Error('Not authenticated');
    }
  }

  const serverUrl = await getServerUrl();

  const response = await fetch(`${serverUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.authToken}`,
    },
    body: JSON.stringify({ ...body, token: state.authToken }),
  });

  return response;
}

/**
 * Handle API response errors
 */
async function handleApiError(response, range, selectedText, processingFlag) {
  const errorData = await response.json().catch(() => ({}));

  // Handle usage limit exceeded (403)
  if (response.status === 403 && errorData.requiresSubscription) {
    hideFloatingPopup();
    showSubscriptionRequired(range, selectedText, errorData.message || 'Free trial exhausted. Please subscribe to continue.');
    state[processingFlag] = false;
    return true;
  }

  // Handle authentication errors (401)
  if (response.status === 401) {
    await deleteToken();
    state.authToken = null;
    state.isAuthenticated = false;
    hideFloatingPopup();
    showLoginButton(range, selectedText);
    state[processingFlag] = false;
    return true;
  }

  throw new Error(errorData.error || `Server error: ${response.status}`);
}

/**
 * Show loading state on popup
 */
function showLoadingState(popup) {
  if (popup) {
    popup.innerHTML = '<div class="pr-spinner-icon"></div>';
    popup.disabled = true;
    popup.classList.add('pr-loading');
    popup.style.pointerEvents = 'none';
  }
}

/**
 * Reset popup to original state
 */
function resetPopupState(popup, emoji, tooltip) {
  if (popup) {
    popup.innerHTML = `<span class="pr-icon-emoji">${emoji}</span><span class="pr-tooltip">${tooltip}</span>`;
    popup.disabled = false;
    popup.classList.remove('pr-loading');
    popup.style.pointerEvents = 'auto';
  }
}

// ============================================================================
// TEXT TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Rewrite selected text
 */
async function rewriteSelectedText(selectedText, range) {
  state.isProcessingRewrite = true;

  try {
    showLoadingState(state.floatingPopup);

    const response = await makeAuthenticatedRequest('/api/rewrite-prompt', {
      prompt: selectedText,
      format: 'default',
    });

    if (!response.ok) {
      const handled = await handleApiError(response, range, selectedText, 'isProcessingRewrite');
      if (handled) return;
    }

    const data = await response.json();
    replaceSelectedText(range, selectedText, data.rewrittenPrompt);

    await new Promise(resolve => setTimeout(resolve, 200));

    hideFloatingPopup();
    showSuccessIndicator();
  } catch (error) {
    logError('rewriteSelectedText', error);
    showErrorIndicator(error.message);
    resetPopupState(state.floatingPopup, '✨', 'Refine Prompt');
  } finally {
    state.isProcessingRewrite = false;
  }
}

/**
 * Grammarize selected text
 */
async function grammarizeSelectedText(selectedText, range) {
  state.isProcessingGrammar = true;

  try {
    showLoadingState(state.grammarPopup);

    const response = await makeAuthenticatedRequest('/api/grammarize', {
      text: selectedText,
    });

    if (!response.ok) {
      const handled = await handleApiError(response, range, selectedText, 'isProcessingGrammar');
      if (handled) return;
    }

    const data = await response.json();
    replaceSelectedText(range, selectedText, data.grammarizedText);

    await new Promise(resolve => setTimeout(resolve, 200));

    hideFloatingPopup();
    showSuccessIndicator();
  } catch (error) {
    logError('grammarizeSelectedText', error);
    showErrorIndicator(error.message);
    resetPopupState(state.grammarPopup, '✏️', 'Grammarize');
  } finally {
    state.isProcessingGrammar = false;
  }
}

/**
 * Format email from selected text
 */
async function formatEmailSelectedText(selectedText, range) {
  state.isProcessingEmail = true;

  try {
    showLoadingState(state.emailPopup);

    const response = await makeAuthenticatedRequest('/api/format-email', {
      text: selectedText,
    });

    if (!response.ok) {
      const handled = await handleApiError(response, range, selectedText, 'isProcessingEmail');
      if (handled) return;
    }

    const data = await response.json();
    replaceSelectedText(range, selectedText, data.formattedEmail, true);

    await new Promise(resolve => setTimeout(resolve, 200));

    hideFloatingPopup();
    showSuccessIndicator();
  } catch (error) {
    logError('formatEmailSelectedText', error);
    showErrorIndicator(error.message);
    resetPopupState(state.emailPopup, '📧', 'Format Email');
  } finally {
    state.isProcessingEmail = false;
  }
}

/**
 * Replace selected text in DOM
 */
function replaceSelectedText(range, originalText, rewrittenText, preserveFormatting = false) {
  try {
    range.deleteContents();

    if (preserveFormatting) {

      const fragment = document.createDocumentFragment();
      const lines = rewrittenText.split('\n');

      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        fragment.appendChild(document.createTextNode(line));
      });

      const parent = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

      if (parent && (parent.tagName === 'DIV' || parent.tagName === 'P' || parent.contentEditable === 'true' || parent.isContentEditable)) {
        range.insertNode(fragment);
      } else {
        const span = document.createElement('span');
        span.style.whiteSpace = 'pre-line';
        span.appendChild(fragment);
        range.insertNode(span);
      }
    } else {
      const textNode = document.createTextNode(rewrittenText);
      range.insertNode(textNode);
    }

    window.getSelection().removeAllRanges();
  } catch (error) {
    logError('replaceSelectedText', error);

    // Fallback replacement
    try {
      const parent = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

      if (parent) {
        const text = parent.textContent || parent.innerText || '';
        if (text.includes(originalText)) {
          if (preserveFormatting && (parent.tagName === 'DIV' || parent.tagName === 'P' || parent.contentEditable === 'true')) {
            // Safe replacement for block elements
            const parts = text.split(originalText);
            if (parts.length > 1) {
              parent.textContent = ''; // Clear content
              parts.forEach((part, index) => {
                parent.appendChild(document.createTextNode(part));
                if (index < parts.length - 1) {
                  const lines = rewrittenText.split('\n');
                  lines.forEach((line, lineIndex) => {
                    if (lineIndex > 0) parent.appendChild(document.createElement('br'));
                    parent.appendChild(document.createTextNode(line));
                  });
                }
              });
            }
          } else if (preserveFormatting) {
            const span = document.createElement('span');
            span.style.whiteSpace = 'pre-line';
            span.textContent = rewrittenText;

            // We can't easily safely replace a substring with an element in textContent
            // So we'll fall back to text replacement if possible, or careful node manipulation
            // For now, let's use a safer approach than innerHTML
            const range = document.createRange();
            const textNode = Array.from(parent.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes(originalText));

            if (textNode) {
              const start = textNode.textContent.indexOf(originalText);
              const end = start + originalText.length;
              range.setStart(textNode, start);
              range.setEnd(textNode, end);
              range.deleteContents();
              range.insertNode(span);
            }
          } else {
            if (parent.textContent !== undefined) {
              parent.textContent = text.replace(originalText, rewrittenText);
            } else {
              parent.innerText = text.replace(originalText, rewrittenText);
            }
          }
        }
      }
    } catch (e) {
      logError('replaceSelectedText fallback', e);
    }
  }
}

// ============================================================================
// UI FEEDBACK
// ============================================================================

/**
 * Show success indicator
 */
function showSuccessIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'pr-success-indicator';
  indicator.textContent = '✓ Success!';
  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 2000);
}

/**
 * Show error indicator
 */
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

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Redirect to login page
 */
async function redirectToLogin() {
  try {
    const loginUrl = await getLoginUrl();
    window.open(loginUrl, '_blank');
  } catch (error) {
    logError('redirectToLogin', error);
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
    logError('redirectToPricing', error);
  }
}

/**
 * Redirect to dashboard page
 */
async function redirectToDashboard() {
  try {
    const dashboardUrl = await getDashboardUrl();
    window.open(dashboardUrl, '_blank');
  } catch (error) {
    logError('redirectToDashboard', error);
  }
}

/**
 * Create and show user icon
 * @param {number} left - Left position for the icon
 * @param {number} top - Top position for the icon
 * @param {Object} positionData - Position data for adjustment
 * @param {boolean} setupHandler - Whether to setup click outside handler (default: true)
 */
function createUserIcon(left, top, positionData, setupHandler = true) {
  // Remove existing user icon if any
  if (state.userPopup) {
    state.userPopup.remove();
    state.userPopup = null;
  }

  // left parameter already includes the correct position, just adjust for boundaries
  const adjusted = adjustPosition(left, top, CONFIG.ICON_SIZE, CONFIG.ICON_SIZE, positionData);

  state.userPopup = document.createElement('button');
  state.userPopup.id = 'prompt-user-popup';
  state.userPopup.className = 'pr-icon-btn pr-user-btn';
  state.userPopup.innerHTML = '<span class="pr-icon-emoji">👤</span><span class="pr-tooltip">Dashboard</span>';
  state.userPopup.style.left = `${Math.round(adjusted.left)}px`;
  state.userPopup.style.top = `${Math.round(adjusted.top)}px`;

  document.body.appendChild(state.userPopup);

  state.userPopup.addEventListener('click', async (e) => {
    e.stopPropagation();
    await redirectToDashboard();
  });

  if (setupHandler) {
    setupClickOutsideHandler(state.userPopup);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize content script
 */
function init() {
  // Add event listeners
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('selectionchange', handleSelectionChange);
  window.addEventListener('promptRewriterAuth', handleAuthToken);
  window.addEventListener('promptRewriterLogout', handleLogout);

  // Setup storage change listener
  if (isExtensionContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (!isExtensionContextValid()) return;

        if (areaName === 'sync' && changes.authToken) {
          const newToken = changes.authToken.newValue;

          if (newToken && newToken.token) {
            checkAuthStatus().then((status) => {
              if (status.authenticated) {
                state.authToken = newToken.token;
                state.isAuthenticated = true;
              } else {
                state.authToken = null;
                state.isAuthenticated = false;
              }
              setTimeout(() => checkSelection(), 200);
            }).catch((err) => {
              logError('checkAuthStatus after storage change', err);
              // Optimistic update
              state.authToken = newToken.token;
              state.isAuthenticated = true;
              setTimeout(() => checkSelection(), 200);
            });
          } else {
            state.authToken = null;
            state.isAuthenticated = false;
            hideFloatingPopup();
          }
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        state.extensionContextValid = false;
        console.warn('Extension context invalidated, storage listener not available');
      }
    }
  }

  // Sync token from localStorage
  syncTokenFromLocalStorage();

  // Setup periodic sync (reduced frequency to avoid quota issues)
  if (isExtensionContextValid()) {
    state.syncInterval = setInterval(() => {
      if (!isExtensionContextValid()) {
        state.extensionContextValid = false;
        if (state.syncInterval) {
          clearInterval(state.syncInterval);
          state.syncInterval = null;
        }
        return;
      }
      syncTokenFromLocalStorage().catch((err) => {
        if (err && err.message && err.message.includes('Extension context invalidated')) {
          state.extensionContextValid = false;
          if (state.syncInterval) {
            clearInterval(state.syncInterval);
            state.syncInterval = null;
          }
        }
      });
    }, CONFIG.SYNC_INTERVAL);
  }

  // Initial auth check
  checkAuthStatus().then((status) => {
    console.log('Initial auth check on page load:', status);
  }).catch((err) => {
    logError('Initial auth check', err);
  });

  // Add styles
  addStyles();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle messages from background script
 */
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

// ============================================================================
// STYLES
// ============================================================================

/**
 * Add CSS styles to page
 */
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

// ============================================================================
// BOOTSTRAP
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
