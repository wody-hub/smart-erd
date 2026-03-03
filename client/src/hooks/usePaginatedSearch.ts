import { useCallback, useEffect, useState } from 'react';

/** usePaginatedSearch 옵션 */
export interface UsePaginatedSearchOptions {
  /** 디바운스 지연 시간 (ms, 기본값: 300) */
  debounceMs?: number;
  /** 리셋 의존성 배열 — 이 값들이 변경되면 페이지와 검색어를 초기화한다 */
  resetDeps: unknown[];
}

/** usePaginatedSearch 반환값 */
export interface UsePaginatedSearchResult {
  /** 검색 입력값 (Input에 바인딩) */
  searchInput: string;
  /** 검색 입력값 변경 함수 */
  setSearchInput: (value: string) => void;
  /** 디바운스된 검색 키워드 (API 쿼리에 사용) */
  searchKeyword: string;
  /** 현재 페이지 번호 (0-base) */
  page: number;
  /** 페이지 변경 함수 */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** 서버에서 반환된 totalPages 기반으로 페이지 범위를 보정한다. useEffect 내에서 호출할 것. */
  adjustToTotalPages: (totalPages: number) => void;
}

/**
 * 검색 디바운스 + 페이지네이션 상태 관리를 위한 공통 훅.
 *
 * 검색 입력값을 디바운스하여 searchKeyword로 변환하고,
 * 외부 의존성(teamId, setId 등) 변경 시 페이지/검색 상태를 리셋한다.
 * 반환된 `adjustToTotalPages`로 서버 응답 기반 페이지 범위 보정을 수행한다.
 *
 * @param options 디바운스 시간 및 리셋 의존성 옵션
 * @returns 검색/페이지네이션 상태와 제어 함수
 */
export function usePaginatedSearch(options: UsePaginatedSearchOptions): UsePaginatedSearchResult {
  const { debounceMs = 300, resetDeps } = options;

  /** 검색 입력값 */
  const [searchInput, setSearchInput] = useState('');
  /** 디바운스된 검색어 */
  const [searchKeyword, setSearchKeyword] = useState('');
  /** 현재 페이지 번호 (0-base) */
  const [page, setPage] = useState(0);

  // 검색 입력 디바운스
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
    }, debounceMs);
    return () => window.clearTimeout(timeout);
  }, [searchInput, debounceMs]);

  // 외부 의존성 변경 시 페이지 리셋
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(0);
  }, resetDeps);

  // 검색어 변경 시 페이지 리셋
  useEffect(() => {
    setPage(0);
  }, [searchKeyword]);

  /**
   * 서버에서 반환된 totalPages 기반으로 페이지 범위를 보정한다.
   *
   * @param serverTotalPages 전체 페이지 수
   */
  const adjustToTotalPages = useCallback(
    (serverTotalPages: number) => {
      if (serverTotalPages === 0 && page !== 0) {
        setPage(0);
        return;
      }
      if (serverTotalPages > 0 && page >= serverTotalPages) {
        setPage(serverTotalPages - 1);
      }
    },
    [page],
  );

  return { searchInput, setSearchInput, searchKeyword, page, setPage, adjustToTotalPages };
}
