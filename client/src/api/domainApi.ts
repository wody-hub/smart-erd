import axiosInstance from './axiosInstance';
import type { Domain, DomainFormData } from '@/types/dictionary';

/**
 * 팀의 도메인 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @returns 도메인 목록
 */
export async function fetchDomains(teamId: string): Promise<Domain[]> {
  const res = await axiosInstance.get<Domain[]>(`/teams/${teamId}/domains`);
  return res.data;
}

/**
 * 새 도메인을 생성한다.
 *
 * @param teamId 도메인을 생성할 팀 ID
 * @param data   도메인 생성 데이터
 * @returns 생성된 도메인
 */
export async function createDomain(teamId: string, data: DomainFormData): Promise<Domain> {
  const res = await axiosInstance.post<Domain>(`/teams/${teamId}/domains`, data);
  return res.data;
}

/**
 * 도메인을 수정한다.
 *
 * @param teamId   도메인이 속한 팀 ID
 * @param domainId 수정할 도메인 ID
 * @param data     도메인 수정 데이터
 * @returns 수정된 도메인
 */
export async function updateDomain(
  teamId: string,
  domainId: number,
  data: DomainFormData,
): Promise<Domain> {
  const res = await axiosInstance.put<Domain>(`/teams/${teamId}/domains/${domainId}`, data);
  return res.data;
}

/**
 * 도메인을 삭제한다.
 *
 * @param teamId   도메인이 속한 팀 ID
 * @param domainId 삭제할 도메인 ID
 */
export async function deleteDomain(teamId: string, domainId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/domains/${domainId}`);
}
