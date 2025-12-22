// src/lib/apiClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { SERVER_ENDPOINTS } from '@/lib/config'; 
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { LOGGER } from './loger';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
  _retryCount?: number;
}

const INACTIVITY_TIMEOUT = 20000; 

export const apiClient = axios.create({
  timeout: 0, 
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    
    const authToken = useAuthStore.getState().authToken
    const activeEndPoint = useSettingsStore.getState().activeEndPoint
    
    if (activeEndPoint) {
      config.baseURL = activeEndPoint;
    }

    const token = authToken;
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!config.signal) {
        const controller = new AbortController();
        config.signal = controller.signal;

        let timer = setTimeout(() => {
            controller.abort("Inactivity timeout");
        }, INACTIVITY_TIMEOUT);

        const originalProgress = config.onDownloadProgress;

        config.onDownloadProgress = (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                controller.abort("Inactivity timeout");
            }, INACTIVITY_TIMEOUT);

            if (originalProgress) originalProgress(e);
        };
    }

    return config;
  },
  (error) => Promise.reject(error)
);
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // switch endpoint
    if (!error.response && originalRequest && !originalRequest._retryCount) {
      console.warn('ApiClient: Network Error. Trying to switch endpoint...');
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      const currentEndpoint = useSettingsStore.getState().activeEndPoint;
      const nextEndpoint = currentEndpoint === SERVER_ENDPOINTS.main 
        ? SERVER_ENDPOINTS.proxy 
        : SERVER_ENDPOINTS.main;
      
      useSettingsStore.getState().setActiveEndpoint(nextEndpoint);
      originalRequest.baseURL = nextEndpoint;
      return apiClient(originalRequest);
    }

    // silent relogin
    if (error.response?.status === 401 && originalRequest && !originalRequest._isRetry) {
      originalRequest._isRetry = true;

      if ((originalRequest._retryCount || 0) > 2) {
        return Promise.reject(error);
      }

      console.log('ApiClient: 401 Detected. Silent Re-login...');

      try {
        const authState = useAuthStore.getState();
        const settingsState = useSettingsStore.getState();
        const { username: userLogin, password: userPassword } = authState;
        const activeEndpoint = settingsState.activeEndPoint;

        if (!userLogin || !userPassword) {
          return Promise.reject(new Error('No credentials'));
        }

        const { data } = await axios.post(`${activeEndpoint}/auth/signin`, {
          username: userLogin,
          password: userPassword,
        });

        if (data.token) {
          console.log('ApiClient: Re-login success');
          
          useAuthStore.getState().setAuthCredits(userLogin, userPassword, data.token);
          useAuthStore.getState().setAuthStatus('authenticated')

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.token}`;
          }
          
          originalRequest.baseURL = useSettingsStore.getState().activeEndPoint;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        LOGGER.error('Api-login failed', refreshError);
      }
    }

    return Promise.reject(error);
  }
);
