import type { ProjectIssueFilters, ProjectIssuePriority, ProjectIssueStatus } from '@/types/issues';

/** 프로젝트 이슈 상태 필터의 전체 선택 sentinel 값. */
export const PROJECT_ISSUE_FILTER_ALL = '__all__';

/** 프로젝트 이슈 담당자 필터의 미배정 sentinel 값. */
export const PROJECT_ISSUE_FILTER_UNASSIGNED = '__unassigned__';

/** 프로젝트 이슈 상태 목록. */
export const PROJECT_ISSUE_STATUS_VALUES = ['REGISTERED', 'IN_PROGRESS', 'DONE'] as const;

/** 프로젝트 이슈 우선순위 목록. */
export const PROJECT_ISSUE_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** 프로젝트 이슈 필터 폼 상태. */
export interface ProjectIssueFilterState {
  /** 상태 셀렉트 값 */
  status: ProjectIssueStatus | typeof PROJECT_ISSUE_FILTER_ALL;
  /** 우선순위 셀렉트 값 */
  priority: ProjectIssuePriority | typeof PROJECT_ISSUE_FILTER_ALL;
  /** 담당자 셀렉트 값 */
  assignee: string;
}

/** 프로젝트 이슈 필터 기본값. */
export const DEFAULT_PROJECT_ISSUE_FILTER_STATE: ProjectIssueFilterState = {
  status: PROJECT_ISSUE_FILTER_ALL,
  priority: PROJECT_ISSUE_FILTER_ALL,
  assignee: PROJECT_ISSUE_FILTER_ALL,
};

type ProjectIssueStatusLabelKey =
  | 'issues.status.registered'
  | 'issues.status.inProgress'
  | 'issues.status.done';

type ProjectIssuePriorityLabelKey =
  | 'issues.priority.low'
  | 'issues.priority.medium'
  | 'issues.priority.high'
  | 'issues.priority.critical';

type ProjectIssueTransitionLabelKey = 'issues.action.start' | 'issues.action.markDone';

/**
 * 프로젝트 이슈 상태를 번역 키로 변환한다.
 *
 * @param status 프로젝트 이슈 상태
 * @returns `issues.state.*` 번역 키
 */
export function getProjectIssueStatusLabelKey(
  status: ProjectIssueStatus,
): ProjectIssueStatusLabelKey {
  switch (status) {
    case 'REGISTERED':
      return 'issues.status.registered';
    case 'IN_PROGRESS':
      return 'issues.status.inProgress';
    case 'DONE':
      return 'issues.status.done';
  }
}

/**
 * 프로젝트 이슈 우선순위를 번역 키로 변환한다.
 *
 * @param priority 프로젝트 이슈 우선순위
 * @returns `issues.priority.*` 번역 키
 */
export function getProjectIssuePriorityLabelKey(
  priority: ProjectIssuePriority,
): ProjectIssuePriorityLabelKey {
  switch (priority) {
    case 'LOW':
      return 'issues.priority.low';
    case 'MEDIUM':
      return 'issues.priority.medium';
    case 'HIGH':
      return 'issues.priority.high';
    case 'CRITICAL':
      return 'issues.priority.critical';
  }
}

/**
 * 다음 프로젝트 이슈 상태를 반환한다.
 *
 * v1은 `REGISTERED -> IN_PROGRESS -> DONE` 순방향 전이만 제공한다.
 *
 * @param status 현재 상태
 * @returns 다음 상태 또는 null
 */
export function getNextProjectIssueStatus(status: ProjectIssueStatus): ProjectIssueStatus | null {
  if (status === 'REGISTERED') {
    return 'IN_PROGRESS';
  }
  if (status === 'IN_PROGRESS') {
    return 'DONE';
  }
  return null;
}

/**
 * 현재 상태에서 노출할 전이 액션 번역 키를 반환한다.
 *
 * @param status 현재 상태
 * @returns `issues.action.*` 번역 키 또는 null
 */
export function getProjectIssueTransitionLabelKey(
  status: ProjectIssueStatus,
): ProjectIssueTransitionLabelKey | null {
  if (status === 'REGISTERED') {
    return 'issues.action.start';
  }
  if (status === 'IN_PROGRESS') {
    return 'issues.action.markDone';
  }
  return null;
}

/**
 * 편집 다이얼로그에서 선택 가능한 상태 목록을 반환한다.
 *
 * 현재 상태보다 이전 단계는 선택할 수 없도록 forward-only 제약을 유지한다.
 *
 * @param status 현재 프로젝트 이슈 상태
 * @returns 현재 상태 이상으로 선택 가능한 상태 목록
 */
export function getProjectIssueEditableStatuses(
  status: ProjectIssueStatus,
): readonly ProjectIssueStatus[] {
  const currentIndex = PROJECT_ISSUE_STATUS_VALUES.indexOf(status);

  if (currentIndex < 0) {
    return PROJECT_ISSUE_STATUS_VALUES;
  }

  return PROJECT_ISSUE_STATUS_VALUES.slice(currentIndex);
}

/**
 * 화면 필터 상태를 API 조회 필터로 정규화한다.
 *
 * @param filterState 화면 필터 상태
 * @returns API 요청용 필터 객체
 */
export function normalizeProjectIssueFilters(
  filterState: ProjectIssueFilterState,
): ProjectIssueFilters {
  const filters: ProjectIssueFilters = {};

  if (filterState.status !== PROJECT_ISSUE_FILTER_ALL) {
    filters.status = filterState.status;
  }

  if (filterState.priority !== PROJECT_ISSUE_FILTER_ALL) {
    filters.priority = filterState.priority;
  }

  if (filterState.assignee === PROJECT_ISSUE_FILTER_UNASSIGNED) {
    filters.unassignedOnly = true;
    return filters;
  }

  if (filterState.assignee !== PROJECT_ISSUE_FILTER_ALL) {
    const parsedAssigneeUserId = Number(filterState.assignee);
    if (Number.isInteger(parsedAssigneeUserId) && parsedAssigneeUserId > 0) {
      filters.assigneeUserId = parsedAssigneeUserId;
    }
  }

  return filters;
}

/**
 * 프로젝트 이슈 필터를 query param 객체로 직렬화한다.
 *
 * @param filters API 요청용 필터
 * @returns axios params에 전달할 객체
 */
export function buildProjectIssueQueryParams(
  filters: ProjectIssueFilters,
): Record<string, number | string | boolean> {
  const params: Record<string, number | string | boolean> = {};

  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.priority) {
    params.priority = filters.priority;
  }
  if (typeof filters.assigneeUserId === 'number') {
    params.assigneeUserId = filters.assigneeUserId;
  }
  if (filters.unassignedOnly) {
    params.unassignedOnly = true;
  }

  return params;
}
