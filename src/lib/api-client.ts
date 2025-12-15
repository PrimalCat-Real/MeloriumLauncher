// src/lib/apiClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store/configureStore';
import { setUserData, clearAuthData } from '@/store/slice/authSlice';
import { setActiveEndPoint } from '@/store/slice/settingsSlice';
import { SERVER_ENDPOINTS } from '@/lib/config'; 

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
    const state = store.getState();
    const { authSlice, settingsState } = state;

    const activeEndpoint = settingsState.activeEndPoint;
    if (activeEndpoint) {
      config.baseURL = activeEndpoint;
    }

    const token = authSlice.authToken;
    
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

    if (!error.response && originalRequest && !originalRequest._retryCount) {
        console.warn('ApiClient: Network Error. Trying to switch endpoint...');
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        const currentEndpoint = store.getState().settingsState.activeEndPoint;
        const nextEndpoint = currentEndpoint === SERVER_ENDPOINTS.main 
            ? SERVER_ENDPOINTS.proxy 
            : SERVER_ENDPOINTS.main;
        
        store.dispatch(setActiveEndPoint({ activeEndPoint: nextEndpoint }));
        
        originalRequest.baseURL = nextEndpoint;
        return apiClient(originalRequest);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._isRetry) {
      originalRequest._isRetry = true;

      if ((originalRequest._retryCount || 0) > 2) {
          store.dispatch(clearAuthData());
          return Promise.reject(error);
      }

      console.log('ApiClient: 401 Detected. Silent Re-login...');

      try {
        const state = store.getState();
        const { userLogin, userPassword } = state.authSlice;
        const activeEndpoint = state.settingsState.activeEndPoint;

        if (!userLogin || !userPassword) throw new Error('No credentials');

        const { data } = await axios.post(`${activeEndpoint}/auth/signin`, {
          username: userLogin,
          password: userPassword,
        });

        if (data.token) {
            console.log('ApiClient: Re-login success');
            
            store.dispatch(setUserData({ 
                authToken: data.token, 
                authStatus: true, 
                userLogin, 
                userPassword 
            }));

            if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${data.token}`;
            }
            
            originalRequest.baseURL = store.getState().settingsState.activeEndPoint;
            
            return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('ApiClient: Re-login failed', refreshError);
        store.dispatch(clearAuthData());
      }
    }

    return Promise.reject(error);
  }
);
