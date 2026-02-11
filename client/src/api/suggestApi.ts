import axiosInstance from './axiosInstance';
import type { SuggestResponse } from '@/types/dictionary';

/**
 * 키워드 기반 물리명/도메인 추천을 요청한다.
 *
 * @param teamId  대상 팀 ID
 * @param keyword 한글 키워드 (예: "사용자 이름")
 * @returns 추천 결과
 */
export async function fetchSuggestion(teamId: string, keyword: string): Promise<SuggestResponse> {
  const res = await axiosInstance.post<SuggestResponse>(`/teams/${teamId}/dictionary/suggest`, {
    keyword,
  });
  return res.data;
}
