import axiosInstance from './axiosInstance';
import type { DictionarySet } from '@/types/dictionary';

/**
 * 팀의 사전 세트 목록을 조회한다.
 */
export async function fetchDictionarySets(teamId: string): Promise<DictionarySet[]> {
  const res = await axiosInstance.get<DictionarySet[]>(`/teams/${teamId}/dictionary-sets`);
  return res.data;
}

/**
 * 사전 세트를 생성한다.
 */
export async function createDictionarySet(
  teamId: string,
  data: { name: string; description?: string },
): Promise<DictionarySet> {
  const res = await axiosInstance.post<DictionarySet>(`/teams/${teamId}/dictionary-sets`, data);
  return res.data;
}

/**
 * 사전 세트를 수정한다.
 */
export async function updateDictionarySet(
  teamId: string,
  setId: number,
  data: { name: string; description?: string },
): Promise<DictionarySet> {
  const res = await axiosInstance.put<DictionarySet>(`/teams/${teamId}/dictionary-sets/${setId}`, data);
  return res.data;
}

/**
 * 사전 세트를 삭제한다.
 */
export async function deleteDictionarySet(teamId: string, setId: number): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/dictionary-sets/${setId}`);
}

/**
 * 기본 사전 세트를 지정한다.
 */
export async function setDefaultDictionarySet(teamId: string, setId: number): Promise<DictionarySet> {
  const res = await axiosInstance.patch<DictionarySet>(`/teams/${teamId}/dictionary-sets/${setId}/default`);
  return res.data;
}

