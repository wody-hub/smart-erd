/** 팀 멤버 역할. ADMIN은 팀 관리 권한, MEMBER는 편집 권한, VIEWER는 읽기 전용. */
export type TeamMemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/** 팀 목록 조회 시 반환되는 팀 요약 정보. */
export interface Team {
  /** 팀 고유 ID */
  id: number;
  /** 팀 이름 */
  name: string;
  /** 팀 소유자 표시 이름 */
  ownerName: string;
  /** 팀 멤버 수 */
  memberCount: number;
  /** 팀 생성 일시 (ISO 8601) */
  createdAt: string;
}

/** 팀 멤버 정보. */
export interface TeamMember {
  /** 사용자 고유 ID */
  userId: number;
  /** 사용자 로그인 ID */
  loginId: string;
  /** 사용자 표시 이름 */
  name: string;
  /** 팀 내 역할 */
  role: TeamMemberRole;
}

/** 내 팀 역할 응답 */
export interface MyRoleResponse {
  /** 팀 내 역할 */
  role: TeamMemberRole;
}
