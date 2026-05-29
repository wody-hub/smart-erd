---
phase: 01-markdown-incremental-sync
plan: 04
subsystem: ui
tags: [react, web-worker, markdown, preview, cache, incremental-rendering]

# Dependency graph
requires:
  - phase: 01-markdown-incremental-sync/01-01
    provides: computeSectionBoundaries, SectionBoundary 인터페이스
  - phase: 01-markdown-incremental-sync/01-03
    provides: buildSectionCommands, applyIncrementalTextUpdate
provides:
  - SectionPreviewCache 클래스 (section HTML 캐시 Map 관리)
  - useMarkdownSectionPreview 훅 (section-aware 증분 프리뷰)
  - Worker section 단위 메시지 프로토콜 (sectionId 기반)
affects: [markdown-editor, markdown-preview, document-plugin]

# Tech tracking
tech-stack:
  added: []
  patterns: [section-preview-cache, section-request-id-map, worker-message-branching]

key-files:
  created:
    - client/src/lib/markdown-section-preview-cache.ts
    - client/src/hooks/useMarkdownSectionPreview.ts
  modified:
    - client/src/lib/markdown-preview-worker.ts
    - client/src/pages/document/MarkdownDocumentPage.tsx
    - client/test/unit/markdown-section-preview.test.ts

key-decisions:
  - "section별 requestId Map으로 Pitfall 4(stale 응답 덮어쓰기) 방어"
  - "section 순서 변경 시 전체 캐시 무효화 + 전체 재렌더링 fallback"
  - "Worker 메시지 프로토콜 하위 호환: sectionId 유무로 분기"

patterns-established:
  - "SectionPreviewCache: section 순서 추적 + HTML 캐시 분리로 증분 프리뷰 지원"
  - "Worker 메시지 분기 패턴: sectionId in data 로 full/section 모드 판별"
  - "section별 requestId Map: 비동기 Worker 응답의 stale 방어 패턴"

requirements-completed: [DOC-02]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 01 Plan 04: Section HTML 캐시 증분 프리뷰 Summary

**SectionPreviewCache + useMarkdownSectionPreview 훅으로 변경된 section만 Worker 재렌더링, 나머지 캐시 유지**

## Performance

- **Duration:** 5min
- **Started:** 2026-04-02T13:20:05Z
- **Completed:** 2026-04-02T13:25:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SectionPreviewCache: section ID -> HTML 캐시 Map + 순서 변경 감지 + invalidateAll + buildFullHtml
- useMarkdownSectionPreview: section별 requestId Map(Pitfall 4 방어), Worker fallback, 300ms debounce
- markdown-preview-worker: sectionId 기반 section 단위 렌더링 지원 (기존 full body 호환 유지)
- MarkdownDocumentPage: useMarkdownPreview -> useMarkdownSectionPreview 교체 완료
- 단위 테스트 7개 케이스 GREEN (전체 240 PASS)

## Task Commits

Each task was committed atomically:

1. **Task 1: SectionPreviewCache + useMarkdownSectionPreview + Worker 확장 + 테스트** - `47ab349` (feat)
2. **Task 2: MarkdownDocumentPage 훅 교체** - `9b72987` (feat)

## Files Created/Modified
- `client/src/lib/markdown-section-preview-cache.ts` - Section HTML 캐시 자료구조 (Map + 순서 추적)
- `client/src/hooks/useMarkdownSectionPreview.ts` - section-aware 증분 프리뷰 React 훅
- `client/src/lib/markdown-preview-worker.ts` - Worker에 section 단위 메시지 프로토콜 추가
- `client/src/pages/document/MarkdownDocumentPage.tsx` - useMarkdownSectionPreview로 교체
- `client/test/unit/markdown-section-preview.test.ts` - SectionPreviewCache 단위 테스트 7개

## Decisions Made
- section별 requestId Map으로 Pitfall 4(연속 변경 시 이전 응답이 최신 응답 덮어쓰기) 방어
- section 순서 변경 시 전체 캐시 무효화 후 전체 재렌더링 fallback (안전성 우선)
- Worker 메시지 하위 호환: `'sectionId' in data` 조건으로 full/section 모드 분기

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - 모든 기능이 완전히 연결됨.

## Next Phase Readiness
- Phase 01 모든 Plan(01~04) 완료
- DOC-01(증분 동기화) + DOC-02(증분 프리뷰) 요구사항 모두 이행
- 기존 useMarkdownPreview는 하위 호환으로 유지 (다른 곳에서 사용 가능)

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
