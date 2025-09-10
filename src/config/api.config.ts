// API Configuration for SomnoViz
// This allows the app to work in any environment without hardcoding URLs

export const apiConfig = {
  // Base URL for API calls
  // In development: uses the dev server proxy or relative paths
  // In production: uses relative paths to work with any domain
  baseURL: process.env.NODE_ENV === 'production' 
    ? '/api'  // Relative path for production
    : '/api', // Relative path for development (assumes proxy setup)
  
  // Full base URL (only used if you need absolute URLs)
  getFullBaseURL: () => {
    if (typeof window !== 'undefined') {
      // Browser environment - construct from current location
      const { protocol, hostname, port } = window.location;
      const basePort = process.env.NODE_ENV === 'production' ? '' : ':5000';
      return `${protocol}//${hostname}${basePort}/api`;
    }
    // Server-side rendering fallback
    return '/api';
  }
};

// API endpoints
export const endpoints = {
  // Upload endpoints
  upload: `${apiConfig.baseURL}/upload`,
  edfChunk: `${apiConfig.baseURL}/upload/edf-chunk`,
  edfMultiChunk: `${apiConfig.baseURL}/upload/edf-multi-chunk`,
  edfChunkDownsample: `${apiConfig.baseURL}/upload/edf-chunk-downsample`,
  maxMinValues: `${apiConfig.baseURL}/upload/max-min-values`,
  ahiAnalysis: `${apiConfig.baseURL}/upload/ahi-analysis`,
  
  // Cleanup endpoints
  cleanupStats: `${apiConfig.baseURL}/cleanup/stats`,
  cleanupManual: `${apiConfig.baseURL}/cleanup/manual`
};

export default apiConfig;
