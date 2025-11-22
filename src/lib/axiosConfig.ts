import axios from 'axios';
import { store } from '@/store/configureStore';
import { clearAuthData, setUserData } from '@/store/slice/authSlice'; // Добавь setUserData
import { toast } from 'sonner';

let isRedirecting = false;

export function setupAxiosInterceptors() {

  // Request Interceptor (оставляем как был)
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

  // Response Interceptor (модифицируем)
  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // Если ошибка 401 и мы еще не пытались повторить этот запрос (_retry флаг)
      if (error.response?.status === 401 && !originalRequest._retry) {
        
        // Помечаем, что запрос уже повторялся, чтобы избежать бесконечного цикла
        originalRequest._retry = true;

        // 1. Достаем данные из Redux Store
        const state = store.getState();
        // ВАЖНО: Проверь название слайса в rootReducer. 
        // В твоем коде LoginPage используется state.authSlice, поэтому беру оттуда.
        const { userLogin, userPassword } = state.authSlice; 
        const { activeEndPoint } = state.settingsState;

        // 2. Если есть логин и пароль, пробуем перелогиниться
        if (userLogin && userPassword && activeEndPoint) {
          try {
            console.log('[axios] 401 detected. Attempting silent re-login...');

            // Делаем запрос на вход (используем чистый axios или создаем новый инстанс, 
            // чтобы не триггерить интерцепторы снова на этом запросе, если он упадет)
            const { data } = await axios.post(
              `${activeEndPoint}/auth/signin`, 
              { username: userLogin, password: userPassword },
              { headers: { 'Content-Type': 'application/json' } }
            );

            // 3. Если успех — обновляем данные
            if (data.token) {
              // Обновляем localStorage
              localStorage.setItem('authToken', data.token);
              
              // Обновляем дефолтные заголовки
              axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
              
              // Обновляем Redux
              store.dispatch(setUserData({
                authToken: data.token,
                authStatus: true,
                // Логин/пароль и так там есть, но можно обновить статус
              }));

              // 4. Повторяем исходный запрос с новым токеном
              originalRequest.headers['Authorization'] = `Bearer ${data.token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error('[axios] Silent login failed', refreshError);
            // Если перелогин не удался — проваливаемся ниже к логике логаута
          }
        }
      }

      // === СТАНДАРТНАЯ ЛОГИКА ЛОГАУТА (FALLBACK) ===
      // Сюда попадаем, если:
      // 1. Нет сохраненных логина/пароля
      // 2. Ре-логин тоже вернул ошибку (пароль сменили, сервер лежит и т.д.)
      if (error.response?.status === 401) {
        if (!isRedirecting) {
          isRedirecting = true;
          
          store.dispatch(clearAuthData());
          localStorage.removeItem('authToken');
          delete axios.defaults.headers.common['Authorization'];
          
          toast.error('Сессия истекла', {
            description: 'Не удалось автоматически продлить сессию. Войдите снова.',
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
