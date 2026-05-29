---
phase: "08"
review_round: 1
review_source_issue: RIS-195
reviewed_at: 2026-04-23T18:30:00+09:00
plans_reviewed:
  - .planning/phases/08-이슈-트래커/08-01-PLAN.md
docs_reviewed:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
  - .planning/phases/08-이슈-트래커/08-CONTEXT.md
  - .planning/phases/08-이슈-트래커/08-UI-SPEC.md
---

# Phase 08 Review Fold-In

This file records the manual Codex-equivalent plan review for Phase 8. The local GSD cross-AI review command path is not available in this runtime, so the review findings and resolutions are captured directly here and folded back into `08-01-PLAN.md`.

## Finding 1: UI contract is approved in-doc, but RIS-194 is still open

- `08-UI-SPEC.md` is marked `approved`, which is enough for planning.
- Paperclip still shows RIS-194 in progress, so execution could drift if that ticket reopens the UI contract late.

**Resolution**

- Treat `08-UI-SPEC.md` as the frozen planning input for RIS-195.
- If RIS-194 changes the approved UI contract before coding starts, rerun the Phase 8 execute plan instead of patching execution ad hoc.

## Finding 2: forward-only status can easily drift if dialog save and quick actions use different paths

- The UI contract requires both edit-dialog status changes and quick row/card progress actions.
- If those use separate validation logic, backward transitions can slip through one surface.

**Resolution**

- Require one shared backend transition validator.
- Require dialog status options to mirror the backend rule set instead of rendering all enum values.
- Keep create fixed to `REGISTERED`.

## Finding 3: filter/export parity is the highest-likelihood behavioral regression

- The core requirement is "export the current issue list".
- The list and Excel endpoints are separate, and frontend query building can drift if they do not share serialization.

**Resolution**

- One shared frontend serializer in `client/src/lib/issues-query.ts`.
- One shared backend filter parser/value object in `ProjectIssueService`.
- Unit coverage specifically compares list/export query serialization for default, status, priority, unassigned, and member filters.

## Finding 4: assignee validation and historical rendering need an explicit split

- The context doc says writes must allow only current team members.
- The UI spec also says existing assignees should still display if they later leave the team.

**Resolution**

- Reads always render the linked user from the issue row.
- Writes validate only current membership using the existing `TeamMemberRepository.existsByTeamAndUser(...)` pattern.
- No second "historical assignee directory" is introduced in v1.

## Finding 5: responsive density risk is real because this tab combines toolbar, filters, table, and export

- `DiagramsPage` currently widens only `gantt` and `staffing`.
- A dense issue table added to the narrow branch would regress usability immediately.

**Resolution**

- Add `issues` to the wide-layout branch.
- Keep local table overflow only on desktop/tablet.
- Use stacked cards on mobile and keep export/create visible near the top.

## Net Verdict

Proceed with `08-01-PLAN.md`.

No additional research pass is required before execution. The remaining risk is implementation discipline, not missing scope definition.
