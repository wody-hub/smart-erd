import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

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

/** 토큰 갱신 진행 여부 플래그 */
let isRefreshing = false;

/** 갱신 대기 중인 실패 요청 큐 */
let failedQueue: { resolve: (token: string) => void; reject: (error: unknown) => void }[] = [];

/** 큐에 쌓인 요청들을 처리한다. */
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
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('loginId');
  localStorage.removeItem('name');
  window.location.href = '/login';
}

/** 요청 인터셉터: localStorage의 Access Token을 Authorization 헤더에 첨부한다. */
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
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
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const res = await axios.post('/api/auth/refresh', { refreshToken });
        const newAccessToken: string = res.data.accessToken;
        const newRefreshToken: string = res.data.refreshToken;

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

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
