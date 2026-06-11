import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

// Dynamic import helper to avoid circular deps
const getAuthState = async () => {
  const { useAuthStore } = await import('../store/authStore');
  return useAuthStore.getState();
};

// Request interceptor — attach access token synchronously from Zustand
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Access zustand store synchronously (it's already loaded by the time requests fire)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authModule = (window as any).__authStore__;
  const token = authModule ? authModule.getState().accessToken : null;
  if (!token) {
    // Try to get from localStorage directly as fallback
    try {
      const stored = JSON.parse(localStorage.getItem('dslrworld-auth') || '{}');
      const storedToken = stored?.state?.accessToken;
      if (storedToken && config.headers) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
    } catch { /* ignore */ }
  } else if (config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const authState = await getAuthState();
        const { refreshToken, setTokens } = authState;

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;

        setTokens(newAccess, newRefresh);
        processQueue(null, newAccess);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        const authState = await getAuthState();
        authState.logout();
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
