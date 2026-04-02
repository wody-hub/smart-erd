---
phase: 01-markdown-incremental-sync
plan: 07
subsystem: collaboration
tags: [markdown, scope-resolver, validation, websocket]

requires:
  - phase: 01-markdown-incremental-sync-02
    provides: MarkdownScopeResolver 기본 구현체
provides:
  - MarkdownScopeResolver payload 검증 강화 (null payload, blank sectionId, offset 음수/역전 방어)
affects: [markdown-collaboration, websocket-relay]

tech-stack:
  added: []
  patterns: [guard-clause-early-return, instanceof-pattern-matching-validation]

key-files:
  created: []
  modified:
    - src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolver.java

key-decisions:
  - "instanceof Number + longValue() 패턴으로 offset 타입 안전 검증 -- Number 하위 타입(Integer, Long, Double) 모두 커버"

patterns-established:
  - "Scope resolver 검증 패턴: null payload -> blank ID -> offset range 순서로 guard clause 적용"

requirements-completed: [DOC-01]

duration: 1min
completed: 2026-04-02
---

# Phase 01 Plan 07: MarkdownScopeResolver Payload 검증 강화 Summary

**MarkdownScopeResolver에 payload null/blank sectionId/offset 음수-역전 검증을 추가하여 잘못된 payload를 document root scope로 안전하게 fallback 처리**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-02T14:25:11Z
- **Completed:** 2026-04-02T14:25:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- payload null 체크를 별도 guard clause로 분리하여 NPE 방어
- startOffset/endOffset 음수 및 역전(start > end) 검증 추가
- Javadoc에 fallback 조건 명시

## Task Commits

Each task was committed atomically:

1. **Task 1: MarkdownScopeResolver payload 검증 강화** - `da730f6` (fix)

## Files Created/Modified
- `src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolver.java` - payload null/blank/offset 검증 guard clause 추가, Javadoc 보강

## Decisions Made
- `instanceof Number` + `longValue()` 패턴으로 offset 타입 안전 검증 -- Number 하위 타입(Integer, Long, Double) 모두 커버
- `sid.isBlank()` 직접 호출 유지 -- `instanceof String sid` 패턴 매칭으로 이미 null-safe이므로 AppStringUtils 불필요

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None

## Next Phase Readiness
- Gap closure plan 07 완료, MarkdownScopeResolver가 악의적/잘못된 payload를 안전하게 방어
- 추가 gap closure plan (05, 06)과 독립적으로 완료 가능

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
