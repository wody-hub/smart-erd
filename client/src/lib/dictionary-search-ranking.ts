interface SearchableEntry {
  logicalName?: string | null;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function findMatchIndex(value: string | null | undefined, keyword: string): number {
  if (!keyword) {
    return -1;
  }
  return normalizeSearchValue(value).indexOf(keyword);
}

function getEntrySearchScore<T extends SearchableEntry>(
  entry: T,
  keyword: string,
  otherFields: Array<string | null | undefined>,
): [number, number, number] {
  const logicalMatchIndex = findMatchIndex(entry.logicalName, keyword);
  if (logicalMatchIndex >= 0) {
    return [0, logicalMatchIndex, 0];
  }

  let bestOtherMatchIndex = Number.POSITIVE_INFINITY;
  for (const field of otherFields) {
    const fieldMatchIndex = findMatchIndex(field, keyword);
    if (fieldMatchIndex >= 0) {
      bestOtherMatchIndex = Math.min(bestOtherMatchIndex, fieldMatchIndex);
    }
  }

  if (Number.isFinite(bestOtherMatchIndex)) {
    return [1, bestOtherMatchIndex, 0];
  }

  return [2, Number.POSITIVE_INFINITY, 0];
}

/**
 * 사전 검색 결과를 논리명 우선으로 재정렬한다.
 *
 * @param entries      정렬 대상 목록
 * @param keyword      검색 키워드
 * @param selectFields 논리명 외 보조 매칭 대상 필드 선택자
 * @returns 정렬된 새 배열
 */
export function rankDictionarySearchResults<T extends SearchableEntry>(
  entries: T[],
  keyword: string,
  selectFields: (entry: T) => Array<string | null | undefined>,
): T[] {
  const normalizedKeyword = normalizeSearchValue(keyword);
  if (!normalizedKeyword) {
    return entries;
  }

  return entries
    .map((entry, index) => ({
      entry,
      index,
      score: getEntrySearchScore(entry, normalizedKeyword, selectFields(entry)),
    }))
    .sort((left, right) => {
      const [leftCategory, leftIndex] = left.score;
      const [rightCategory, rightIndex] = right.score;

      if (leftCategory !== rightCategory) {
        return leftCategory - rightCategory;
      }
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return left.index - right.index;
    })
    .map((item) => item.entry);
}
