/** localStorage에 저장하는 키 상수. 인증 정보를 영속화하는 데 사용한다. */
export const STORAGE_KEYS = {
  /** JWT Access Token */
  ACCESS_TOKEN: 'accessToken',
  /** UUID Refresh Token */
  REFRESH_TOKEN: 'refreshToken',
  /** 사용자 로그인 ID */
  LOGIN_ID: 'loginId',
  /** 사용자 표시 이름 */
  NAME: 'name',
} as const;
