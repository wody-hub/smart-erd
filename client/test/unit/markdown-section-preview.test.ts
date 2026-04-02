// Wave 1 스캐폴드 — 구현 모듈은 Plan 03에서 생성됩니다.
// 현재 import 경로가 존재하지 않아 컴파일 오류(RED)가 발생합니다.
// Plan 03 실행 시 import 주석 해제 + 케이스 본문 구현.

import test from 'node:test';
// import assert from 'node:assert/strict';
// import { computeSectionPreviewHtml } from '../../src/lib/markdown-section-preview-cache.js';

// --- DOC-02: Section HTML 캐시 (증분 프리뷰) ---

test.describe('computeSectionPreviewHtml (Section HTML 캐시)', () => {
  test.skip('초기 호출 시 모든 section을 렌더링하여 캐시를 채운다', () => {
    // 첫 호출: changedSectionIds = null (전체 캐시 빌드)
    // → 모든 section 에 대해 HTML 생성
    // → cache.size === boundaries.length
  });

  test.skip('변경된 sectionId만 재렌더링되고 다른 section 캐시는 유지된다', () => {
    // 두 번째 호출: changedSectionIds = Set(['api'])
    // → 'api' section HTML 만 새로 렌더링
    // → 다른 section 의 HTML 은 이전 캐시 값과 동일
  });

  test.skip('changedSectionIds가 비어 있으면 캐시된 HTML을 그대로 반환한다', () => {
    // changedSectionIds = Set([])
    // → 아무 section 도 재렌더링하지 않음
    // → 반환 HTML 이 이전 호출 결과와 완전히 동일
  });

  test.skip('section 순서가 변경되면 전체 재렌더링 fallback을 수행한다', () => {
    // 이전 boundaries: [a, b, c]
    // 다음 boundaries: [a, c, b] (순서 변경)
    // → 전체 section 재렌더링
  });

  test.skip('section이 삭제되면 해당 section HTML이 결과에서 제거된다', () => {
    // 이전 boundaries: [a, b, c]
    // 다음 boundaries: [a, c] (b 삭제)
    // → 결과 HTML 에 'b' section 내용 없음
    // → 캐시에서 'b' 제거
  });
});
