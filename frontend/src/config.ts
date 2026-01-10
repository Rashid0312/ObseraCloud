// API configuration
// In production (via Nginx), use relative path which gets proxied to backend
// In local development, use full URL to backend
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
