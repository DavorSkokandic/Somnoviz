// API Configuration for SomnoViz
// This allows the app to work in any environment without hardcoding URLs

export const apiConfig = {
  // Base URL for API calls
  // In development: uses the dev server proxy
  // In production: uses your Railway backend URL
  baseURL: import.meta.env.PROD 
    ? 'https://somnoviz-backend1-production.up.railway.app/api'  // Your Railway URL
    : '/api', // Development proxy
  
  // Debug info
  isDev: !import.meta.env.PROD,
  currentURL: typeof window !== 'undefined' ? window.location.origin : 'unknown',
  
  // Full base URL (only used if you need absolute URLs)
  getFullBaseURL: () => {
    if (typeof window !== 'undefined') {
      // Browser environment - construct from current location
      const { protocol, hostname } = window.location;
      const basePort = import.meta.env.PROD ? '' : ':5000';
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

// Debug logging
console.log('[API Config Debug]', {
  isDev: apiConfig.isDev,
  baseURL: apiConfig.baseURL,
  currentURL: apiConfig.currentURL,
  uploadEndpoint: endpoints.upload
});

export default apiConfig;
