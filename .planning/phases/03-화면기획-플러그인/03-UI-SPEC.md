---
phase: 3
slug: 화면기획-플러그인
status: verified
shadcn_initialized: true
preset: existing-smart-erd-operational
created: 2026-05-28
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for Phase 3 screen-spec closeout. The screen-spec editor already exists; execution must preserve this contract while adding E2E hooks, collaboration/lock UX evidence, export verification, and any minimal UI fixes required by QA.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | Existing Smart ERD operational workspace |
| Component library | Radix primitives through shadcn/ui (`Button`, `Select`, `DropdownMenu`, `Label`, `Input`, dialog/progress primitives where needed) |
| Icon library | `lucide-react` only |
| Font | `Pretendard`, `Noto Sans KR`, system sans fallback |

### Existing UI Surface

- Main shell: `ScreenDesignInteractivePage` + `ScreenDesignEditorShell`
- Left pane: `ScreenDesignLibrary`
- Center pane: `ScreenDesignCanvas` rendered with Konva
- Right pane: `ScreenDesignInspector`
- Export overlay: shared `ExportProgressDialog`
- Status announcement: `sr-only` live region in `ScreenDesignInteractivePage`

### Layout Contract

- Keep the screen-spec editor as a dense operational workspace, not a marketing page.
- Preserve the full-height editor model: `h-screen`, fixed `Header`, `main` flex fill, and non-scrolling canvas area.
- Preserve the current three-zone layout:
  - toolbar/header band on top of the editor
  - 220px library pane on large screens
  - flexible canvas center
  - 280px inspector pane on extra-large screens
- Do not introduce nested cards inside the existing `surface-operational` panels.
- For mobile/tablet widths, preserve the current responsive stacking order rather than inventing a separate simplified mobile editor.

---

## Spacing Scale

Declared values must stay aligned to Tailwind's 4px grid.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, compact button icon spacing, inline glyph gaps |
| sm | 8px | Button groups, toolbar control gaps, library row internals |
| md | 16px | Panel padding (`px-4 py-4`), form field groups, canvas header padding |
| lg | 24px | Workspace padding on md+ (`p-6`), major pane separations |
| xl | 32px | Reserved for larger document-hub spacing only; avoid inside editor tool surfaces |
| 2xl | 48px | Not used inside screen-spec editor |
| 3xl | 64px | Not used inside screen-spec editor |

Exceptions:

- Canvas minimum height remains `min-h-[520px]` to keep the Konva frame usable.
- Library pane minimum height remains `min-h-[220px]`.
- Icon buttons remain stable at `h-9 w-9` or `h-8 w-8` depending on density.
- Screen-spec side widths remain `220px` and `280px` unless a concrete overflow bug requires adjustment.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400/500 | 1.5 |
| Label | 11px-12px | 600 | 1.25 |
| Heading | 14px-16px | 600/700 | 1.35 |
| Display | Not applicable inside editor | Not applicable | Not applicable |

Typography rules:

- Do not use hero-scale type inside the editor.
- Keep toolbar labels as compact uppercase text with existing tracking.
- Keep panel body copy short and scannable.
- Do not add negative letter spacing beyond existing global heading styles.
- Avoid long explanatory text in the app; put testing instructions in docs/E2E, not UI copy.

---

## Color

Screen-spec UI must use semantic Tailwind tokens and existing CSS custom properties. Do not hardcode hex colors in React components.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `hsl(var(--background))`, `hsl(var(--screen-spec-canvas-background))` | App background, canvas field, editor workspace |
| Secondary (30%) | `hsl(var(--card))`, `hsl(var(--secondary))`, `surface-operational` | Toolbar band, side panes, controls, inspector surfaces |
| Accent (10%) | `hsl(var(--primary))`, `hsl(var(--screen-spec-selection))`, screen-spec category tokens | Selection outline, focus rings, selected screen state, export progress emphasis |
| Destructive | `hsl(var(--destructive))` | Delete screen, delete master, delete selected instance only |

Accent reserved for:

- selected screen border/background
- selected instance transformer border/anchors
- focus-visible rings
- primary status/progress emphasis
- screen-spec category preview swatches

Status colors:

- Collaboration ready: existing `screenSpec.status.ready` text plus semantic connected/success token if a visible indicator is added.
- Collaboration connecting/error: use `muted-foreground` for connecting and destructive/warning token for actual failure.
- Orphaned instance state: use `composition-warning-*` and `--screen-spec-orphan`, as already implemented.
- Scope lock/conflict state: use warning tokens, not destructive, unless the user's edit is blocked permanently.

Theme contract:

- Paper, Graphite, and Midnight must all define the complete `--screen-spec-*` token set.
- Any new screen-spec visual state must be added as a semantic CSS variable or mapped to an existing semantic token.
- No one-off palette should dominate the screen; the editor must remain neutral and operational.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `새 마스터`, `추가`, `내보내기` depending on context |
| Empty state heading | `마스터를 이곳으로 드래그해 화면을 시작하세요` |
| Empty state body | Keep existing helper copy: `마스터를 현재 화면 위로 드래그해 배치하세요` |
| Error state | `화면기획 문서를 불러오지 못했습니다. 다시 시도해 주세요.` |
| Destructive confirmation | If a confirmation is added: `삭제: 이 작업은 현재 화면기획 문서에서 선택한 항목을 제거합니다.` |

Copy rules:

- Korean is the primary UI language; English translations must stay equivalent.
- Commands should use short verb+noun labels.
- Avoid tutorial prose inside the editor. Use labels, status, and concise empty states.
- Collaboration failure copy must distinguish:
  - connecting/retrying
  - remote user changed a scope
  - current edit is locked or rejected
- Export progress must preserve step language: 준비, 렌더링, 마무리, 저장.

---

## Interaction Contract

### Screen List

- Add screen button remains in the library pane header.
- Screen cards show name, frame size, and instance count.
- Screen move/delete controls remain icon buttons with accessible labels.
- Screen rename remains in the inspector via `screen-spec-screen-name`.

### Library and Master Components

- Library items remain draggable buttons grouped by category.
- Existing category labels and built-in master names remain the source of truth.
- If custom master create/rename/delete UI is touched, use shadcn dialogs and existing `screenSpec.library.dialog.*` copy.
- Do not replace drag placement with a modal-only workflow.

### Canvas

- Canvas keeps pan by drag and zoom by wheel.
- Instance selection remains visualized through Konva `Transformer`.
- Instance move/resize must not cause layout shift outside the canvas.
- If E2E needs stable selectors, add minimal `data-testid` values to wrapper elements only; do not change visual styling solely for tests.

### Inspector

- Inspector remains property-focused:
  - selected screen name/frame/size/status
  - selected instance position/size/master default
  - label, color, size overrides
  - layer controls
  - delete selection
- Override status text must remain visible and specific.
- Orphan rebind UI must continue using warning styling and a Select control.

### Collaboration UX

Phase 3 verification is UX-strict. The UI must expose enough state for a user and E2E to understand collaboration behavior.

Required states:

- connecting
- ready
- remote change observed
- same-scope lock/conflict or rejected edit

If the existing shared collaboration shell already renders lock/conflict state, screen-spec E2E must assert it. If it does not, add the smallest visible screen-spec status affordance in the toolbar or inspector:

- one compact status pill
- warning tone for locked/conflict
- accessible text that identifies the affected scope when practical
- no toast-only signal for lock/conflict pass/fail

### Export UX

- Export remains a dropdown from the toolbar.
- PNG applies to the selected screen.
- PDF applies to all screens.
- While export is in flight, disable export controls and show progress through `ExportProgressDialog`.
- Export failure must show retry-oriented copy and must not leave the editor in a busy state.

---

## Accessibility Contract

- Keep the live region in `ScreenDesignInteractivePage` for connection, selection, and remote-sync announcements.
- All icon-only buttons must have `aria-label`.
- Inputs must have visible labels or explicit aria labels.
- Dropdown triggers and select controls must remain keyboard reachable.
- Canvas-only actions need equivalent inspector or keyboard support where already present.
- Test-only selectors must not replace accessible roles/names in E2E assertions when role/name locators are practical.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `Button`, `Input`, `Label`, `Select`, `DropdownMenu`, dialog/progress primitives already in repo | not required |
| Third-party registry | none | shadcn view + diff required before use |

Rules:

- Do not add a new component registry for Phase 3 closeout.
- Do not add a new icon library.
- Do not add a design system abstraction unless a real duplication or accessibility issue appears during implementation.

---

## Implementation Constraints for Planner

- Treat UI work as closeout hardening, not a redesign.
- Plans may add stable E2E hooks if needed, but must not regress visual density or keyboard accessibility.
- Plans must explicitly call out any missing lock/conflict indicator as a blocking SPEC-03 issue.
- Plans must preserve screen-spec semantic tokens across Paper, Graphite, and Midnight.
- Plans must keep export UX observable through Playwright downloads and progress/failure states.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-28

