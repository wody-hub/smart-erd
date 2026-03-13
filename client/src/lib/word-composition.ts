import type { Word } from '../types/dictionary.js';

export interface WordMatchCandidate {
  normalizedLogicalName: string;
  word: Word;
}

export interface WordMatchIndex {
  candidatesByFirstChar: Map<string, WordMatchCandidate[]>;
}

export interface WordCompositionSegment {
  text: string;
  matched: boolean;
  word?: Word;
}

export interface WordCompositionAnalysis {
  input: string;
  normalizedInput: string;
  isEmpty: boolean;
  isCompleteMatch: boolean;
  isAmbiguous: boolean;
  segments: WordCompositionSegment[];
  matchedWords: Word[];
  missingSegments: string[];
  creatableMissingSegments: string[];
  matchedWordIds: number[];
  derivedPhysicalName: string;
  ambiguousPhysicalNames: string[];
}

interface CompleteResolution {
  matchedWords: Word[];
  physicalParts: string[];
}

interface PartialResolution {
  segments: WordCompositionSegment[];
  matchedWords: Word[];
  matchedChars: number;
  unmatchedSegmentCount: number;
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

function mergeAdjacentUnmatched(segments: WordCompositionSegment[]): WordCompositionSegment[] {
  return segments.reduce<WordCompositionSegment[]>((acc, segment) => {
    const previous = acc[acc.length - 1];
    if (previous && !previous.matched && !segment.matched) {
      previous.text += segment.text;
      return acc;
    }
    acc.push({ ...segment });
    return acc;
  }, []);
}

function prependMatched(word: Word, tail: PartialResolution, matchedLength: number): PartialResolution {
  return {
    segments: [{ text: word.logicalName, matched: true, word }, ...tail.segments],
    matchedWords: [word, ...tail.matchedWords],
    matchedChars: matchedLength + tail.matchedChars,
    unmatchedSegmentCount: tail.unmatchedSegmentCount,
  };
}

function prependUnmatched(text: string, tail: PartialResolution): PartialResolution {
  return {
    segments: mergeAdjacentUnmatched([{ text, matched: false }, ...tail.segments]),
    matchedWords: tail.matchedWords,
    matchedChars: tail.matchedChars,
    unmatchedSegmentCount:
      tail.segments[0] && !tail.segments[0].matched
        ? tail.unmatchedSegmentCount
        : tail.unmatchedSegmentCount + 1,
  };
}

function isBetterPartialCandidate(candidate: PartialResolution, current: PartialResolution): boolean {
  if (candidate.matchedChars !== current.matchedChars) {
    return candidate.matchedChars > current.matchedChars;
  }
  if (candidate.unmatchedSegmentCount !== current.unmatchedSegmentCount) {
    return candidate.unmatchedSegmentCount < current.unmatchedSegmentCount;
  }
  return candidate.matchedWords.length > current.matchedWords.length;
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

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

  const candidatesByFirstChar = new Map<string, WordMatchCandidate[]>();
  candidates.forEach((candidate) => {
    const firstChar = candidate.normalizedLogicalName[0];
    const current = candidatesByFirstChar.get(firstChar) ?? [];
    current.push(candidate);
    candidatesByFirstChar.set(firstChar, current);
  });

  return { candidatesByFirstChar };
}

function findMatchingCandidates(
  normalizedInput: string,
  index: number,
  matchIndex: WordMatchIndex,
): WordMatchCandidate[] {
  const firstChar = normalizedInput[index];
  const candidates = matchIndex.candidatesByFirstChar.get(firstChar);
  if (!candidates) {
    return [];
  }
  return candidates.filter((candidate) =>
    normalizedInput.startsWith(candidate.normalizedLogicalName, index),
  );
}

function searchCompleteResolutions(
  normalizedInput: string,
  matchIndex: WordMatchIndex,
  index: number,
  memo: Map<number, CompleteResolution[]>,
): CompleteResolution[] {
  if (index >= normalizedInput.length) {
    return [{ matchedWords: [], physicalParts: [] }];
  }

  const cached = memo.get(index);
  if (cached) {
    return cached;
  }

  const resolutions: CompleteResolution[] = [];
  const candidates = findMatchingCandidates(normalizedInput, index, matchIndex);
  candidates.forEach((candidate) => {
    const tails = searchCompleteResolutions(
      normalizedInput,
      matchIndex,
      index + candidate.normalizedLogicalName.length,
      memo,
    );
    tails.forEach((tail) => {
      resolutions.push({
        matchedWords: [candidate.word, ...tail.matchedWords],
        physicalParts: [candidate.word.physicalName, ...tail.physicalParts],
      });
    });
  });

  const deduped = resolutions.filter((resolution, resolutionIndex, array) => {
    const signature = resolution.physicalParts.join('_');
    return array.findIndex((candidate) => candidate.physicalParts.join('_') === signature) === resolutionIndex;
  });

  memo.set(index, deduped.slice(0, 2));
  return memo.get(index)!;
}

function searchBestPartialResolution(
  normalizedInput: string,
  matchIndex: WordMatchIndex,
  index: number,
  memo: Map<number, PartialResolution>,
): PartialResolution {
  if (index >= normalizedInput.length) {
    return {
      segments: [],
      matchedWords: [],
      matchedChars: 0,
      unmatchedSegmentCount: 0,
    };
  }

  const cached = memo.get(index);
  if (cached) {
    return cached;
  }

  let best = prependUnmatched(
    normalizedInput[index]!,
    searchBestPartialResolution(normalizedInput, matchIndex, index + 1, memo),
  );

  const candidates = findMatchingCandidates(normalizedInput, index, matchIndex);
  candidates.forEach((candidate) => {
    const tail = searchBestPartialResolution(
      normalizedInput,
      matchIndex,
      index + candidate.normalizedLogicalName.length,
      memo,
    );
    const resolved = prependMatched(candidate.word, tail, candidate.normalizedLogicalName.length);
    if (isBetterPartialCandidate(resolved, best)) {
      best = resolved;
    }
  });

  memo.set(index, best);
  return best;
}

function analyzeSingleUnit(
  rawInput: string,
  matchIndex: WordMatchIndex,
  allowWholeMissingCreationWhenNoMatches: boolean,
): UnitAnalysis {
  const normalizedInput = normalizeText(rawInput.trim());
  if (!normalizedInput) {
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

  const completeResolutions = searchCompleteResolutions(
    normalizedInput,
    matchIndex,
    0,
    new Map<number, CompleteResolution[]>(),
  );

  if (completeResolutions.length === 1) {
    const resolution = completeResolutions[0]!;
    return {
      isCompleteMatch: true,
      isAmbiguous: false,
      segments: resolution.matchedWords.map((word) => ({
        text: word.logicalName,
        matched: true,
        word,
      })),
      matchedWords: resolution.matchedWords,
      missingSegments: [],
      creatableMissingSegments: [],
      derivedPhysicalName: resolution.physicalParts.join('_'),
      ambiguousPhysicalNames: [],
    };
  }

  if (completeResolutions.length > 1) {
    return {
      isCompleteMatch: false,
      isAmbiguous: true,
      segments: [],
      matchedWords: [],
      missingSegments: [],
      creatableMissingSegments: [],
      derivedPhysicalName: '',
      ambiguousPhysicalNames: dedupeStrings(
        completeResolutions.map((resolution) => resolution.physicalParts.join('_')),
      ),
    };
  }

  const partialResolution = searchBestPartialResolution(
    normalizedInput,
    matchIndex,
    0,
    new Map<number, PartialResolution>(),
  );

  const mergedSegments = mergeAdjacentUnmatched(partialResolution.segments);
  const missingSegments = dedupeStrings(
    mergedSegments.filter((segment) => !segment.matched).map((segment) => segment.text),
  );
  const hasMatchedWord = partialResolution.matchedWords.length > 0;

  return {
    isCompleteMatch: false,
    isAmbiguous: false,
    segments: mergedSegments,
    matchedWords: partialResolution.matchedWords,
    missingSegments,
    creatableMissingSegments:
      hasMatchedWord || allowWholeMissingCreationWhenNoMatches ? missingSegments : [],
    derivedPhysicalName: partialResolution.matchedWords.map((word) => word.physicalName).join('_'),
    ambiguousPhysicalNames: [],
  };
}

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
  const analyses =
    tokens.length > 1
      ? tokens.map((token) => analyzeSingleUnit(token, matchIndex, true))
      : [analyzeSingleUnit(trimmedInput, matchIndex, false)];

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
