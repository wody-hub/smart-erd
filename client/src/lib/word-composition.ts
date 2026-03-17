import type { Word } from '../types/dictionary.js';

/** 정규화된 논리명으로 매칭된 단어 후보 */
export interface WordMatchCandidate {
  /** 공백 제거된 정규화 논리명 */
  normalizedLogicalName: string;
  /** 원본 단어 데이터 */
  word: Word;
}

/** 단어 매칭 인덱스 — 정규화 논리명 기준 역인덱스 */
export interface WordMatchIndex {
  /** 정규화 논리명 → 후보 단어 목록 */
  exactCandidatesByNormalized: Map<string, WordMatchCandidate[]>;
}

/** 단어 조합 분석의 개별 세그먼트 */
export interface WordCompositionSegment {
  /** 세그먼트 텍스트 */
  text: string;
  /** 단어 사전에 매칭되었는지 여부 */
  matched: boolean;
  /** 매칭된 단어 (matched=true일 때) */
  word?: Word;
}

/** 단어 조합 분석 결과 */
export interface WordCompositionAnalysis {
  /** 원본 입력 문자열 */
  input: string;
  /** 정규화된 입력 문자열 */
  normalizedInput: string;
  /** 입력이 비어있는지 여부 */
  isEmpty: boolean;
  /** 모든 세그먼트가 매칭되었는지 여부 */
  isCompleteMatch: boolean;
  /** 동일 논리명에 물리명이 2개 이상인 모호한 상태인지 여부 */
  isAmbiguous: boolean;
  /** 분석된 세그먼트 목록 */
  segments: WordCompositionSegment[];
  /** 매칭된 단어 목록 */
  matchedWords: Word[];
  /** 미매칭 세그먼트 논리명 목록 */
  missingSegments: string[];
  /** 신규 등록 가능한 미매칭 세그먼트 목록 */
  creatableMissingSegments: string[];
  /** 매칭된 단어 ID 목록 */
  matchedWordIds: number[];
  /** 파생된 물리명 (완전 매칭 시) */
  derivedPhysicalName: string;
  /** 모호한 물리명 후보 목록 */
  ambiguousPhysicalNames: string[];
}

interface UnitAnalysis {
  isCompleteMatch: boolean;
  isAmbiguous: boolean;
  segments: WordCompositionSegment[];
  matchedWords: Word[];
  missingSegments: string[];
  creatableMissingSegments: string[];
  derivedPhysicalName: string;
  ambiguousPhysicalNames: string[];
}

const normalizeText = (value: string): string => value.replace(/\s+/g, '');

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

/**
 * 단어 목록으로부터 매칭 인덱스를 구축한다.
 *
 * 정규화된 논리명을 키로 하여 역인덱스를 생성하며,
 * 긴 논리명이 우선 매칭되도록 길이 역순으로 정렬한다.
 *
 * @param words 단어 목록
 * @returns 단어 매칭 인덱스
 */
export function buildWordMatchIndex(words: Word[]): WordMatchIndex {
  const candidates = words
    .map((word) => ({
      normalizedLogicalName: normalizeText(word.logicalName),
      word,
    }))
    .filter((candidate) => candidate.normalizedLogicalName.length > 0)
    .sort((a, b) => {
      const lengthDiff = b.normalizedLogicalName.length - a.normalizedLogicalName.length;
      if (lengthDiff !== 0) {
        return lengthDiff;
      }
      return a.word.logicalName.localeCompare(b.word.logicalName, 'ko');
    });

  const exactCandidatesByNormalized = new Map<string, WordMatchCandidate[]>();
  candidates.forEach((candidate) => {
    const current = exactCandidatesByNormalized.get(candidate.normalizedLogicalName) ?? [];
    current.push(candidate);
    exactCandidatesByNormalized.set(candidate.normalizedLogicalName, current);
  });

  return { exactCandidatesByNormalized };
}

function pickPreferredCandidate(
  rawToken: string,
  candidates: WordMatchCandidate[],
): WordMatchCandidate {
  const trimmedToken = rawToken.trim();
  const exactLogicalNameMatch = candidates.find(
    (candidate) => candidate.word.logicalName === trimmedToken,
  );
  if (exactLogicalNameMatch) {
    return exactLogicalNameMatch;
  }
  return [...candidates].sort((a, b) =>
    a.word.logicalName.localeCompare(b.word.logicalName, 'ko'),
  )[0]!;
}

function analyzeSingleUnit(
  rawInput: string,
  matchIndex: WordMatchIndex,
  allowWholeMissingCreationWhenNoMatches: boolean,
): UnitAnalysis {
  const trimmedInput = rawInput.trim();
  const normalizedInput = normalizeText(trimmedInput);
  if (!normalizedInput || !trimmedInput) {
    return {
      isCompleteMatch: false,
      isAmbiguous: false,
      segments: [],
      matchedWords: [],
      missingSegments: [],
      creatableMissingSegments: [],
      derivedPhysicalName: '',
      ambiguousPhysicalNames: [],
    };
  }

  const candidates = matchIndex.exactCandidatesByNormalized.get(normalizedInput) ?? [];
  const distinctPhysicalNames = dedupeStrings(
    candidates.map((candidate) => candidate.word.physicalName),
  );

  if (candidates.length > 0 && distinctPhysicalNames.length === 1) {
    const selectedCandidate = pickPreferredCandidate(trimmedInput, candidates);
    return {
      isCompleteMatch: true,
      isAmbiguous: false,
      segments: [
        {
          text: selectedCandidate.word.logicalName,
          matched: true,
          word: selectedCandidate.word,
        },
      ],
      matchedWords: [selectedCandidate.word],
      missingSegments: [],
      creatableMissingSegments: [],
      derivedPhysicalName: selectedCandidate.word.physicalName,
      ambiguousPhysicalNames: [],
    };
  }

  if (distinctPhysicalNames.length > 1) {
    return {
      isCompleteMatch: false,
      isAmbiguous: true,
      segments: [{ text: trimmedInput, matched: false }],
      matchedWords: [],
      missingSegments: [trimmedInput],
      creatableMissingSegments: [],
      derivedPhysicalName: '',
      ambiguousPhysicalNames: distinctPhysicalNames,
    };
  }

  return {
    isCompleteMatch: false,
    isAmbiguous: false,
    segments: [{ text: trimmedInput, matched: false }],
    matchedWords: [],
    missingSegments: [trimmedInput],
    creatableMissingSegments: allowWholeMissingCreationWhenNoMatches ? [trimmedInput] : [],
    derivedPhysicalName: '',
    ambiguousPhysicalNames: [],
  };
}

/**
 * 논리명을 단어 사전 기준으로 조합 분석한다.
 *
 * 공백으로 토큰을 분리한 후 각 토큰을 단어 인덱스에서 검색하여
 * 매칭 여부, 파생 물리명, 모호성 등을 판정한다.
 *
 * @param input      분석할 논리명 문자열
 * @param matchIndex 단어 매칭 인덱스
 * @returns 단어 조합 분석 결과
 */
export function analyzeWordComposition(
  input: string,
  matchIndex: WordMatchIndex,
): WordCompositionAnalysis {
  const trimmedInput = input.trim();
  const normalizedInput = normalizeText(trimmedInput);
  if (!normalizedInput) {
    return {
      input,
      normalizedInput,
      isEmpty: true,
      isCompleteMatch: false,
      isAmbiguous: false,
      segments: [],
      matchedWords: [],
      missingSegments: [],
      creatableMissingSegments: [],
      matchedWordIds: [],
      derivedPhysicalName: '',
      ambiguousPhysicalNames: [],
    };
  }

  const tokens = trimmedInput.split(/\s+/).filter(Boolean);
  const allowWholeMissingCreationWhenNoMatches = tokens.length > 1;
  const analyses = tokens.map((token) =>
    analyzeSingleUnit(token, matchIndex, allowWholeMissingCreationWhenNoMatches),
  );

  const segments = analyses.flatMap((analysis) => analysis.segments);
  const matchedWords = analyses.flatMap((analysis) => analysis.matchedWords);
  const missingSegments = dedupeStrings(analyses.flatMap((analysis) => analysis.missingSegments));
  const creatableMissingSegments = dedupeStrings(
    analyses.flatMap((analysis) => analysis.creatableMissingSegments),
  );
  const ambiguousPhysicalNames = dedupeStrings(
    analyses.flatMap((analysis) => analysis.ambiguousPhysicalNames),
  );
  const isAmbiguous = analyses.some((analysis) => analysis.isAmbiguous);
  const isCompleteMatch =
    !isAmbiguous &&
    analyses.every((analysis) => analysis.isCompleteMatch) &&
    matchedWords.length > 0;

  return {
    input,
    normalizedInput,
    isEmpty: false,
    isCompleteMatch,
    isAmbiguous,
    segments,
    matchedWords,
    missingSegments,
    creatableMissingSegments,
    matchedWordIds: matchedWords.map((word) => word.id),
    derivedPhysicalName: isCompleteMatch
      ? matchedWords.map((word) => word.physicalName).join('_')
      : '',
    ambiguousPhysicalNames,
  };
}
