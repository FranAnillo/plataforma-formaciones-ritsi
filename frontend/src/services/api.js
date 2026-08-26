import axios from 'axios';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true, // Importante para que las cookies de sesión se envíen
});

export function submitPostInNewTab(endpoint) {
  if (typeof endpoint !== 'string' || !/^\/[A-Za-z0-9/_%.-]+$/.test(endpoint)) {
    throw new Error('El endpoint de navegación no es válido');
  }

  const targetName = `ritsi-post-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  const targetWindow = window.open('about:blank', targetName);
  if (!targetWindow) return false;
  targetWindow.opener = null;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${BACKEND_URL}/api${endpoint}`;
  form.target = targetName;
  form.acceptCharset = 'UTF-8';
  form.hidden = true;
  document.body.appendChild(form);
  form.submit();
  form.remove();
  return true;
}

API.interceptors.response.use(
  response => response,
  error => {
    const endpoint = error.config?.url || '';
    const isAuthenticationProbe = endpoint.endsWith('/auth/me') || endpoint.endsWith('/auth/login') || endpoint.endsWith('/auth/register');
    if (error.response?.status === 401 && !isAuthenticationProbe) {
      window.dispatchEvent(new CustomEvent('ritsi:session-expired'));
    }
    return Promise.reject(error);
  },
);

export const fetchAllData = (endpoints) => {
  const requests = endpoints.map(endpoint => API.get(endpoint));
  return Promise.all(requests);
};

export const api = {
  get: (endpoint, config) => API.get(endpoint, config),
  post: (endpoint, data, config) => API.post(endpoint, data, config),
  put: (endpoint, data, config) => API.put(endpoint, data, config),
  patch: (endpoint, data, config) => API.patch(endpoint, data, config),
  delete: (endpoint, config) => API.delete(endpoint, config),
};

export default API;
