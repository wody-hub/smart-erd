# Phase 13 Code Review

## Review Scope

- `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java`
- `src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java`
- `src/main/resources/ai/prompts/codex-provider-v1.md`
- `src/main/resources/ai/prompts/provider-response-v1.md`
- Phase 13 GSD artifacts

## Findings

### Fixed During Review

1. Provider context truncation could silently drop caps metadata.
   - Fixed by reserving truncation marker and caps footer, capping text fields, and adding overflow tests.

2. History reads could report complete results after scanning only the first capped WBS subset.
   - Fixed by exposing `wbsScannedCount`, `wbsTotalCount`, `wbsScanTruncated`, and setting `truncated=true` when scan is partial.

3. Member TODO owner cap was applied before grouping and could exceed the intended owner cap.
   - Fixed by grouping first, then limiting owner rows to `MAX_MEMBER_TODO_OWNERS` with returned/total/truncated metadata.

4. One prompt file was not active at runtime.
   - Fixed by moving active login ID/readContext guardrails into `codex-provider-v1.md`.

## Final Review

Final targeted re-review found no blocking findings and no warnings.
