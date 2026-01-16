import axios from 'axios';
import { API_URL } from '../config/config.js';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage
      clearAuth();
      // Dispatch custom event for auth error
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

// Get token from localStorage
const getToken = () => {
  const authData = localStorage.getItem('authToken');
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.token;
    } catch (e) {
      return null;
    }
  }
  return null;
};

// Clear authentication data
const clearAuth = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

// Auth API endpoints
export const authAPI = {
  register: async (email, name, password) => {
    const response = await api.post('/api/register', { email, name, password });
    return response.data;
  },

  login: async (email, password) => {
    const response = await api.post('/api/login', { email, password });
    return response.data;
  },

  validateToken: async (token) => {
    const response = await api.post('/api/validate-token', { token });
    return response.data;
  },
};

// User API endpoints
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/api/user/profile');
    return response.data;
  },

  getUsage: async () => {
    const response = await api.get('/api/user/usage');
    return response.data;
  },
};

// Payment API endpoints
export const paymentAPI = {
  createOrder: async (amount, plan = 'monthly') => {
    const response = await api.post('/api/payment/create-order', { amount, plan });
    return response.data;
  },

  verifyPayment: async (paymentData) => {
    const response = await api.post('/api/payment/verify-payment', paymentData);
    return response.data;
  },

  getPaymentStatus: async (orderId) => {
    const response = await api.get(`/api/payment/payment-status?orderId=${orderId}`);
    return response.data;
  },
};

// Contact API endpoints
export const contactAPI = {
  submitContact: async (subject, message) => {
    const response = await api.post('/api/contact/submit', { subject, message });
    return response.data;
  },

  getContactHistory: async () => {
    const response = await api.get('/api/contact/history');
    return response.data;
  },
};

// Export the api instance for custom requests
export default api;
