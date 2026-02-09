/** 프로젝트 정보. 팀에 속하며 다이어그램을 포함한다. */
export interface Project {
  /** 프로젝트 고유 ID */
  id: number;
  /** 프로젝트 이름 */
  name: string;
  /** 소속 팀 ID */
  teamId: number;
  /** 프로젝트 생성 일시 (ISO 8601) */
  createdAt: string;
}
