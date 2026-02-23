import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTerms } from '@/api/termApi';
import { fetchDomains } from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import type {
  Term,
  Domain,
  CompoundResolution,
  CompoundBaseTerm,
  DecomposedSegment,
  PartialDecomposition,
} from '@/types/dictionary';
import type { Column } from '@/types/erd';

/** 단일 그룹 문자열의 greedy longest-match 분해 최대 길이 */
const MAX_TERM_LENGTH = 20;

/**
 * 공백 없는 연속 문자열을 greedy longest-match로 기본 용어로 분해한다.
 *
 * BE의 {@link DictionarySuggestService#decomposeGroup}과 동일한 알고리즘이다.
 * 양쪽을 수정할 때 반드시 동기화해야 한다.
 *
 * **알고리즘 계약 (FE/BE 동기 필수):**
 * 1. pos=0부터 greedy longest-match 탐색
 * 2. 각 위치에서 len=min(남은길이, MAX_TERM_LENGTH)부터 1까지 내림차순 시도
 * 3. termByName에서 substring 매칭 → 성공 시 pos += len, 다음 위치로
 * 4. 어떤 위치에서도 매칭 실패 시 즉시 null 반환 (부분 결과 없음)
 * 5. 최종 결과가 2개 미만이면 null 반환
 * 6. MAX_TERM_LENGTH = 20 (양쪽 동일)
 *
 * @param group      공백 없는 연속 문자열
 * @param termByName 논리명 → Term 매핑
 * @returns 분해된 Term 배열 (2개 이상) 또는 null (분해 실패)
 */
function decomposeGroup(group: string, termByName: Map<string, Term>): Term[] | null {
  const result: Term[] = [];
  let pos = 0;

  while (pos < group.length) {
    let matched = false;
    const maxLen = Math.min(group.length - pos, MAX_TERM_LENGTH);

    for (let len = maxLen; len >= 1; len--) {
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

/**
 * 공백 없는 연속 문자열을 greedy longest-match로 분해하되,
 * 매칭 실패 시 null 반환 대신 미매칭 세그먼트로 기록하고 계속 진행한다.
 *
 * @param group      공백 없는 연속 문자열
 * @param termByName 논리명 → Term 매핑
 * @returns 분해된 세그먼트 배열 (2개 이상) 또는 null (분해 불가)
 */
function partialDecomposeGroup(
  group: string,
  termByName: Map<string, Term>,
): DecomposedSegment[] | null {
  const segments: DecomposedSegment[] = [];
  let pos = 0;

  while (pos < group.length) {
    // greedy longest-match 시도
    let matched = false;
    const maxLen = Math.min(group.length - pos, MAX_TERM_LENGTH);
    for (let len = maxLen; len >= 1; len--) {
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
      // 다음 매칭 가능 위치 탐색
      let unmatchedEnd = pos + 1;
      while (unmatchedEnd < group.length) {
        let canMatch = false;
        const remaining = Math.min(group.length - unmatchedEnd, MAX_TERM_LENGTH);
        for (let len = remaining; len >= 1; len--) {
          if (termByName.has(group.substring(unmatchedEnd, unmatchedEnd + len))) {
            canMatch = true;
            break;
          }
        }
        if (canMatch) break;
        unmatchedEnd++;
      }
      segments.push({ text: group.substring(pos, unmatchedEnd), matched: false });
      pos = unmatchedEnd;
    }
  }

  return segments.length >= 2 ? segments : null;
}

/**
 * Term 데이터로 컬럼 업데이트 객체를 생성한다.
 *
 * Domain이 연결된 경우 physicalType도 자동으로 포함한다.
 * TableNode, QuickTermDialog 등에서 동일한 매핑 로직을 공유한다.
 *
 * @param term       Term 또는 Term과 호환되는 객체
 * @param findDomain domainId → Domain 조회 함수
 * @returns 컬럼 업데이트 부분 객체
 */
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

/** Term에 연결된 Domain의 physicalType을 결합한 확장 타입 */
interface TermWithType extends Term {
  /** 연결 도메인의 물리 타입 (없으면 undefined) */
  physicalType?: string;
}

/**
 * Term/Domain 데이터를 프리로드하고 클라이언트 사이드 검색을 제공하는 훅.
 *
 * React Query 캐시가 전역 싱글턴이므로 동일 queryKey의 데이터는
 * 여러 컴포넌트에서 호출해도 자동 공유된다.
 *
 * @param teamId 팀 ID
 * @returns terms, domains, 검색/조회 헬퍼 함수들
 */
export function useDictionaryCache(teamId: string | undefined, setId: string | undefined) {
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

  /** ID → Domain 매핑 */
  const domainMap = useMemo(() => {
    const map = new Map<number, Domain>();
    for (const d of domains) {
      map.set(d.id, d);
    }
    return map;
  }, [domains]);

  /** ID → Term 매핑 (O(1) 조회) */
  const termMap = useMemo(() => {
    const map = new Map<number, Term>();
    for (const t of terms) {
      map.set(t.id, t);
    }
    return map;
  }, [terms]);

  /** 논리명 → Term 매핑 (복합 용어 해석용) */
  const termByNameMap = useMemo(() => {
    const map = new Map<string, Term>();
    for (const t of terms) {
      map.set(t.logicalName, t);
    }
    return map;
  }, [terms]);

  /** 논리명 → Domain 매핑 (DSL 파서 도메인 명시 지정용) */
  const domainByNameMap = useMemo(() => {
    const map = new Map<string, Domain>();
    for (const d of domains) {
      map.set(d.logicalName, d);
    }
    return map;
  }, [domains]);

  /**
   * 논리명으로 Term을 클라이언트 사이드 필터링한다.
   *
   * @param query 검색어
   * @returns 매칭되는 Term 목록 (최대 10건)
   */
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

  /**
   * ID로 Term을 조회한다.
   *
   * @param termId Term ID
   * @returns Term 또는 undefined
   */
  const findTermById = useCallback(
    (termId: number): Term | undefined => {
      return termMap.get(termId);
    },
    [termMap],
  );

  /**
   * ID로 Domain을 조회한다.
   *
   * @param domainId Domain ID
   * @returns Domain 또는 undefined
   */
  const findDomainById = useCallback(
    (domainId: number): Domain | undefined => {
      return domainMap.get(domainId);
    },
    [domainMap],
  );

  /**
   * Term에 연결된 Domain의 physicalType을 결합하여 반환한다.
   *
   * @param term Term 객체
   * @returns physicalType이 추가된 TermWithType
   */
  const getTermWithType = useCallback(
    (term: Term): TermWithType => {
      const domain = term.domainId ? domainMap.get(term.domainId) : undefined;
      return { ...term, physicalType: domain?.physicalType };
    },
    [domainMap],
  );

  /**
   * 입력 문자열을 복합 용어로 해석한다.
   *
   * 공백으로 구분된 그룹 내에서는 기본 용어 물리명을 연결(concatenate)하고,
   * 그룹 간에는 언더스코어(_)로 연결한다.
   * 마지막 매칭 기본 용어의 도메인을 상속한다 (ERwin class word 규칙).
   *
   * @param query 사용자 입력 문자열
   * @returns 복합 해석 결과 또는 null
   */
  const resolveCompound = useCallback(
    (query: string): CompoundResolution | null => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        return null;
      }

      // 정확 매칭 존재 시 복합 해석 안 함
      if (termByNameMap.has(trimmed)) {
        return null;
      }

      const groups = trimmed.split(/\s+/).filter((g) => g.length > 0);
      if (groups.length === 0) {
        return null;
      }

      const allBaseTerms: CompoundBaseTerm[] = [];
      const groupPhysicals: string[] = [];

      for (const group of groups) {
        // 그룹 전체가 단일 용어로 매칭
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

        // greedy longest-match 분해
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
        groupPhysicals.push(decomposed.map((t) => t.physicalName).join(''));
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

  /**
   * 입력 문자열을 부분 분해한다.
   *
   * 매칭 세그먼트 1개 이상 AND 미매칭 세그먼트 1개 이상일 때만 결과를 반환한다.
   * 모든 세그먼트가 매칭되면 resolveCompound가 처리하므로 null을 반환한다.
   *
   * @param query 사용자 입력 문자열
   * @returns 부분 분해 결과 또는 null
   */
  const partialDecompose = useCallback(
    (query: string): PartialDecomposition | null => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        return null;
      }
      if (termByNameMap.has(trimmed)) {
        return null;
      }

      // 공백이 있으면 각 그룹을 독립 분석
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
          // 분해 불가능한 단일 그룹 → 미매칭 세그먼트
          allSegments.push({ text: group, matched: false });
        }
      }

      const hasMatched = allSegments.some((s) => s.matched);
      const hasUnmatched = allSegments.some((s) => !s.matched);
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
