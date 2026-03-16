import type { TFunction } from 'i18next';
import type { SuggestResponse } from '@/types/dictionary';

/**
 * 추천 매칭 결과를 사용자에게 보여줄 힌트 텍스트로 변환한다.
 *
 * 매칭된 키워드-물리명 쌍을 쉼표로 연결한 문자열을 반환하며,
 * 매칭 결과가 없으면 null을 반환한다.
 *
 * @param suggestion 키워드 추천 응답 (없으면 null 반환)
 * @param t          i18next 번역 함수
 * @returns 힌트 텍스트 문자열 또는 null
 */
export function buildSuggestHintText(
  suggestion: SuggestResponse | undefined,
  t: TFunction,
): string | null {
  if (!suggestion?.matches || suggestion.matches.length === 0) {
    return null;
  }
  const matchedDetails = suggestion.matches
    .filter((match) => match.matched)
    .map((match) =>
      t('dictionary.suggest.matchDetail', {
        keyword: match.keyword,
        physical: match.physicalName ?? '',
      }),
    );
  if (matchedDetails.length === 0) {
    return null;
  }
  return matchedDetails.join(', ');
}
