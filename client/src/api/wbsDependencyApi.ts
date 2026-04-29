import axios from 'axios';
import axiosInstance from './axiosInstance';
import type { WbsDependency, WbsDependencyType } from '@/types/wbs-dependency';

function normalizeDependencyType(value: unknown): WbsDependencyType {
  switch (String(value ?? 'FS').toUpperCase()) {
    case 'SS':
      return 'SS';
    case 'FF':
      return 'FF';
    case 'SF':
      return 'SF';
    default:
      return 'FS';
  }
}

function normalizeWbsDependency(raw: Record<string, unknown>): WbsDependency {
  return {
    id: Number(raw.id ?? 0),
    projectId: Number(raw.projectId ?? 0),
    predecessorWbsItemId: Number(raw.predecessorWbsItemId ?? 0),
    predecessorWbsItemName:
      raw.predecessorWbsItemName == null ? null : String(raw.predecessorWbsItemName),
    successorWbsItemId: Number(raw.successorWbsItemId ?? 0),
    successorWbsItemName:
      raw.successorWbsItemName == null ? null : String(raw.successorWbsItemName),
    dependencyType: normalizeDependencyType(raw.dependencyType),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ''),
  };
}

/**
 * 프로젝트 WBS dependency 목록을 조회한다.
 *
 * 백엔드 dependency API가 아직 배포되지 않은 환경에서는 현재 화면 회귀를 막기 위해
 * 404를 빈 목록으로 취급한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns dependency 목록
 */
export async function fetchWbsDependencies(
  teamId: string,
  projectId: string,
): Promise<WbsDependency[]> {
  try {
    const res = await axiosInstance.get(`/teams/${teamId}/projects/${projectId}/wbs/dependencies`);
    return (res.data as Record<string, unknown>[]).map(normalizeWbsDependency);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * WBS dependency를 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload dependency 생성 payload
 * @returns 생성된 dependency
 */
export async function createWbsDependency(
  teamId: string,
  projectId: string,
  payload: {
    predecessorWbsItemId: number;
    successorWbsItemId: number;
    dependencyType?: WbsDependencyType;
  },
): Promise<WbsDependency> {
  const res = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/wbs/dependencies`,
    payload,
  );
  return normalizeWbsDependency(res.data as Record<string, unknown>);
}

/**
 * WBS dependency를 삭제한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param dependencyId dependency ID
 */
export async function deleteWbsDependency(
  teamId: string,
  projectId: string,
  dependencyId: number,
): Promise<void> {
  await axiosInstance.delete(
    `/teams/${teamId}/projects/${projectId}/wbs/dependencies/${dependencyId}`,
  );
}
