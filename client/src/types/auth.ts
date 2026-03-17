/** 로그인/회원가입 API 응답 구조. */
export interface AuthResponse {
  /** JWT Access Token */
  accessToken: string;
  /** UUID Refresh Token */
  refreshToken: string;
  /** 사용자 로그인 ID */
  loginId: string;
  /** 사용자 표시 이름 */
  name: string;
}
