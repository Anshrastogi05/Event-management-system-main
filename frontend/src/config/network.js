function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

function normalizeBackendOrigin(value = '') {
  const trimmedValue = trimTrailingSlash(value.trim());
  return trimmedValue.replace(/\/api$/i, '');
}

const configuredApiUrl = normalizeBackendOrigin(import.meta.env.VITE_API_URL || '');
const configuredSocketUrl = trimTrailingSlash((import.meta.env.VITE_SOCKET_URL || '').trim());
const localBackendOrigin = 'http://localhost:5050';

export const API_BASE_URL = configuredApiUrl || '';

export const SOCKET_URL = configuredSocketUrl || configuredApiUrl || (import.meta.env.DEV ? localBackendOrigin : '');

if (!import.meta.env.DEV && (!configuredApiUrl || !SOCKET_URL)) {
  console.warn(
    'Missing VITE_API_URL or VITE_SOCKET_URL. Set them to your deployed backend origin in production.',
  );
}
