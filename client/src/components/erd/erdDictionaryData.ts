import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTerms } from '@/api/termApi';
import { fetchDomains } from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import type {
  CompoundBaseTerm,
  CompoundResolution,
  DecomposedSegment,
  Domain,
  PartialDecomposition,
  Term,
} from '@/types/dictionary';
import type { Column } from '@/types/erd';

/** 단일 그룹 문자열의 greedy longest-match 분해 최대 길이 */
const MAX_TERM_LENGTH = 20;

function decomposeGroup(group: string, termByName: Map<string, Term>): Term[] | null {
  const result: Term[] = [];
  let pos = 0;

  while (pos < group.length) {
    let matched = false;
    const maxLen = Math.min(group.length - pos, MAX_TERM_LENGTH);

    for (let len = maxLen; len >= 1; len -= 1) {
      const substr = group.substring(pos, pos + len);
      const term = termByName.get(substr);
      if (term) {
        result.push(term);
        pos += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      return null;
    }
  }

  return result.length >= 2 ? result : null;
}

function partialDecomposeGroup(
  group: string,
  termByName: Map<string, Term>,
): DecomposedSegment[] | null {
  const segments: DecomposedSegment[] = [];
  let pos = 0;

  while (pos < group.length) {
    let matched = false;
    const maxLen = Math.min(group.length - pos, MAX_TERM_LENGTH);
    for (let len = maxLen; len >= 1; len -= 1) {
      const substr = group.substring(pos, pos + len);
      const term = termByName.get(substr);
      if (term) {
        segments.push({
          text: substr,
          matched: true,
          term: { id: term.id, physicalName: term.physicalName, domainId: term.domainId ?? null },
        });
        pos += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      let unmatchedEnd = pos + 1;
      while (unmatchedEnd < group.length) {
        let canMatch = false;
        const remaining = Math.min(group.length - unmatchedEnd, MAX_TERM_LENGTH);
        for (let len = remaining; len >= 1; len -= 1) {
          if (termByName.has(group.substring(unmatchedEnd, unmatchedEnd + len))) {
            canMatch = true;
            break;
          }
        }
        if (canMatch) break;
        unmatchedEnd += 1;
      }
      segments.push({ text: group.substring(pos, unmatchedEnd), matched: false });
      pos = unmatchedEnd;
    }
  }

  return segments.length >= 2 ? segments : null;
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
    if (domain) updates.type = domain.physicalType;
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
 * ERD 화면은 사전 관리 기능이 아니라 용어/도메인 조회 계약만 소비한다.
 */
export function useErdDictionaryData(teamId: string | undefined, setId: string | undefined) {
  const { data: terms = [] } = useQuery({
    queryKey: queryKeys.dictionary.terms(teamId!, setId!),
    queryFn: () => fetchTerms(teamId!, setId!),
    enabled: !!teamId && !!setId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: domains = [] } = useQuery({
    queryKey: queryKeys.dictionary.domains(teamId!, setId!),
    queryFn: () => fetchDomains(teamId!, setId!),
    enabled: !!teamId && !!setId,
    staleTime: 2 * 60 * 1000,
  });

  const domainMap = useMemo(() => {
    const map = new Map<number, Domain>();
    for (const d of domains) {
      map.set(d.id, d);
    }
    return map;
  }, [domains]);

  const termMap = useMemo(() => {
    const map = new Map<number, Term>();
    for (const t of terms) {
      map.set(t.id, t);
    }
    return map;
  }, [terms]);

  const termByNameMap = useMemo(() => {
    const map = new Map<string, Term>();
    for (const t of terms) {
      map.set(t.logicalName, t);
    }
    return map;
  }, [terms]);

  const domainByNameMap = useMemo(() => {
    const map = new Map<string, Domain>();
    for (const d of domains) {
      map.set(d.logicalName, d);
    }
    return map;
  }, [domains]);

  const searchTerms = useCallback(
    (query: string): Term[] => {
      if (!query.trim()) {
        return [];
      }
      const lower = query.toLowerCase();
      return terms.filter((t) => t.logicalName.toLowerCase().includes(lower)).slice(0, 10);
    },
    [terms],
  );

  const findTermById = useCallback((termId: number): Term | undefined => termMap.get(termId), [termMap]);

  const findDomainById = useCallback(
    (domainId: number): Domain | undefined => domainMap.get(domainId),
    [domainMap],
  );

  const getTermWithType = useCallback(
    (term: Term): TermWithType => {
      const domain = term.domainId ? domainMap.get(term.domainId) : undefined;
      return { ...term, physicalType: domain?.physicalType };
    },
    [domainMap],
  );

  const resolveCompound = useCallback(
    (query: string): CompoundResolution | null => {
      const trimmed = query.trim();
      if (trimmed.length < 2 || termByNameMap.has(trimmed)) {
        return null;
      }

      const groups = trimmed.split(/\s+/).filter((g) => g.length > 0);
      if (groups.length === 0) {
        return null;
      }

      const allBaseTerms: CompoundBaseTerm[] = [];
      const groupPhysicals: string[] = [];

      for (const group of groups) {
        const exactTerm = termByNameMap.get(group);
        if (exactTerm) {
          allBaseTerms.push({
            logicalName: exactTerm.logicalName,
            physicalName: exactTerm.physicalName,
            termId: exactTerm.id,
            domainId: exactTerm.domainId ?? null,
          });
          groupPhysicals.push(exactTerm.physicalName);
          continue;
        }

        const decomposed = decomposeGroup(group, termByNameMap);
        if (!decomposed) {
          return null;
        }

        for (const term of decomposed) {
          allBaseTerms.push({
            logicalName: term.logicalName,
            physicalName: term.physicalName,
            termId: term.id,
            domainId: term.domainId ?? null,
          });
        }
        groupPhysicals.push(decomposed.map((term) => term.physicalName).join(''));
      }

      if (allBaseTerms.length < 2) {
        return null;
      }

      const physicalName = groupPhysicals.join('_');
      const lastBaseTerm = allBaseTerms[allBaseTerms.length - 1];
      const lastTerm = termByNameMap.get(lastBaseTerm.logicalName);
      const domId = lastTerm?.domainId ?? null;
      const physType = domId ? domainMap.get(domId)?.physicalType : undefined;

      return {
        query: trimmed,
        physicalName,
        baseTerms: allBaseTerms,
        domainId: domId,
        physicalType: physType,
      };
    },
    [termByNameMap, domainMap],
  );

  const partialDecompose = useCallback(
    (query: string): PartialDecomposition | null => {
      const trimmed = query.trim();
      if (trimmed.length < 2 || termByNameMap.has(trimmed)) {
        return null;
      }

      const groups = trimmed.split(/\s+/).filter((g) => g.length > 0);
      const allSegments: DecomposedSegment[] = [];

      for (const group of groups) {
        const exactTerm = termByNameMap.get(group);
        if (exactTerm) {
          allSegments.push({
            text: group,
            matched: true,
            term: {
              id: exactTerm.id,
              physicalName: exactTerm.physicalName,
              domainId: exactTerm.domainId ?? null,
            },
          });
          continue;
        }
        const segments = partialDecomposeGroup(group, termByNameMap);
        if (segments) {
          allSegments.push(...segments);
        } else {
          allSegments.push({ text: group, matched: false });
        }
      }

      const hasMatched = allSegments.some((segment) => segment.matched);
      const hasUnmatched = allSegments.some((segment) => !segment.matched);
      if (!hasMatched || !hasUnmatched || allSegments.length < 2) {
        return null;
      }

      return { query: trimmed, segments: allSegments };
    },
    [termByNameMap],
  );

  return {
    terms,
    domains,
    termByNameMap,
    domainByNameMap,
    domainMap,
    searchTerms,
    findTermById,
    findDomainById,
    getTermWithType,
    resolveCompound,
    partialDecompose,
  };
}
