import axios from 'axios';
import { store } from '@/store/configureStore';
import { clearAuthData } from '@/store/slice/authSlice';
import { toast } from 'sonner';

let isRedirecting = false;

/**
 * Настройка axios interceptors для глобальной обработки ошибок
 */
export function setupAxiosInterceptors() {
  
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        console.log('[axios] 401 Unauthorized detected');
        
        if (!isRedirecting) {
          isRedirecting = true;
          
          store.dispatch(clearAuthData());
          localStorage.removeItem('authToken');
          delete axios.defaults.headers.common['Authorization'];
          
          toast.error('Сессия истекла', {
            description: 'Пожалуйста, войдите снова',
          });
          
          setTimeout(() => {
            window.location.href = '/login';
            isRedirecting = false;
          }, 500);
        }
      }
      
      return Promise.reject(error);
    }
  );
}
