---
phase: 01-markdown-incremental-sync
plan: 06
subsystem: markdown
tags: [markdown, section-index, preview-cache, code-fence, gc]

requires:
  - phase: 01-01
    provides: computeSectionBoundaries, SectionBoundary, markdown-section-index.ts
  - phase: 01-04
    provides: SectionPreviewCache, markdown-section-preview-cache.ts

provides:
  - fenced code block 인식 로직 (backtick/tilde fence skip)
  - stale section 캐시 자동 GC

affects: [01-markdown-incremental-sync]

tech-stack:
  added: []
  patterns:
    - "fenced code range 사전 계산 후 heading 매칭 필터링"
    - "Set 기반 stale cache GC on order change"

key-files:
  created: []
  modified:
    - client/src/lib/markdown-section-index.ts
    - client/src/lib/markdown-section-preview-cache.ts
    - client/test/unit/markdown-section-index.test.ts

key-decisions:
  - "HEADING_PATTERN regex 변경 대신 fenced code range 사전 계산 + heading 필터링 전략 채택"
  - "FENCE_PATTERN 을 모듈 상수로 선언 (exec 종료 시 lastIndex 자동 리셋)"

patterns-established:
  - "Fenced code block range 계산: findFencedCodeRanges() 헬퍼로 [start, end) 범위 배열 반환"
  - "Cache GC: updateSectionOrder 에서 순서 변경 시 activeIds Set 대비 stale 키 삭제"

requirements-completed: [DOC-01, DOC-02]

duration: 4min
completed: 2026-04-02
---

# Phase 01 Plan 06: Gap Closure Summary

**fenced code block 내 heading 오탐 방지 + SectionPreviewCache stale entry GC 로직 추가**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T14:25:09Z
- **Completed:** 2026-04-02T14:29:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- computeSectionBoundaries 가 fenced code block (backtick/tilde) 내 `#` 문자를 heading 으로 오탐하지 않음
- unclosed fence, info string 있는 fence, 4+ backtick 중첩 fence 모두 정확히 처리
- SectionPreviewCache 가 section 순서 변경 시 삭제된 section 의 stale HTML 캐시를 자동 정리

## Task Commits

Each task was committed atomically:

1. **Task 1: computeSectionBoundaries fenced code block skip 로직** - `2a62893` (test/RED) + `753dcce` (feat/GREEN)
2. **Task 2: SectionPreviewCache stale entry GC** - `4637fe3` (fix)

_Note: Task 1 은 TDD 로 실행 (RED -> GREEN)_

## Files Created/Modified
- `client/src/lib/markdown-section-index.ts` - findFencedCodeRanges 헬퍼 추가 + heading 매칭 필터링
- `client/src/lib/markdown-section-preview-cache.ts` - updateSectionOrder 에 GC 로직 추가
- `client/test/unit/markdown-section-index.test.ts` - fenced code block 테스트 5건 추가 (총 18건)

## Decisions Made
- HEADING_PATTERN regex 를 변경하지 않고, fenced code range 를 사전 계산하여 heading match 를 필터링하는 전략 채택 (regex 복잡도 증가 방지)
- FENCE_PATTERN 은 모듈 상수로 유지 (exec 이 null 반환 시 lastIndex 자동 리셋되므로 안전)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tildes 테스트 기대값 수정**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** 플랜의 tildes 테스트가 root section 을 고려하지 않아 기대값이 1 이었으나 실제 결과는 2 (root + visible)
- **Fix:** 테스트 기대값을 2 로 수정하고 root section 검증 추가
- **Files modified:** client/test/unit/markdown-section-index.test.ts
- **Verification:** 전체 18개 테스트 통과
- **Committed in:** 753dcce (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan test expectation)
**Impact on plan:** 테스트 기대값만 수정, 로직 변경 없음. 범위 크리프 없음.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all implementations are fully wired.

## Next Phase Readiness
- section 경계 계산이 fenced code block 을 올바르게 처리하여 증분 동기화 정확성 향상
- 캐시 GC 로직으로 장시간 편집 시 메모리 안정성 확보

## Self-Check: PASSED

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
