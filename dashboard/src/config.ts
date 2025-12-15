// Central config for dashboard API
// Set VITE_API_BASE_URL in your env for production (e.g. https://your-service.up.railway.app)
// In dev, this will default to http://localhost:3001

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

// Normalize base URL (no trailing slash)
const normalizedBaseUrl = rawBaseUrl
  ? rawBaseUrl.replace(/\/+$/, '')
  : 'http://localhost:3001';

export const API_BASE_URL = normalizedBaseUrl;
