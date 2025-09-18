// API Configuration for SomnoViz
// This allows the app to work in any environment without hardcoding URLs

export const apiConfig = {
  // Base URL for API calls
  // In development: uses the dev server proxy
  // In production: uses your Fly.io backend URL
  baseURL: import.meta.env.PROD 
    ? 'https://somnoviz-backend1.fly.dev/api'  // Your Fly.io URL
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

// API endpoints (relative paths since axios instance already has baseURL)
export const endpoints = {
  // Upload endpoints
  upload: `/upload`,
  edfChunk: `/upload/edf-chunk`,
  edfMultiChunk: `/upload/edf-multi-chunk`,
  edfChunkDownsample: `/upload/edf-chunk-downsample`,
  maxMinValues: `/upload/max-min-values`,
  ahiAnalysis: `/upload/ahi-analysis`,
  
  // Cleanup endpoints
  cleanupStats: `/cleanup/stats`,
  cleanupManual: `/cleanup/manual`
};

// Debug logging
console.log('[API Config Debug]', {
  isDev: apiConfig.isDev,
  baseURL: apiConfig.baseURL,
  currentURL: apiConfig.currentURL,
  uploadEndpoint: `${apiConfig.baseURL}${endpoints.upload}`
});

export default apiConfig;
