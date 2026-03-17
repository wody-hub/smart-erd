import {
  analyzeWordComposition,
  type WordCompositionAnalysis,
  type WordMatchIndex,
} from './word-composition.js';
import type { Domain, Term } from '../types/dictionary.js';

/** 논리명 해석 상태 */
export type LogicalNameResolutionState =
  | 'empty'
  | 'registered'
  | 'term-missing'
  | 'word-missing'
  | 'ambiguous';

/** 논리명 해석에 필요한 사전 인덱스 */
export interface LogicalNameResolverDictionary {
  termByName: Map<string, Term>;
  domainById: Map<number, Domain>;
  wordMatchIndex: WordMatchIndex;
}

/** 단어사전 기반 논리명 해석 결과 */
export interface LogicalNameResolution {
  /** 원본 입력값 */
  input: string;
  /** trim된 입력값 */
  query: string;
  /** 해석 상태 */
  state: LogicalNameResolutionState;
  /** 단어 조합 분석 결과 */
  wordAnalysis: WordCompositionAnalysis;
  /** 단어 조합으로 산출된 물리명 */
  physicalName: string;
  /** 단어 조합 완전 매칭 여부 */
  isWordCompleteMatch: boolean;
  /** 전체 용어 등록 여부 */
  isRegisteredTerm: boolean;
  /** 연결된 용어 */
  term?: Term;
  /** 연결된 도메인 */
  domain?: Domain;
  /** 용어 ID */
  termId?: number;
  /** 도메인 ID */
  domainId: number | null;
  /** 물리 타입 */
  physicalType?: string;
}

/**
 * 논리명을 단어사전 기준으로 해석하고, 전체 용어 등록 여부를 함께 계산한다.
 *
 * 규칙:
 * - 물리명은 단어사전 완전 조합일 때만 산출한다.
 * - 도메인/type은 전체 용어가 용어사전에 등록돼 있을 때만 부여한다.
 *
 * @param input 원본 논리명
 * @param dictionary 사전 인덱스
 * @returns 해석 결과
 */
export function resolveLogicalName(
  input: string,
  dictionary: LogicalNameResolverDictionary,
): LogicalNameResolution {
  const query = input.trim();
  const wordAnalysis = analyzeWordComposition(query, dictionary.wordMatchIndex);
  const term = query ? dictionary.termByName.get(query) : undefined;
  const domain =
    wordAnalysis.isCompleteMatch && term?.domainId != null
      ? dictionary.domainById.get(term.domainId)
      : undefined;

  let state: LogicalNameResolutionState = 'empty';
  if (query) {
    if (wordAnalysis.isAmbiguous) {
      state = 'ambiguous';
    } else if (!wordAnalysis.isCompleteMatch) {
      state = 'word-missing';
    } else if (term) {
      state = 'registered';
    } else {
      state = 'term-missing';
    }
  }

  return {
    input,
    query,
    state,
    wordAnalysis,
    physicalName: wordAnalysis.isCompleteMatch ? wordAnalysis.derivedPhysicalName : '',
    isWordCompleteMatch: wordAnalysis.isCompleteMatch,
    isRegisteredTerm: state === 'registered',
    term,
    domain,
    termId: state === 'registered' ? term?.id : undefined,
    domainId: state === 'registered' ? (term?.domainId ?? null) : null,
    physicalType: state === 'registered' ? domain?.physicalType : undefined,
  };
}
