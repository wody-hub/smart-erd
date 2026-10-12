import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTerms } from '@/api/termApi';
import { fetchDomains } from '@/api/domainApi';
import { fetchWords } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { buildWordMatchIndex, type WordMatchIndex } from '@/lib/word-composition';
import {
  resolveLogicalName as resolveLogicalNameFromDictionary,
  type LogicalNameResolution,
} from '@/lib/logical-name-resolution';
import { DEFAULT_COLUMN_TYPE } from '@/lib/diagram-dictionary-reconciliation';
import type { Domain, Term, Word } from '@/types/dictionary';
import type { Column } from '@/types/erd';

/**
 * 도메인 연결이 해제될 때, 이전 도메인의 물리 타입이 그대로 남아 있으면
 * 기본 타입으로 롤백한다.
 *
 * @param column         현재 컬럼 (undefined 허용)
 * @param findDomainById 도메인 ID로 도메인을 조회하는 함수
 * @returns 롤백할 타입 값. 롤백이 불필요하면 undefined
 */
export function revertDomainTypeIfNeeded(
  column: Column | undefined,
  findDomainById: (id: number) => { physicalType: string } | undefined,
): string | undefined {
  if (column?.domainId == null) {
    return undefined;
  }
  const previousDomain = findDomainById(column.domainId);
  if (previousDomain && column.type === previousDomain.physicalType) {
    return DEFAULT_COLUMN_TYPE;
  }
  return undefined;
}

export function buildColumnUpdatesFromTerm(
  term: { logicalName: string; physicalName: string; id: number; domainId?: number | null },
  findDomain: (id: number) => { physicalType: string } | undefined,
): Partial<Column> {
  const updates: Partial<Column> = {
    logicalName: term.logicalName,
    name: term.physicalName,
    termId: term.id,
    domainId: term.domainId ?? undefined,
  };
  if (term.domainId) {
    const domain = findDomain(term.domainId);
    if (domain) {
      updates.type = domain.physicalType;
    }
  }
  return updates;
}

export interface TermWithType extends Term {
  /** 연결 도메인의 물리 타입 */
  physicalType?: string;
}

/**
 * 사전 파생 뷰(맵·검색·해석 함수 묶음).
 *
 * `useErdDictionaryData`의 반환 중 terms/domains/words·ready 상태를 제외한 순수 파생 부분.
 */
export interface ErdDictionaryView {
  /** 도메인 id → 도메인 */
  domainMap: Map<number, Domain>;
  /** 용어 id → 용어 */
  termMap: Map<number, Term>;
  /** 용어 논리명 → 용어 */
  termByNameMap: Map<string, Term>;
  /** 도메인 논리명 → 도메인 */
  domainByNameMap: Map<string, Domain>;
  /** 단어 id → 단어 */
  wordMap: Map<number, Word>;
  /** 단어 매칭 인덱스 */
  wordMatchIndex: WordMatchIndex;
  /** 용어 검색 (상위 10개) */
  searchTerms: (query: string) => Term[];
  /** 용어 id 조회 */
  findTermById: (termId: number) => Term | undefined;
  /** 도메인 id 조회 */
  findDomainById: (domainId: number) => Domain | undefined;
  /** 단어 id 조회 */
  findWordById: (wordId: number) => Word | undefined;
  /** 용어에 연결 도메인의 물리 타입 첨부 */
  getTermWithType: (term: Term) => TermWithType;
  /** 논리명 해석 */
  resolveLogicalName: (query: string) => LogicalNameResolution;
}

/**
 * 용어/도메인/단어 배열에서 ERD 소비용 파생 뷰를 만든다 (순수 함수).
 *
 * 서버 훅과 로컬 Provider가 공유한다. `resolveLogicalName`의 해석 캐시는
 * 이 호출 단위로 유지된다 (호출자는 데이터 변경 시에만 다시 호출한다).
 *
 * @param terms   용어 목록
 * @param domains 도메인 목록
 * @param words   단어 목록
 * @returns 파생 뷰
 */
export function buildErdDictionaryView(
  terms: Term[],
  domains: Domain[],
  words: Word[],
): ErdDictionaryView {
  const domainMap = new Map<number, Domain>();
  for (const domain of domains) {
    domainMap.set(domain.id, domain);
  }
  const termMap = new Map<number, Term>();
  for (const term of terms) {
    termMap.set(term.id, term);
  }
  const termByNameMap = new Map<string, Term>();
  for (const term of terms) {
    termByNameMap.set(term.logicalName, term);
  }
  const domainByNameMap = new Map<string, Domain>();
  for (const domain of domains) {
    domainByNameMap.set(domain.logicalName, domain);
  }
  const wordMap = new Map<number, Word>();
  for (const word of words) {
    wordMap.set(word.id, word);
  }
  const wordMatchIndex = buildWordMatchIndex(words);

  /** 용어 검색 (상위 10개). @param query 검색어 @returns 매칭 용어 */
  const searchTerms = (query: string): Term[] => {
    if (!query.trim()) {
      return [];
    }
    const lower = query.toLowerCase();
    return terms
      .filter(
        (term) =>
          term.logicalName.toLowerCase().includes(lower) ||
          term.physicalName.toLowerCase().includes(lower),
      )
      .slice(0, 10);
  };

  /** 용어 id 조회. @param termId 용어 ID @returns 용어 또는 undefined */
  const findTermById = (termId: number): Term | undefined => termMap.get(termId);

  /** 도메인 id 조회. @param domainId 도메인 ID @returns 도메인 또는 undefined */
  const findDomainById = (domainId: number): Domain | undefined => domainMap.get(domainId);

  /** 단어 id 조회. @param wordId 단어 ID @returns 단어 또는 undefined */
  const findWordById = (wordId: number): Word | undefined => wordMap.get(wordId);

  /** 용어에 연결 도메인의 물리 타입 첨부. @param term 용어 @returns 타입 포함 용어 */
  const getTermWithType = (term: Term): TermWithType => {
    const domain = term.domainId ? domainMap.get(term.domainId) : undefined;
    return { ...term, physicalType: domain?.physicalType };
  };

  const resolutionCache = new Map<string, LogicalNameResolution>();
  /** 논리명 해석 (호출 단위 캐시). @param query 논리명 @returns 해석 결과 */
  const resolveLogicalName = (query: string): LogicalNameResolution => {
    const cached = resolutionCache.get(query);
    if (cached) {
      return cached;
    }
    const resolved = resolveLogicalNameFromDictionary(query, {
      termByName: termByNameMap,
      domainById: domainMap,
      wordMatchIndex,
    });
    resolutionCache.set(query, resolved);
    return resolved;
  };

  return {
    domainMap,
    termMap,
    termByNameMap,
    domainByNameMap,
    wordMap,
    wordMatchIndex,
    searchTerms,
    findTermById,
    findDomainById,
    findWordById,
    getTermWithType,
    resolveLogicalName,
  };
}

/**
 * ERD 전용 사전 조회 훅.
 *
 * ERD 화면은 용어/도메인/단어 캐시와 논리명 해석 계약을 소비한다.
 */
export function useErdDictionaryData(teamId: string | undefined, setId: string | undefined) {
  const termsQuery = useQuery({
    queryKey: queryKeys.dictionary.terms(teamId!, setId!),
    queryFn: () => fetchTerms(teamId!, setId!),
    enabled: !!teamId && !!setId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const domainsQuery = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!, setId!),
    queryFn: () => fetchDomains(teamId!, setId!),
    enabled: !!teamId && !!setId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const wordsQuery = useQuery({
    queryKey: queryKeys.dictionary.words(teamId!, setId!),
    queryFn: () => fetchWords(teamId!, setId!),
    enabled: !!teamId && !!setId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const terms = termsQuery.data ?? [];
  const domains = domainsQuery.data ?? [];
  const words = wordsQuery.data ?? [];
  const isDictionaryFetching =
    termsQuery.isFetching || domainsQuery.isFetching || wordsQuery.isFetching;
  const isDictionaryReady =
    !!teamId &&
    !!setId &&
    termsQuery.isFetched &&
    domainsQuery.isFetched &&
    wordsQuery.isFetched &&
    !isDictionaryFetching;
  const dictionaryRevision = [
    termsQuery.dataUpdatedAt,
    domainsQuery.dataUpdatedAt,
    wordsQuery.dataUpdatedAt,
  ].join(':');

  const view = useMemo(
    () => buildErdDictionaryView(terms, domains, words),
    [terms, domains, words],
  );

  return {
    terms,
    domains,
    words,
    isDictionaryReady,
    isDictionaryFetching,
    dictionaryRevision,
    ...view,
  };
}
