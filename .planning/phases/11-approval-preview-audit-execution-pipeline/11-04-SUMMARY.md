---
phase: 11-approval-preview-audit-execution-pipeline
plan: 04
subsystem: ai-frontend
tags: [ai, proposals, approval, chat, persistence, privacy, ui]
requires:
  - phase: 11-approval-preview-audit-execution-pipeline
    plan: 02
    provides: proposal detail and decision APIs
provides:
  - proposal cards rendered inside AI answer cards
  - approve/cancel frontend API helpers and decision handling
  - sanitized route-persistent proposal card state
affects: [phase-11, ai-chat, ai-proposals, ai-history]
tech-stack:
  added: []
  patterns: [typed-proposal-card, sanitized-zustand-persistence, in-place-proposal-decision, bordered-answer-section]
key-files:
  created:
    - client/src/components/ai/AiProposalPanel.tsx
    - client/src/components/ai/AiProposalPreview.tsx
    - client/src/components/ai/AiProposalStatusBadge.tsx
  modified:
    - client/src/types/ai-chat.ts
    - client/src/api/aiChatApi.ts
    - client/src/constants/query-keys.ts
    - client/src/hooks/useAiChatExecution.ts
    - client/src/stores/useAiChatStore.ts
    - client/src/components/ai/AiAnswerCard.tsx
key-decisions:
  - "Proposal cards render as bordered sections inside the originating answer card, after Phase 10 answer sections."
  - "Approve/cancel sends only the proposal id and updates the original proposal card in place."
  - "Drawer persistence keeps only whitelisted proposal card fields and strips unrecognized nested data."
patterns-established:
  - "Frontend proposal state is normalized through the same sanitizer used for browser persistence."
  - "Proposal UI renders server-provided preview fields only; it does not compute authoritative diffs from hidden data."
requirements-completed: [AI-ACT-01, AI-APP-01, AI-APP-02, AI-APP-03, AI-AUD-02]
duration: 33min
completed: 2026-06-04
---

# Phase 11 Plan 04 Summary

**AI answers now show approval proposal cards with typed previews, proposal-id decisions, and sanitized persistent terminal state**

## Performance

- **Duration:** 33 min
- **Started:** 2026-06-04T05:06:00Z
- **Completed:** 2026-06-04T05:39:16Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added typed proposal card and decision models, proposal API helpers, and stable query keys.
- Added `AiProposalPanel`, `AiProposalPreview`, and `AiProposalStatusBadge`, rendered inside `AiAnswerCard` without nested card containers.
- Added approve/cancel decision handling that updates the original assistant message proposal in place.
- Extended chat persistence sanitization so terminal proposal cards survive route changes without storing raw or secret-shaped data.
- Added Korean/English proposal UI copy and unit coverage for API paths, card rendering, decision updates, and storage sanitization.

## Task Commits

1. **Tasks 1-3: Proposal frontend cards, decisions, and persistence** - `aeea343` (`feat(11-04)`)

## Files Created/Modified

- `client/src/components/ai/AiProposalPanel.tsx` - Proposal card container and approve/cancel controls.
- `client/src/components/ai/AiProposalPreview.tsx` - Server-provided fields, content, and warning preview renderer.
- `client/src/components/ai/AiProposalStatusBadge.tsx` - Localized proposal status badge with lucide status icons.
- `client/src/types/ai-chat.ts` - Proposal card, preview, status, risk, and decision response types.
- `client/src/api/aiChatApi.ts` - Proposal detail, approve, and cancel API helpers.
- `client/src/hooks/useAiChatExecution.ts` - Proposal normalization and decision controller.
- `client/src/stores/useAiChatStore.ts` - Proposal sanitizer and in-place proposal update reducer.
- `client/src/components/ai/AiAnswerCard.tsx` - Proposal panels rendered below existing answer sections.
- `client/src/i18n/locales/en/translation.json` and `client/src/i18n/locales/ko/translation.json` - Proposal UI labels.
- `client/test/unit/ai-chat-*.test.ts` - API, rendering, execution, and store regression coverage.

## Decisions Made

- Kept proposal rendering under the original AI answer instead of appending a separate assistant message, preserving conversation chronology.
- Used whitelisted proposal persistence rather than deny-list pruning so unknown future backend fields are dropped by default.
- Kept approval controls hidden unless the card is `PENDING`, executable, and attached to a known message id.

## Deviations from Plan

- The plan paths for locale files used `client/src/locales/...`; the actual project paths are `client/src/i18n/locales/...`.
- Added a production build check beyond the plan verification to catch typed i18next key issues before closeout.

**Total deviations:** 1 path correction and 1 extra verification step.  
**Impact on plan:** No scope change; both changes were required to integrate with the actual frontend structure safely.

## Issues Encountered

- `npm run build` initially failed because a dynamic i18n status key widened to `string`. The status badge now maps each `AiProposalStatus` to a literal translation call.
- `npm run lint` remains blocked by existing repo-wide lint/format issues in `.tmp-test`, e2e/tmp, and older source/test files. A targeted ESLint run over all 11-04 changed files passed.

## Verification

- `cd client && npm run test:unit -- ai-chat-response-cards ai-chat-store ai-chat-api ai-chat-execution` - passed; 404 tests passed, 0 failed.
- `cd client && npm run build` - passed.
- `cd client && npx eslint ...11-04 changed files...` - passed.
- `git diff --check` - passed.
- Raw-field scan over `client/src/types/ai-chat.ts`, `client/src/components/ai`, `client/src/stores/useAiChatStore.ts`, `client/src/hooks/useAiChatExecution.ts`, and `client/src/api/aiChatApi.ts` - clean.

## User Setup Required

None - no external service or dependency setup required.

## Next Phase Readiness

Plan 11-05 can add the project AI history tab using the backend history endpoint from Plan 11-03 and the frontend proposal state patterns from this plan.

## Self-Check: PASSED

---
*Phase: 11-approval-preview-audit-execution-pipeline*
*Completed: 2026-06-04*
