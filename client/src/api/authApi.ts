import axiosInstance from './axiosInstance';
import type { AuthResponse } from '@/types/auth';

/**
 * 로그인 API를 호출한다.
 *
 * @param loginId  사용자 로그인 ID
 * @param password 비밀번호
 * @returns 인증 응답 (Access Token, Refresh Token, 사용자 정보)
 */
export async function login(loginId: string, password: string): Promise<AuthResponse> {
  const res = await axiosInstance.post<AuthResponse>('/auth/login', { loginId, password });
  return res.data;
}

/**
 * 회원가입 API를 호출한다.
 *
 * @param loginId  사용자 로그인 ID
 * @param password 비밀번호
 * @param name     사용자 표시 이름
 * @returns 인증 응답 (가입 후 자동 로그인)
 */
export async function signup(
  loginId: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await axiosInstance.post<AuthResponse>('/auth/signup', {
    loginId,
    password,
    name,
  });
  return res.data;
}
