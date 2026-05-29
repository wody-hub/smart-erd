---
phase: 01-markdown-incremental-sync
plan: 05
subsystem: collaboration
tags: [yjs, diff-match-patch, markdown, section, crdt, remote-pending]

requires:
  - phase: 01-markdown-incremental-sync (plan 03)
    provides: section-aware MutationApplier, buildSectionCommands, RemotePendingBanner 컴포넌트
  - phase: 01-markdown-incremental-sync (plan 04)
    provides: section preview cache, useMarkdownSectionPreview
provides:
  - applySectionUpdate sectionId 기반 경계 재계산 (동시 편집 offset 밀림 방지)
  - RemotePendingBanner 렌더링 배선 (D-07 자동 수락 / D-08 배너 표시)
  - activeSectionId 추적 (편집 중인 section 식별)
affects: [01-markdown-incremental-sync]

tech-stack:
  added: []
  patterns:
    - "sectionId 기반 경계 재계산: applySectionUpdate가 절대 offset 대신 sectionId로 현재 body에서 동적 경계 탐색"
    - "원격 변경 감지: DocumentChangeEvent origin.source === 'remote' 기반 remoteMutation 상태 추적"

key-files:
  created: []
  modified:
    - client/src/collaboration/yjs/markdown-yjs-document-adapter.ts
    - client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts
    - client/src/pages/document/MarkdownDocumentPage.tsx
    - client/src/pages/document/use-markdown-document-session.ts

key-decisions:
  - "Yjs CRDT 자동 병합 특성상 accept/reject은 배너 닫기로 구현 (undo 불필요)"
  - "원격 변경 감지: DocumentChangeEvent의 origin.source와 affectedScopes 기반으로 remoteMutation 파생"

patterns-established:
  - "sectionId 경계 재계산 패턴: 수신 측에서 computeSectionBoundaries로 현재 body 기준 offset 산출"

requirements-completed: [DOC-01]

duration: 5min
completed: 2026-04-02
---

# Phase 01 Plan 05: Gap Closure -- offset 재계산 + RemotePendingBanner 배선 Summary

**applySectionUpdate를 sectionId 기반 경계 재계산으로 전환하고, RemotePendingBanner를 MarkdownDocumentPage에 배선하여 D-07/D-08 UX 동작 가능 상태로 완성**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T14:24:56Z
- **Completed:** 2026-04-02T14:29:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- applySectionUpdate 시그니처를 (doc, sectionId, sectionText, origin)으로 변경하여 동시 편집 시 offset 밀림 방지
- MutationApplier에서 startOffset/endOffset 전달 제거, sectionId만 전달
- RemotePendingBanner를 MarkdownDocumentPage에 렌더링하고 activeSectionId prop 전달
- useMarkdownDocumentSession에서 activeSectionId 추적 및 원격 변경 감지 로직 추가

## Task Commits

Each task was committed atomically:

1. **Task 1: applySectionUpdate offset 재계산** - `96b864b` (fix)
2. **Task 2: RemotePendingBanner 렌더링 배선 + activeSectionId 전달** - `a704df9` (feat)

## Files Created/Modified
- `client/src/collaboration/yjs/markdown-yjs-document-adapter.ts` - applySectionUpdate sectionId 기반 경계 재계산
- `client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts` - offset 파라미터 제거, sectionId 기반 호출
- `client/src/pages/document/MarkdownDocumentPage.tsx` - RemotePendingBanner import + JSX 렌더링
- `client/src/pages/document/use-markdown-document-session.ts` - activeSectionId/remoteMutation 상태 추가, 원격 변경 감지

## Decisions Made
- Yjs CRDT 자동 병합 특성상 accept/reject 콜백은 배너 닫기(setRemoteMutation(null))만 수행
- 원격 변경 감지는 DocumentChangeEvent의 origin.source === 'remote'와 affectedScopes를 기반으로 remoteMutation 파생

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- D-07(다른 section 자동 수락)과 D-08(같은 section 배너 표시)이 동작 가능한 상태
- 향후 plan 06/07에서 추가 gap closure 작업 진행 예정

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
