import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSuggestion } from '@/api/suggestApi';
import { queryKeys } from '@/constants/query-keys';
import type { SuggestResponse } from '@/types/dictionary';

/**
 * 한글 키워드에서 물리명/도메인을 추천하는 debounce 훅.
 *
 * @param teamId  팀 ID
 * @param keyword 입력 키워드
 * @param enabled 활성화 여부 (2글자 이상일 때만)
 * @returns suggestion 추천 결과, isLoading 로딩 여부
 */
export function useDictionarySuggest(
  teamId: string,
  keyword: string,
  enabled: boolean,
): { suggestion: SuggestResponse | undefined; isLoading: boolean } {
  /** 디바운스된 키워드 */
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: suggestion, isLoading } = useQuery({
    queryKey: queryKeys.dictionary.suggest(teamId, debouncedKeyword),
    queryFn: () => fetchSuggestion(teamId, debouncedKeyword),
    enabled: enabled && debouncedKeyword.trim().length >= 2,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
  });

  return { suggestion, isLoading };
}
