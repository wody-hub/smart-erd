import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import i18n from '@/i18n';
import { clearAuthState, refreshAccessToken } from '@/lib/auth-refresh';
import { getApiBaseUrl, redirectToLogin } from '@/lib/platform';

/**
 * API 통신용 Axios 인스턴스.
 *
 * baseURL은 request interceptor에서 매 요청마다 동적으로 결정된다.
 * - Web: '/api' (Vite 프록시 → localhost:8190)
 * - Electron: '{serverUrl}/api' (직접 HTTP 요청)
 *
 * 요청 인터셉터에서 localStorage의 Access Token을 Authorization 헤더에 자동으로 첨부한다.
 * 401 응답 시 Refresh Token으로 자동 갱신을 시도한다 (큐 패턴).
 */
const axiosInstance = axios.create();

/** 인증 정보를 삭제하고 로그인 페이지로 이동한다. */
function clearAuthAndRedirect() {
  clearAuthState();
  redirectToLogin();
}

/** 요청 인터셉터: baseURL 동적 결정 + Accept-Language 헤더 + Access Token 첨부. */
axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  config.headers['Accept-Language'] = i18n.language || 'en';
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 토큰 갱신 진행 중 여부 */
let isRefreshing = false;
/** 갱신 완료 후 재시도할 대기 중인 요청 큐 */
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

/** 대기 큐의 요청들을 처리한다. */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    } else {
      prom.reject(new Error('Token refresh failed'));
    }
  });
  failedQueue = [];
};

/** 응답 인터셉터: 401 응답 시 Refresh Token으로 자동 갱신을 시도한다. */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // 이미 갱신 중이면 성공 시까지 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
