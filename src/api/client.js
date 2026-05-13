import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://13.201.94.169/wheely/';

// const baseURL = 'http://13.204.13.27/wheely/';


const client = axios.create({
  baseURL,
  withCredentials: true, // web flow uses HttpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token (currently a dummy stub stored in localStorage by Login).
// When real auth lands, swap this read with the AuthContext's accessToken.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin.access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → refresh-and-retry placeholder. Wired for the real flow later via
// the cookie-based /user/auth/refresh-token/web endpoint.
let refreshPromise = null;
client.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/refresh-token')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = client
            .post('/user/auth/refresh-token/web', {}, { withCredentials: true })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const resp = await refreshPromise;
        const newToken = resp?.data?.data?.accessToken;
        if (newToken) {
          localStorage.setItem('admin.access_token', newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return client(original);
        }
      } catch {
        // fall through to logout
      }
      // refresh failed — clear and bounce to login.
      localStorage.removeItem('admin.access_token');
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export default client;
