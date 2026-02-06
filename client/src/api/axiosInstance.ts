import axios from 'axios';

/**
 * API 통신용 Axios 인스턴스.
 *
 * `baseURL`이 `/api`로 설정되어 Vite 프록시를 통해 백엔드(`localhost:8080`)로 전달된다.
 * 요청 인터셉터에서 localStorage의 JWT 토큰을 Authorization 헤더에 자동으로 첨부한다.
 */
const axiosInstance = axios.create({
  baseURL: '/api',
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;
