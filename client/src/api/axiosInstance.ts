import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import { ROUTES } from '@/constants/routes';
import i18n from '@/i18n';
import { clearAuthState, refreshAccessToken } from '@/lib/auth-refresh';

/**
 * API 통신용 Axios 인스턴스.
 *
 * `baseURL`이 `/api`로 설정되어 Vite 프록시를 통해 백엔드(`localhost:8190`)로 전달된다.
 * 요청 인터셉터에서 localStorage의 Access Token을 Authorization 헤더에 자동으로 첨부한다.
 * 401 응답 시 Refresh Token으로 자동 갱신을 시도한다 (큐 패턴).
 */
const axiosInstance = axios.create({
  baseURL: '/api',
});

/** 인증 정보를 삭제하고 로그인 페이지로 이동한다. */
function clearAuthAndRedirect() {
  clearAuthState();
  window.location.href = ROUTES.LOGIN;
}

/** 요청 인터셉터: Accept-Language 헤더와 Access Token을 첨부한다. */
axiosInstance.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language || 'en';
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 응답 인터셉터: 401 응답 시 Refresh Token으로 자동 갱신을 시도한다. */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
