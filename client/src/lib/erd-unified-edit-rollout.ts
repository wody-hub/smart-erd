/** 내부 투영 기능의 빌드 환경 입력. */
export interface ErdUnifiedEditEnvironment {
  /** 기능 모드. 누락되거나 알 수 없는 값이면 비활성화한다. */
  VITE_ERD_UNIFIED_EDIT_MODE?: string;
  /** 허용 다이어그램 ID CSV 또는 개발/E2E 전용 all. */
  VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS?: string;
}

/**
 * 빌드 플래그와 다이어그램 허용 목록을 모두 만족할 때만 내부 투영을 연다.
 * @param diagramId 현재 다이어그램 ID
 * @param env Vite 환경 변수 (테스트에서는 명시적으로 주입)
 * @returns 적용할 투영 모드
 */
export function resolveErdUnifiedEditRollout(
  diagramId: string | undefined,
  env: ErdUnifiedEditEnvironment = (import.meta.env ?? {}) as ErdUnifiedEditEnvironment,
): 'off' | 'internal' {
  if (!diagramId || env.VITE_ERD_UNIFIED_EDIT_MODE !== 'internal') return 'off';
  const ids = (env.VITE_ERD_UNIFIED_EDIT_DIAGRAM_IDS ?? '').split(',').map((id) => id.trim());
  return ids.includes('all') || ids.includes(diagramId) ? 'internal' : 'off';
}
