---
phase: 01-markdown-incremental-sync
plan: 02
subsystem: collaboration
tags: [scope-resolver, collaboration-plugin, markdown, yjs, spring-component]

# Dependency graph
requires: []
provides:
  - "MarkdownScopeResolver: markdown command -> section/{id} 또는 document/root scope 해석"
  - "MarkdownCollaborationPlugin: @Component 등록, pluginId=markdown, supportedEngineIds={yjs}"
affects: [01-markdown-incremental-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BaseCollaborationPlugin 구현 패턴: no-op DomainValidationHook lambda"
    - "ScopeResolver switch expression 패턴: commandKey별 scope 해석"

key-files:
  created:
    - src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolver.java
    - src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownCollaborationPlugin.java
    - src/test/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolverTest.java
  modified: []

key-decisions:
  - "DomainValidationHook은 별도 빈 없이 no-op lambda로 구현 (현재 markdown 플러그인은 도메인 검증 불필요)"
  - "MarkdownScopeResolver는 Spring 빈이 아닌 POJO로 구현, MarkdownCollaborationPlugin 내부에서 생성"

patterns-established:
  - "BaseCollaborationPlugin 구현 시 DomainValidationHook no-op lambda 패턴"

requirements-completed: [DOC-01]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 1 Plan 02: MarkdownScopeResolver + MarkdownCollaborationPlugin Summary

**markdown:section-update 커맨드를 section/{id} EXCLUSIVE scope로 해석하는 ScopeResolver와 pluginId="markdown" BaseCollaborationPlugin 구현**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T13:02:41Z
- **Completed:** 2026-04-02T13:04:49Z
- **Tasks:** 1 (TDD: RED -> GREEN)
- **Files modified:** 3

## Accomplishments
- MarkdownScopeResolver: markdown:section-update -> section/{id} EXCLUSIVE scope, body-replace/frontmatter-update/unknown -> document/root EXCLUSIVE
- MarkdownCollaborationPlugin: @Component, pluginId="markdown", supportedEngineIds={"yjs"}, schemaVersion=1
- 8개 단위 테스트 모두 GREEN (section scope, 빈/null sectionId fallback, body-replace, frontmatter-update, unknown command, pluginId, engineIds)

## Task Commits

Each task was committed atomically:

1. **Task 1: MarkdownScopeResolver + MarkdownCollaborationPlugin 구현**
   - `296bddb` (test: TDD RED - failing tests)
   - `a29335c` (feat: TDD GREEN - implementation + all tests pass)

## Files Created/Modified
- `src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolver.java` - markdown command -> section/document scope 해석
- `src/main/java/com/smarterd/domain/diagram/collaboration/MarkdownCollaborationPlugin.java` - BaseCollaborationPlugin 구현, @Component Spring 빈
- `src/test/java/com/smarterd/domain/diagram/collaboration/MarkdownScopeResolverTest.java` - 8개 단위 테스트

## Decisions Made
- DomainValidationHook은 별도 빈 없이 no-op lambda로 구현 -- markdown 플러그인은 현재 도메인 검증 불필요
- MarkdownScopeResolver는 Spring 빈이 아닌 POJO로 구현, MarkdownCollaborationPlugin 생성자에서 직접 인스턴스화 -- ScopeResolver는 상태 없는 순수 로직이므로 빈 등록 불필요

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] MarkdownCollaborationPlugin 생성자 변경 (DomainValidationHook 주입 -> 내부 no-op)**
- **Found during:** Task 1 (구현)
- **Issue:** 플랜에서는 DomainValidationHook을 생성자 주입으로 설계했으나, 기존 코드베이스에 DomainValidationHook 빈이 존재하지 않아 주입 불가
- **Fix:** 생성자를 no-arg로 변경하고 validationHook()에서 no-op lambda를 반환하도록 구현
- **Files modified:** MarkdownCollaborationPlugin.java
- **Verification:** compileJava 성공, 8개 테스트 GREEN
- **Committed in:** a29335c

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** DomainValidationHook 빈 부재로 생성자 시그니처 변경. 기능적 동작 동일 (no-op). 향후 도메인 검증이 필요하면 lambda를 실제 구현으로 교체.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MarkdownCollaborationPlugin이 @Component로 등록되어 CollaborationPluginRegistry에서 pluginId="markdown"으로 조회 가능
- 다음 플랜(01-03, 01-04)에서 FE markdown:section-update 커맨드 발행 시 BE가 section-level scope로 해석

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
