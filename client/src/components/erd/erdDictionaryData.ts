import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTerms } from '@/api/termApi';
import { fetchDomains } from '@/api/domainApi';
import { fetchWords } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { buildWordMatchIndex } from '@/lib/word-composition';
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

interface TermWithType extends Term {
  /** 연결 도메인의 물리 타입 */
  physicalType?: string;
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

  const domainMap = useMemo(() => {
    const map = new Map<number, Domain>();
    for (const domain of domains) {
      map.set(domain.id, domain);
    }
    return map;
  }, [domains]);

  const termMap = useMemo(() => {
    const map = new Map<number, Term>();
    for (const term of terms) {
      map.set(term.id, term);
    }
    return map;
  }, [terms]);

  const termByNameMap = useMemo(() => {
    const map = new Map<string, Term>();
    for (const term of terms) {
      map.set(term.logicalName, term);
    }
    return map;
  }, [terms]);

  const domainByNameMap = useMemo(() => {
    const map = new Map<string, Domain>();
    for (const domain of domains) {
      map.set(domain.logicalName, domain);
    }
    return map;
  }, [domains]);

  const wordMap = useMemo(() => {
    const map = new Map<number, Word>();
    for (const word of words) {
      map.set(word.id, word);
    }
    return map;
  }, [words]);

  const wordMatchIndex = useMemo(() => buildWordMatchIndex(words), [words]);

  const searchTerms = useCallback(
    (query: string): Term[] => {
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
    },
    [terms],
  );

  const findTermById = useCallback(
    (termId: number): Term | undefined => termMap.get(termId),
    [termMap],
  );

  const findDomainById = useCallback(
    (domainId: number): Domain | undefined => domainMap.get(domainId),
    [domainMap],
  );

  const findWordById = useCallback(
    (wordId: number): Word | undefined => wordMap.get(wordId),
    [wordMap],
  );

  const getTermWithType = useCallback(
    (term: Term): TermWithType => {
      const domain = term.domainId ? domainMap.get(term.domainId) : undefined;
      return { ...term, physicalType: domain?.physicalType };
    },
    [domainMap],
  );

  const resolveLogicalName = useCallback(
    (() => {
      const resolutionCache = new Map<string, LogicalNameResolution>();
      return (query: string): LogicalNameResolution => {
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
    })(),
    [termByNameMap, domainMap, wordMatchIndex],
  );

  return {
    terms,
    domains,
    words,
    isDictionaryReady,
    isDictionaryFetching,
    dictionaryRevision,
    termByNameMap,
    domainByNameMap,
    domainMap,
    wordMatchIndex,
    searchTerms,
    findTermById,
    findDomainById,
    findWordById,
    getTermWithType,
    resolveLogicalName,
  };
}
