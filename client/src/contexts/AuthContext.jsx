import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { getUserFromToken } from '../utils/jwt';
import { API_URL } from '../config/config.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authData = localStorage.getItem('authToken');
      if (authData) {
        const parsed = JSON.parse(authData);
        const tokenValue = parsed.token;
        
        if (!tokenValue) {
          console.log('No token found in auth data');
          clearAuth();
          setLoading(false);
          return;
        }
        
        // First, try to decode token locally to check if it's valid format
        const userFromToken = getUserFromToken(tokenValue);
        if (!userFromToken) {
          console.log('Token format is invalid');
          clearAuth();
          setLoading(false);
          return;
        }
        
        // Set user from token immediately (optimistic update)
        setToken(tokenValue);
        setUser(userFromToken);
        setIsAuthenticated(true);
        setLoading(false);
        
        // Then validate token with backend in the background
        try {
          const result = await authAPI.validateToken(tokenValue);
          
          if (result.valid) {
            // Token is valid, update user info from server response if available
            if (result.user) {
              setUser(result.user);
            }
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear auth
            console.log('Token validation failed:', result);
            clearAuth();
            setIsAuthenticated(false);
          }
        } catch (error) {
          // Network error or server error - don't clear auth, keep user logged in
          // Token might still be valid, just server is unreachable
          console.warn('Token validation request failed (network/server error):', error);
          // Keep user logged in with token from localStorage
          // They can still use the app, but some features might not work
        }
      } else {
        clearAuth();
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Only clear auth if it's a parsing error, not a network error
      if (error.message && error.message.includes('JSON')) {
        clearAuth();
      }
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.success && response.token) {
        const authData = {
          token: response.token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        };
        
        localStorage.setItem('authToken', JSON.stringify(authData));
        
        // Dispatch custom event for extension content script to pick up
        window.dispatchEvent(new CustomEvent('promptRewriterAuth', {
          detail: {
            token: response.token,
            serverUrl: API_URL
          }
        }));
        
        setToken(response.token);
        // Extract user info from token instead of storing it
        const userFromToken = getUserFromToken(response.token);
        if (userFromToken) {
          setUser(userFromToken);
        } else {
          // Fallback to server response if token decode fails
          setUser(response.user);
        }
        setIsAuthenticated(true);
        
        return { success: true, user: userFromToken || response.user };
      } else {
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed'
      };
    }
  };

  const register = async (email, name, password) => {
    try {
      const response = await authAPI.register(email, name, password);
      
      if (response.success && response.token) {
        const authData = {
          token: response.token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        };
        
        localStorage.setItem('authToken', JSON.stringify(authData));
        
        // Dispatch custom event for extension content script to pick up
        window.dispatchEvent(new CustomEvent('promptRewriterAuth', {
          detail: {
            token: response.token,
            serverUrl: API_URL
          }
        }));
        
        setToken(response.token);
        // Extract user info from token instead of storing it
        const userFromToken = getUserFromToken(response.token);
        if (userFromToken) {
          setUser(userFromToken);
        } else {
          // Fallback to server response if token decode fails
          setUser(response.user);
        }
        setIsAuthenticated(true);
        
        return { success: true, user: userFromToken || response.user };
      } else {
        return { success: false, error: response.error || 'Registration failed' };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Registration failed'
      };
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('authToken');
    // Don't store user in localStorage anymore
    
    // Also clear from chrome.storage.sync for extension
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.remove(['authToken'], () => {
        console.log('Token removed from extension storage');
      });
    }
    
    // Dispatch logout event for extension content script
    window.dispatchEvent(new CustomEvent('promptRewriterLogout'));
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
