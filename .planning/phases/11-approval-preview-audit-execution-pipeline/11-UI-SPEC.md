---
phase: 11
slug: approval-preview-audit-execution-pipeline
status: approved
shadcn_initialized: false
preset: manual-shadcn-compatible
created: 2026-06-04
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the approval preview and audit execution pipeline. This extends the Phase 10 global AI drawer without weakening its read-grounding, privacy, or local persistence guarantees.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Manual shadcn-compatible primitives. Do not initialize `components.json` or install registry blocks in this phase. |
| Preset | Not applicable. Reuse project tokens from `client/src/index.css` and `client/tailwind.config.js`. |
| Component library | Existing `client/src/components/ui/*` primitives built on Radix UI. Use `Button`, `Badge`, `Card`, `Dialog`, `Tooltip`, `Tabs`, and table/list primitives already present in the codebase. |
| Icon library | `lucide-react` only. Use `ShieldCheck`, `FileDiff`, `CheckCircle2`, `XCircle`, `Ban`, `Clock3`, `AlertTriangle`, `History`, `RefreshCcw`, `Loader2`, and `Eye` where applicable. |
| Font | `Pretendard` for all AI proposal/history UI text. `IBM Plex Mono` only for proposal IDs, execution IDs, action type codes, and timestamps. Do not use `Noto Serif KR` inside the AI drawer or AI history panels. |

Source: Phase 10 UI-SPEC, `README.md`, `client/src/index.css`, `client/tailwind.config.js`, `client/src/components/ai/*`, `client/src/components/ui/*`, and Phase 11 CONTEXT/RESEARCH.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, status dot gaps, compact metadata pairs |
| sm | 8px | Proposal field row gaps, button icon/text gaps, badge groups |
| md | 16px | Proposal section padding, preview/diff group spacing, history row inner padding |
| lg | 24px | Answer-to-proposal separation, drawer transcript vertical rhythm, history panel section gaps |
| xl | 32px | Project AI history top-level groups and empty states |
| 2xl | 48px | Full history empty/error state vertical padding |
| 3xl | 64px | Reserved for page-level layout only; do not use inside AI cards or dense history rows |

Exceptions:
- AI drawer width remains the Phase 10 value: desktop `min(520px, 100vw)`, mobile `100vw`.
- Proposal approval controls must preserve a minimum 44px touch target on mobile.
- Field-level diff rows may use a two-column desktop layout only when each column has at least 180px; otherwise stack before/after values vertically.
- Proposal content panels may use `rounded-md` or `rounded-lg` according to existing primitives, but must not exceed existing radius tokens.
- If proposal panels render inside `AiAnswerCard`, do not use the `Card` component inside the answer card. Use a bordered `<section>` panel to avoid nested cards while still presenting the proposal as an approval card.

---

## Typography

Use exactly these sizes for Phase 11 AI proposal and history UI. Do not introduce viewport-scaled type or negative letter spacing.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.3 |
| Heading | 20px | 600 | 1.2 |
| Display | 24px | 600 | 1.15 |

Usage:
- Body: proposal summary, preview values, history details, error explanations.
- Label: field labels, target labels, risk/status badges, timestamps, action type labels.
- Heading: drawer title, project AI history title, proposal group heading.
- Display: only empty-state headline text in full project history surfaces; never for repeated proposal rows/cards.
- Mono: `proposalId`, `executionId`, `actionType`, and exact timestamp strings.

---

## Color

Use semantic Tailwind tokens only. Do not use hardcoded palette utilities such as `bg-gray-*`, `text-blue-*`, `bg-emerald-*`, raw hex values, or inline HSL strings.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-background`, `text-foreground` | App backdrop, drawer transcript background, project history page background |
| Secondary (30%) | `bg-card`, `bg-secondary`, `bg-surface-muted`, `border-border` | Answer cards, proposal panels, preview rows, history rows, filters |
| Accent (10%) | `bg-primary`, `text-primary`, `ring-ring`, `border-primary/35` | Focus rings, active proposal group heading accent, primary approve button only when executable and pending |
| Success | `bg-success`, `text-success`, `border-success/35` | Executed proposal status, successful approval result, non-destructive completion indicators |
| Warning | `text-erd-warning`, `border-erd-warning/40`, `bg-secondary` | Pending/expiring proposal warning, unsupported action warning, stale-state notices |
| Destructive | `bg-destructive`, `text-destructive`, `border-destructive/35` | Cancel action emphasis, rejected/failed proposal status, blocked destructive action notices |

Accent reserved for: executable pending proposal primary approve button, focus ring, selected history filter, and links opening referenced Smart-ERD resources. Risk/status colors must be status-specific, not decorative.

Risk tones:
- `LOW`: neutral outline badge with `border-border/80 bg-card/80 text-foreground`.
- `MEDIUM`: warning outline badge with `border-erd-warning/40 text-erd-warning`.
- Unsupported/non-executable: muted warning badge, not primary.
- Rejected/failed: destructive outline badge, not filled destructive unless used in an alert row.

---

## Copywriting Contract

All user-facing prose must be stored in `client/src/i18n/locales/{ko,en}/translation.json`. Korean is the primary product copy. Use `aiChat.proposals.*` for drawer proposal copy and `aiHistory.*` for project history copy.

| Element | Copy |
|---------|------|
| Proposal group heading | `실행 제안` |
| Proposal group description | `승인 전에는 프로젝트 데이터가 변경되지 않습니다.` |
| Proposal primary CTA | `승인 후 실행` |
| Proposal cancel CTA | `취소` |
| Non-executable CTA label | `실행 불가` |
| Preview heading | `미리보기` |
| Diff heading | `변경 내용` |
| Target label | `대상` |
| Risk label | `위험도` |
| Expires label | `만료 예정` |
| Pending status | `승인 대기` |
| Executed status | `실행 완료` |
| Cancelled status | `취소됨` |
| Expired status | `만료됨` |
| Rejected status | `거절됨` |
| Failed status | `실행 실패` |
| Unsupported status | `지원되지 않는 작업` |
| Pending helper | `검토 후 승인하거나 취소하세요.` |
| Unsupported helper | `이 작업 유형은 아직 실행기로 등록되지 않았습니다. 프로젝트 데이터는 변경되지 않습니다.` |
| Stale helper | `현재 데이터가 제안 생성 시점과 달라졌습니다. 새 질문으로 제안을 다시 생성하세요.` |
| Approval loading | `승인을 처리하는 중입니다.` |
| Cancel loading | `취소하는 중입니다.` |
| Approval success toast | `AI 제안이 처리되었습니다.` |
| Approval failed toast | `AI 제안을 처리하지 못했습니다. 상태를 새로고친 뒤 다시 시도하세요.` |
| Cancel success toast | `AI 제안을 취소했습니다.` |
| Project history tab label | `AI 이력` |
| Project history title | `AI 실행 이력` |
| Project history empty heading | `아직 AI 실행 이력이 없습니다` |
| Project history empty body | `AI에게 프로젝트 질문을 보내거나 실행 제안을 생성하면 이곳에 감사 가능한 이력이 표시됩니다.` |
| Project history error | `AI 이력을 불러오지 못했습니다. 프로젝트 접근 권한과 네트워크 상태를 확인한 뒤 다시 시도하세요.` |

Copy tone:
- 결론 먼저, 실행 여부와 데이터 변경 여부를 명확히 쓴다.
- "승인"은 실제 mutation 가능성을 암시하므로, pending/executable 상태에서만 primary CTA에 사용한다.
- Unsupported, rejected, failed 상태는 사용자가 안전하게 이해하도록 "프로젝트 데이터는 변경되지 않았습니다" 메시지를 포함한다.
- Raw provider, payload, prompt, context, stdout/stderr 같은 구현 용어는 사용자-facing copy에 쓰지 않는다.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required; no registry install in this phase |
| third-party | none | not approved |

No third-party registry blocks are approved for Phase 11. If a planner/executor introduces any registry block later, it must run `npx shadcn view {block} --registry {registry_url}` and record the safety result before implementation.

---

## Phase 11 Interaction Contract

### Proposal Placement

- Action proposals first appear inside the originating assistant answer, directly under the answer content that produced them.
- Preserve the Phase 10 answer order: conclusion, source chips, confirmed facts, interpretation, needs-confirmation. Proposal panels are an additional section after these answer sections unless the response has no factual answer, in which case show source chips then proposals.
- Multiple proposals render as separate approval panels, each with independent approve/cancel controls.
- Proposal panels remain visible after terminal states and update in place in the original chat message.
- Do not create a global proposal queue as the first-view surface in Phase 11.

### Proposal Panel Anatomy

Each proposal panel must show:

1. Status/risk row: status badge, risk badge, optional expires-at label.
2. Title and summary.
3. Target row: target type, target label, and project label when available.
4. Preview/diff section:
   - update: field-level before/after rows from server preview.
   - create: proposed/defaulted values and target location.
   - comment/memo: exact content and target path.
5. Warning/help text when unsupported, stale, expired, rejected, or failed.
6. Controls:
   - pending + executable: `승인 후 실행` and `취소`.
   - pending + non-executable: disabled `실행 불가` and enabled `취소`.
   - terminal: no mutation controls; show refresh/detail action only if backed by API.

Do not render raw JSON, raw payload keys, prompt text, read context, provider stdout/stderr, stack traces, tokens, cookies, or environment values.

### Approve/Cancel Behavior

- Approve/cancel actions call server endpoints using `proposalId`; browser state must never decide whether a mutation is valid.
- While a proposal mutation is pending, disable controls only for that proposal, not every proposal in the answer.
- On success, update the proposal card in the existing assistant message response in place.
- On terminal-state response to repeated approve/cancel, render the returned terminal state without showing duplicate success wording.
- On stale/rejected/failed response, keep the panel visible and show the safe server-provided reason.
- Toasts are supplementary; the proposal panel itself must show the final state.

### Project AI History Surface

- Add a read-only project-context AI history surface as a Project Hub tab named `AI 이력`, or as a project hub panel if the planner determines tab-order migration risk is too high. The preferred option is a tab because Phase 11 requires project-visible history.
- The surface lists recent AI executions/proposals/decisions for the current project only.
- Rows show: timestamp, provider, prompt version, execution/proposal status, action type, risk, target label, requester, decision actor, and a sanitized result/error summary.
- Details may expand inline or open a lightweight dialog, but details must remain sanitized and must not show raw prompt/context/payload.
- Personal TODO proposal detail follows the privacy rule: visible only to owner/requester unless intentionally linked into project-visible WBS context.
- History filters may include status and action type. Do not add broad all-team/all-project history browsing in Phase 11.

---

## Component Inventory

Reuse:
- `AiAnswerCard` as the originating answer surface.
- `AiSourceChips` unchanged.
- `Button` for approve, cancel, refresh, retry, and history filter controls.
- `Badge` for status, risk, target type, and provider labels.
- `Tooltip` for icon-only refresh/detail controls.
- `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` for project AI history if implemented as a Project Hub tab.
- `WorkspaceEmptyState` for empty/error history states.
- `Spinner` or `Loader2` for per-proposal loading states.
- `sonner` toast for mutation feedback.

Add:
- `client/src/components/ai/AiProposalPanel.tsx` — bordered proposal panel rendered inside the answer without using nested `Card`.
- `client/src/components/ai/AiProposalPreview.tsx` — field/content preview renderer for server-generated preview data.
- `client/src/components/ai/AiProposalStatusBadge.tsx` — status/risk presentation helper.
- `client/src/components/ai/AiHistoryTab.tsx` or equivalent project-context history surface.
- `client/src/api/aiProposalApi.ts` or extend `client/src/api/aiChatApi.ts` with typed proposal/history functions.
- `client/src/hooks/useAiProposalActions.ts` for approve/cancel mutations and message-state updates.
- Type additions under `client/src/types/ai-chat.ts` for sanitized proposal card, preview, and history response models.
- Query keys under `queryKeys.aiChat` or a new `queryKeys.aiProposals` namespace.

Avoid:
- Nested `Card` components inside `AiAnswerCard`.
- Modal-first proposal review for the initial proposal surface.
- Global destructive UI affordances for AI proposals.
- Any browser-local raw provider payload persistence.

---

## API and State Contract

- Frontend calls Spring HTTP APIs through typed API modules only. Components must not call `axiosInstance` directly.
- Extend `AiChatResponse` with `proposals: AiActionProposalCard[]`.
- `AiActionProposalCard` must contain only sanitized fields: `proposalId`, `status`, `executable`, `actionType`, `riskLevel`, `title`, `summary`, `target`, `preview`, `warnings`, `expiresAt`, and redacted error/result summary.
- `preview` must be server-generated and typed. The frontend may format values but must not compute authoritative diffs from raw payload.
- `useAiChatStore` sanitizer must whitelist proposal card fields and drop unknown nested keys.
- Local storage may keep rendered proposal card state, but not raw payload, prompt, read context, stdout/stderr, or API error stack traces.
- Approve/cancel mutations update the matching proposal inside the existing assistant message; they do not append a new assistant message unless the backend explicitly returns a new user-facing answer.
- Project AI history uses React Query and invalidates/refetches after approve/cancel.
- Query invalidation after executed proposals should include project-specific affected domains only when the server result identifies them. Until Phase 12 concrete executors exist, history/proposal queries are the required invalidation targets.

---

## Accessibility Contract

- Each proposal panel uses `<section>` with an accessible label such as `실행 제안: {title}`.
- Status changes use `aria-live="polite"` inside the panel.
- Approve/cancel buttons have visible text; if icon-only refresh/detail controls are added, they require `aria-label` and `Tooltip`.
- Disabled non-executable controls must include explanatory helper text, not color-only state.
- Field-level diffs must be readable by text: labels `이전`, `변경 후`, `추가`, `기본값` are required where applicable.
- Rejected/failed proposal panels use alert semantics only when newly updated from a user action; historical terminal rows in project AI history use normal read-only semantics.
- Keyboard order inside an answer: answer sections, proposal 1 controls, proposal 2 controls, then next message.
- History tab rows are keyboard-focusable only when they open details; otherwise use normal static row markup.

---

## Visual QA Checklist

- [ ] Proposal panels appear inside the originating assistant answer and below the existing answer sections.
- [ ] Two or more proposals have independent loading and terminal states.
- [ ] Pending, cancelled, expired, rejected, executed, and failed statuses are visually distinct without relying only on color.
- [ ] Long target labels, field values, and comment content wrap without overflowing the 520px drawer.
- [ ] Mobile drawer keeps approve/cancel controls reachable with 44px touch targets.
- [ ] No raw JSON, payload keys, prompt/context text, stdout/stderr, tokens, cookies, or stack traces are visible.
- [ ] Project AI history empty, loading, error, and populated states fit the existing Project Hub layout.
- [ ] Color usage is semantic-token only and preserves Phase 10 palette restraint.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — Korean primary copy is concrete about approval, cancellation, non-executable state, and data safety.
- [x] Dimension 2 Visuals: PASS — proposal panels and history surface reuse the existing AI drawer/project hub patterns without nested cards.
- [x] Dimension 3 Color: PASS — semantic tokens only, with explicit accent/success/warning/destructive usage.
- [x] Dimension 4 Typography: PASS — Phase 10 typography scale is preserved and scoped to proposal/history use.
- [x] Dimension 5 Spacing: PASS — spacing scale remains multiples of 4 with drawer/mobile exceptions documented.
- [x] Dimension 6 Registry Safety: PASS — no registry blocks or third-party UI dependencies approved.

**Approval:** approved 2026-06-04
