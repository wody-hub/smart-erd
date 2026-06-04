---
phase: 12
slug: low-risk-write-tools-mvp
status: approved
shadcn_initialized: false
preset: manual-shadcn-compatible
created: 2026-06-04
---

# Phase 12 — UI Design Contract

> Visual and interaction contract for low-risk AI write execution. This phase reuses the Phase 11 proposal cards and project AI history tab; it does not introduce a new modal-first execution surface.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Manual shadcn-compatible primitives. Do not initialize `components.json` or install registry blocks. |
| Preset | Not applicable. Reuse project tokens from `client/src/index.css` and `client/tailwind.config.js`. |
| Component library | Existing `client/src/components/ui/*` primitives: `Button`, `Badge`, `Tooltip`, table/list primitives, `Spinner`, and `sonner` toast. |
| Icon library | `lucide-react` only. Use existing proposal icons; add no custom SVG. |
| Font | `Pretendard` for user-facing copy. `IBM Plex Mono` only for action type, proposal id, execution id, resource id, and timestamps. |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, status dot gaps, compact metadata pairs |
| sm | 8px | Button icon/text gap, badge groups, metadata row gaps |
| md | 16px | Proposal panel section spacing, result summary spacing |
| lg | 24px | Answer-to-proposal separation, history panel groups |
| xl | 32px | Empty/error history state groups |
| 2xl | 48px | Full history empty/error vertical padding |
| 3xl | 64px | Page-level layout only; do not use inside proposal cards |

Exceptions:
- Proposal controls keep at least a 44px touch target on mobile.
- Proposal panels must remain bordered `<section>` elements inside `AiAnswerCard`; do not place a `Card` inside a `Card`.
- History table may keep horizontal scrolling for dense audit metadata, but visible columns must not wrap buttons or controls into incoherent stacks.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.3 |
| Heading | 20px | 600 | 1.2 |
| Display | 24px | 600 | 1.15 |

Usage:
- Body: proposal summaries, execution result summaries, failure explanations.
- Label: status/risk badges, target labels, field labels, history table headers.
- Heading: AI history title and proposal group headings only.
- Mono: `proposalId`, `executionId`, `actionType`, created/updated resource ids, exact timestamp strings.
- No viewport-scaled type and no negative letter spacing.

---

## Color

Use semantic Tailwind tokens only. Do not use hardcoded `bg-gray-*`, `text-blue-*`, `bg-emerald-*`, raw hex values, or inline HSL strings in Phase 12 AI proposal/history UI.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-background`, `text-foreground` | App backdrop, AI drawer transcript background, project history tab background |
| Secondary (30%) | `bg-card`, `bg-secondary`, `bg-surface-muted`, `border-border` | Answer cards, proposal panels, preview rows, history rows |
| Accent (10%) | `bg-primary`, `text-primary`, `ring-ring`, `border-primary/35` | Pending executable approval button, focus ring, selected filter/link only |
| Success | `bg-success/10`, `text-success`, `border-success/35` | Executed proposal state and safe created/updated result metadata |
| Warning | `text-erd-warning`, `border-erd-warning/40`, `bg-secondary` | Pending, stale, unsupported, invalid-but-non-mutated explanations |
| Destructive | `text-destructive`, `border-destructive/35`, `bg-destructive/5` | Rejected/failed proposal state and error text. Do not use for delete actions because delete remains out of scope. |

Accent reserved for: pending executable approve CTA, focus rings, and links opening affected Smart-ERD resources. Terminal result colors must communicate status, not decoration.

---

## Copywriting Contract

All user-facing copy must be in `client/src/i18n/locales/{ko,en}/translation.json`. Korean is the primary product copy.

| Element | Korean Copy | English Copy |
|---------|-------------|--------------|
| Approval CTA | `승인 후 실행` | `Approve and execute` |
| Executed status | `실행 완료` | `Executed` |
| Failed status | `실행 실패` | `Failed` |
| Rejected status | `거절됨` | `Rejected` |
| Result heading | `실행 결과` | `Execution result` |
| Issue created summary | `이슈가 생성되었습니다.` | `Issue created.` |
| Issue updated summary | `이슈가 수정되었습니다.` | `Issue updated.` |
| TODO created summary | `TODO가 생성되었습니다.` | `TODO created.` |
| TODO updated summary | `TODO가 수정되었습니다.` | `TODO updated.` |
| WBS comment summary | `WBS 댓글이 추가되었습니다.` | `WBS comment added.` |
| WBS memo summary | `WBS 작업 메모가 추가되었습니다.` | `WBS work memo added.` |
| Unsupported helper | `이 작업 유형은 아직 실행기로 등록되지 않았습니다. 프로젝트 데이터는 변경되지 않습니다.` | `This action type does not have a registered executor yet. Project data will not change.` |
| Validation failure helper | `검증을 통과하지 못해 실행하지 않았습니다. 프로젝트 데이터는 변경되지 않았습니다.` | `Validation failed, so the action was not executed. Project data did not change.` |
| Stale helper | `현재 데이터가 제안 생성 시점과 달라졌습니다. 새 질문으로 제안을 다시 생성하세요.` | `Current data changed since the proposal was created. Ask again to create a fresh proposal.` |

Copy rules:
- Always state whether project data changed.
- Use `실행` only after approval and successful server execution.
- Failure/rejection copy must say data did not change when that is true.
- Do not mention raw payload, provider output, prompt, read context, stdout/stderr, token, cookie, stack trace, or environment values.

---

## Phase 12 Interaction Contract

### Proposal Approval

- Pending executable proposals still render inside the originating assistant answer.
- Approve/cancel acts on one proposal at a time and sends only `proposalId`.
- While one proposal is pending approval execution, disable controls only for that proposal.
- On success, update the same proposal card in place to `EXECUTED` and show compact result metadata.
- On validation failure, stale target, unauthorized target, unsupported action, or executor error, keep the card visible and show the terminal `REJECTED` or `FAILED` state with a safe reason.
- Do not append a new assistant message for execution results unless the backend later returns a new answer contract.

### Result Metadata

Each executed card may show:

- A localized result heading.
- Action type in mono text.
- Created/updated resource id in mono text when available.
- Target label.
- Safe summary from executor result.

Each failed/rejected card may show:

- A localized safe failure heading.
- Redacted error title/detail only.
- A clear statement that project data did not change when no mutation occurred.

### Project AI History

- `ProjectAiHistoryTab` remains read-only.
- Rows show executed/rejected/failed status, action type, risk, target label, requester, decision actor, timestamps, execution/proposal ids, and sanitized result/error summary.
- History must not expose approve/cancel controls.
- History must not expose raw payload JSON, provider output, prompts, read context, stack traces, token/cookie/password/env fields, or browser-hidden fields.

### Query Refresh

- After an executed proposal, refetch AI proposal/history queries.
- If executor result identifies an affected domain, invalidate the matching project query family:
  - issues after `issue.create` / `issue.update`
  - TODOs after `todo.create` / `todo.update`
  - WBS history/comments after `wbs.comment.add` / `wbs.memo.add`
- Do not perform optimistic project-data updates from the AI card; server result is authoritative.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not approved |

No third-party registry blocks are approved for Phase 12.

---

## Accessibility Contract

- Each proposal panel keeps a title-specific `aria-label`.
- Status changes use `aria-live="polite"` inside the proposal panel when feasible.
- Approve/cancel buttons have visible text.
- Disabled or unsupported controls must have explanatory helper text; color alone is insufficient.
- Failure states use text plus icon/status badge, not color alone.
- Keyboard order remains: answer sections, proposal controls, next proposal controls, then next message.
- History rows are static unless future details expansion is implemented; do not add focusable rows without an action.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-04
