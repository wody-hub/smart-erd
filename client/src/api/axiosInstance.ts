import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import { ROUTES } from '@/constants/routes';
import i18n from '@/i18n';

/**
 * API 통신용 Axios 인스턴스.
 *
 * `baseURL`이 `/api`로 설정되어 Vite 프록시를 통해 백엔드(`localhost:8080`)로 전달된다.
 * 요청 인터셉터에서 localStorage의 Access Token을 Authorization 헤더에 자동으로 첨부한다.
 * 401 응답 시 Refresh Token으로 자동 갱신을 시도한다 (큐 패턴).
 */
const axiosInstance = axios.create({
  baseURL: '/api',
});

/** 토큰 갱신 API 호출 진행 여부. 동시 다발적 401에 대해 단일 갱신만 수행하기 위한 플래그. */
let isRefreshing = false;

/** 토큰 갱신 대기 중인 실패 요청 큐. 갱신 완료 시 일괄 재시도된다. */
let failedQueue: { resolve: (token: string) => void; reject: (error: unknown) => void }[] = [];

/**
 * 큐에 쌓인 요청들을 처리한다.
 *
 * @param error 갱신 실패 시 에러 (성공 시 null)
 * @param token 갱신된 Access Token (실패 시 null)
 */
function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  failedQueue = [];
}

/** 인증 정보를 삭제하고 로그인 페이지로 이동한다. */
function clearAuthAndRedirect() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.LOGIN_ID);
  localStorage.removeItem(STORAGE_KEYS.NAME);
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
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const res = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken: string = res.data.accessToken;
        const newRefreshToken: string = res.data.refreshToken;

        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
