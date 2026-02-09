import axiosInstance from './axiosInstance';
import type { Term, TermFormData } from '@/types/dictionary';

/**
 * 팀의 용어 목록을 조회한다.
 *
 * @param teamId 조회할 팀 ID
 * @returns 용어 목록
 */
export async function fetchTerms(teamId: string): Promise<Term[]> {
  const res = await axiosInstance.get<Term[]>(`/teams/${teamId}/terms`);
  return res.data;
}

/**
 * 새 용어를 생성한다.
 *
 * @param teamId 용어를 생성할 팀 ID
 * @param data   용어 생성 데이터
 * @returns 생성된 용어
 */
export async function createTerm(teamId: string, data: TermFormData): Promise<Term> {
  const res = await axiosInstance.post<Term>(`/teams/${teamId}/terms`, data);
  return res.data;
}

/**
 * 용어를 수정한다.
 *
 * @param teamId 용어가 속한 팀 ID
 * @param termId 수정할 용어 ID
 * @param data   용어 수정 데이터
 * @returns 수정된 용어
 */
export async function updateTerm(
  teamId: string,
  termId: number,
  data: TermFormData,
): Promise<Term> {
  const res = await axiosInstance.put<Term>(`/teams/${teamId}/terms/${termId}`, data);
  return res.data;
}

/**
 * 용어를 삭제한다.
 *
 * @param teamId 용어가 속한 팀 ID
 * @param termId 삭제할 용어 ID
 */
export async function deleteTerm(teamId: string, termId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/terms/${termId}`);
}
