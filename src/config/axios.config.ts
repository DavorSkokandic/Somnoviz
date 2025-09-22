// Axios Configuration for SomnoViz
import axios from 'axios';
import { apiConfig } from './api.config';

// Create axios instance with proper timeout and error handling
export const axiosInstance = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: 600000, // 10 minutes timeout for EDF processing (Render free tier is slower)
  headers: {
    'Content-Type': 'application/json', // Default to JSON, override for file uploads
  },
  // Important: Don't set withCredentials to true unless your backend specifically supports it
  withCredentials: false,
});

// Request interceptor for debugging
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`[AXIOS REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    console.log('[AXIOS REQUEST] Base URL:', config.baseURL);
    console.log('[AXIOS REQUEST] Full URL:', `${config.baseURL}${config.url}`);
    console.log('[AXIOS REQUEST] Headers before:', config.headers);
    console.log('[AXIOS REQUEST] Data type:', typeof config.data);
    console.log('[AXIOS REQUEST] Data:', config.data);
    
    // Ensure Content-Type is set correctly for JSON requests (but NOT for FormData)
    if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
      // Only set Content-Type if it's not already set or if it's not multipart
      if (!config.headers['Content-Type'] || config.headers['Content-Type'] === 'multipart/form-data') {
        config.headers['Content-Type'] = 'application/json';
        console.log('[AXIOS REQUEST] Set Content-Type to application/json for JSON data');
      }
    } else if (config.data instanceof FormData) {
      // For FormData, let axios set the Content-Type with boundary
      delete config.headers['Content-Type'];
      console.log('[AXIOS REQUEST] Removed Content-Type header for FormData (let axios set with boundary)');
    }
    
    console.log('[AXIOS REQUEST] Headers after:', config.headers);
    return config;
  },
  (error) => {
    console.error('[AXIOS REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging and error handling
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`[AXIOS RESPONSE] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[AXIOS RESPONSE ERROR]', error);
    
    if (error.code === 'ECONNABORTED') {
      console.error('[AXIOS TIMEOUT] Request timed out after 10 minutes');
      error.message = 'Request timed out. The EDF file is large or the server is under heavy load. Please try with a smaller file or wait a few minutes and try again.';
    } else if (error.response?.status === 0) {
      console.error('[AXIOS NETWORK ERROR] Network error or CORS issue');
      error.message = 'Network error. Please check your internet connection and try again.';
    } else if (error.response?.status >= 500) {
      console.error('[AXIOS SERVER ERROR] Server error:', error.response?.data);
      error.message = `Server error: ${error.response?.data?.error || 'Internal server error'}`;
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
