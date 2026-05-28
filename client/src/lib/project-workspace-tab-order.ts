export const PROJECT_WORKSPACE_TAB_VALUES = [
  'overview',
  'documents',
  'tags',
  'wbs',
  'myTasks',
  'gantt',
  'staffing',
  'issues',
] as const;

export type ProjectWorkspaceTabValue = (typeof PROJECT_WORKSPACE_TAB_VALUES)[number];

/**
 * 서버/클라이언트에서 받은 탭 순서를 현재 지원 가능한 값으로 정규화한다.
 *
 * @param requestedOrder 저장된 또는 요청된 탭 순서
 * @returns 중복 제거 및 기본 탭 보강이 끝난 순서
 */
export function resolveProjectWorkspaceTabOrder(
  requestedOrder: readonly string[] | null | undefined,
): ProjectWorkspaceTabValue[] {
  const normalized = new Set<ProjectWorkspaceTabValue>();

  requestedOrder?.forEach((value) => {
    if (isProjectWorkspaceTabValue(value)) {
      normalized.add(value);
    }
  });

  PROJECT_WORKSPACE_TAB_VALUES.forEach((value) => normalized.add(value));
  return Array.from(normalized);
}

/**
 * 값이 프로젝트 작업공간 탭 타입인지 확인한다.
 *
 * @param value 검사 대상 값
 * @returns 지원 가능한 탭 값 여부
 */
export function isProjectWorkspaceTabValue(value: string): value is ProjectWorkspaceTabValue {
  return (PROJECT_WORKSPACE_TAB_VALUES as readonly string[]).includes(value);
}
