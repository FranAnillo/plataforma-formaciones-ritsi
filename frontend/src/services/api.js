import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true, // Importante para que las cookies de sesión se envíen
});

export const fetchAllData = (endpoints) => {
  const requests = endpoints.map(endpoint => API.get(endpoint));
  return Promise.all(requests);
};

export const api = {
  get: (endpoint, config) => API.get(endpoint, config),
  post: (endpoint, data, config) => API.post(endpoint, data, config),
  put: (endpoint, data, config) => API.put(endpoint, data, config),
  delete: (endpoint, config) => API.delete(endpoint, config),
};

export default API;