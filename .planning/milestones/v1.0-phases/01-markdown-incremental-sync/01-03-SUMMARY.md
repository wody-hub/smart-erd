---
phase: 01-markdown-incremental-sync
plan: 03
subsystem: collaboration
tags: [yjs, diff-match-patch, crdt, section-update, incremental-sync]

requires:
  - phase: 01-markdown-incremental-sync plan 01
    provides: computeSectionBoundaries, findAffectedSection, SectionBoundary (markdown-section-index.ts)
provides:
  - applyIncrementalTextUpdate -- diff-match-patch -> Y.Text 증분 적용
  - buildSectionCommands -- section-aware 커맨드 결정 (section-update vs body-replace fallback)
  - applySectionUpdate -- markdown-yjs-document-adapter Y.Doc.transact 내 증분 적용
  - setEditorBuffer section-aware 커맨드 발행 (prevBodyRef 기반)
  - RemotePendingBanner -- section-aware 자동 수락 컴포넌트 (D-07, D-08)
affects: [01-04-PLAN (증분 프리뷰 렌더링), markdown-document-page 연결]

tech-stack:
  added: []
  patterns: [diff-match-patch Y.Text cursor 기반 증분 적용, section-level command dispatch, prevBodyRef 패턴]

key-files:
  created:
    - client/src/lib/incremental-text-update.ts
    - client/src/collaboration/plugins/markdown/markdown-section-projector.ts
    - client/src/components/collaboration/RemotePendingBanner.tsx
  modified:
    - client/src/collaboration/yjs/markdown-yjs-document-adapter.ts
    - client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts
    - client/src/pages/document/use-markdown-document-session.ts
    - client/test/unit/markdown-section-update.test.ts

key-decisions:
  - "diff-match-patch cursor 기반 Y.Text 증분 적용: DIFF_EQUAL/DELETE/INSERT -> cursor offset 기반 delete/insert 연산 매핑"
  - "buildSectionCommands 2단계 전략: section ID 순서 비교 후 section별 내용 비교로 단일 변경 식별"
  - "prevBodyRef로 이전 body 추적: useState 대신 useRef로 render 유발 방지, 협업 ready/sync/remote 변경 시 갱신"
  - "RemotePendingBanner activeSectionId prop: undefined이면 하위 호환 유지 (비마크다운 문서)"

patterns-established:
  - "diff-match-patch -> Y.Text 증분 적용 패턴: transact 내부에서 cursor offset 기반 delete/insert"
  - "section-aware 커맨드 발행 패턴: prevBody/nextBody 비교 -> section 구조 + 내용 비교 -> command 결정"
  - "자동 수락 패턴: useEffect + 조건부 null 반환으로 1-frame 깜빡임 방지"

requirements-completed: [DOC-01]

duration: 7min
completed: 2026-04-02
---

# Phase 01 Plan 03: FE 증분 동기화 핵심 경로 Summary

**diff-match-patch 기반 Y.Text 증분 적용 + section-aware 커맨드 발행 + RemotePendingBanner 자동 수락 구현**

## Performance

- **Duration:** 7min
- **Started:** 2026-04-02T13:09:44Z
- **Completed:** 2026-04-02T13:17:00Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

### Task 1: applyIncrementalTextUpdate + buildSectionCommands (TDD)

| Commit | Files | Description |
|--------|-------|-------------|
| 4af8bb4 | incremental-text-update.ts, markdown-section-projector.ts, markdown-section-update.test.ts | diff-match-patch -> Y.Text 증분 적용 + section-aware 커맨드 결정 |

- `applyIncrementalTextUpdate`: DIFF_EQUAL/DELETE/INSERT를 Y.Text cursor 기반 delete/insert로 매핑
- `buildSectionCommands`: 2단계 전략 -- (1) section ID 순서 비교로 구조 변경 감지 (2) section별 내용 비교로 단일 변경 식별
- 9개 테스트 케이스 전체 GREEN (5 applyIncrementalTextUpdate + 4 buildSectionCommands)

### Task 2: MutationApplier + DocumentAdapter + setEditorBuffer

| Commit | Files | Description |
|--------|-------|-------------|
| 9276256 | markdown-yjs-document-adapter.ts, markdown-document-mutation-applier.ts, use-markdown-document-session.ts | section-update 증분 적용 경로 + prevBodyRef 기반 커맨드 발행 |

- `applySectionUpdate` 메서드: startOffset 기준 diff-match-patch cursor 보정으로 section 범위만 Y.Text에 반영
- MutationApplier `markdown:section-update` case: `applyBufferReplace` 위임 제거, `applySectionUpdate` 직접 호출
- `setEditorBuffer`: `buildSectionCommands(prevBody, nextBody, fullBuffer)` 기반 커맨드 선택
- `prevBodyRef`: 협업 ready, sync, remote 변경 시 body 갱신으로 section 비교 정확성 보장

### Task 3: RemotePendingBanner (D-07, D-08)

| Commit | Files | Description |
|--------|-------|-------------|
| 5f69d3a | RemotePendingBanner.tsx | section-aware 자동 수락 + 3버튼 UI |

- D-07: `remoteMutation.key === 'markdown:section-update' && sectionId !== activeSectionId` -> `onAccept()` + `return null`
- D-08: 같은 section 충돌 시 기존 3버튼 UI(수락/거절/병합) 표시
- `activeSectionId` undefined이면 하위 호환 유지 (비마크다운 문서)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

- `RemotePendingBanner`의 `onAccept`/`onReject`/`onMerge` 콜백은 아직 부모 컴포넌트(MarkdownDocumentPage)에서 연결되지 않음. 컴포넌트는 완성되었으나 실제 배선은 Plan 04 또는 후속 통합에서 수행 예정.
- `activeSectionId`를 공급하는 커서 추적 로직(`currentSectionId` state)이 아직 `use-markdown-document-session.ts`에 미구현. 후속 Plan에서 Monaco editor cursor position 기반으로 구현 필요.

## Verification Results

| Check | Result |
|-------|--------|
| applySectionUpdate in adapter | PASS |
| buildSectionCommands in session | PASS |
| section-update -> applySectionUpdate in applier | PASS |
| Unit tests (233 pass / 0 fail) | PASS |
| npm run build | PASS |
| activeSectionId in RemotePendingBanner | PASS |
| markdown:section-update in RemotePendingBanner | PASS |

## Self-Check: PASSED
