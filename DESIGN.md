# Design System — Smart ERD

## Product Context
- **What this is:** Smart ERD is a collaborative web app for schema design. Teams create ERD documents, connect FK relationships visually, and standardize names and types through a shared dictionary before the database turns into folklore.
- **Who it's for:** Backend engineers, solution architects, data modelers, PM/BA roles who need to review schema decisions, and delivery teams that need shared naming standards.
- **Space/industry:** Data modeling, schema design, technical documentation, collaborative internal tooling.
- **Project type:** Web app, collaborative workspace, document platform around an ERD editor.

## Aesthetic Direction
- **Direction:** Technical Editorial
- **Decoration level:** Intentional
- **Mood:** The product should feel like a well-edited systems manual, not a gray admin panel. Calm, precise, credible, with a little voltage in the accents so the workspace feels alive.
- **Reference sites:** Research was skipped for this pass. Direction is based on the current product flow, existing screens, and the gap between the cleaned-up IA and the still-generic visual layer.

## Typography
- **Display/Hero:** `Noto Serif KR` — use for page titles, section hero headlines, and moments where the product needs editorial weight. This is where the “document platform” identity shows up.
- **Body:** `IBM Plex Sans KR` — use for paragraphs, labels, tabs, and dense UI text. It reads technical without feeling cold.
- **UI/Labels:** `IBM Plex Sans KR` — same family as body for consistency. Weight changes do the work, not font changes.
- **Data/Tables:** `IBM Plex Sans KR` with `font-variant-numeric: tabular-nums;` — readable for mixed Korean and English data, less jarring than switching full tables to mono.
- **Code:** `IBM Plex Mono` — use only for DDL, code, IDs, and machine-facing fields.
- **Loading:** Google Fonts
  - `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@500;600;700&display=swap`
- **Scale:**
  - Display XL: `3.75rem / 60px`, `line-height: 1.02`, hero only
  - Display L: `3rem / 48px`, page mastheads
  - H1: `2.25rem / 36px`
  - H2: `1.75rem / 28px`
  - H3: `1.375rem / 22px`
  - Body L: `1.0625rem / 17px`
  - Body M: `0.9375rem / 15px`
  - Body S: `0.8125rem / 13px`
  - Micro: `0.75rem / 12px`, uppercase metadata only

## Color
- **Approach:** Balanced. The base is warm and quiet, the accents are crisp and technical.
- **Primary:** `#2457FF` — product energy, primary CTA, active states, key links. This is the “we actually build software” color.
- **Secondary brand:** `#0F8A73` — shared knowledge, dictionary, valid states, calm supporting emphasis.
- **Warm accent brand:** `#C98B1E` — document framing, highlights, warning-adjacent emphasis, editorial warmth.
- **Neutrals:**
  - `#F6F1E8` app background, paper tone
  - `#FFFAF3` primary surface
  - `#F0E7D9` elevated muted surface
  - `#E8DCC8` stronger surface band, cover treatments, segmented utility rows
  - `#D8CEBE` borders, separators
  - `#70685C` muted text
  - `#364152` secondary text
  - `#0E1726` primary ink
- **Semantic:**
  - success `#157A63`
  - warning `#B77912`
  - error `#C84C3A`
  - info `#2457FF`
- **Editor semantics:**
  - default table header `#2457FF`
  - supporting table header `#0F8A73`
  - attention table header `#C98B1E`
  - PK marker `#C98B1E`
  - FK marker `#2457FF`
  - NN marker `#0F8A73`
  - AI marker `#C65D2E`
  - validation matched `#157A63`
  - validation mismatch `#B77912`
  - validation unregistered `#C84C3A`
  - collaboration connected `#157A63`
  - collaboration connecting `#2457FF`
  - collaboration disconnected `#C84C3A`
- **Dark mode:** Keep the midnight shell. Use `#0A1020` background, `#11192B` surface, `#182236` muted surface, `#22314D` strong surface, `#2E3C55` border, `#EEF3FF` foreground, `#C0CADC` muted foreground, `#5B84FF` primary, `#38A58F` secondary, `#D8A54D` warm accent, `#DE6F62` danger. Reduce accent saturation by roughly 12%, keep contrast high, never invert into neon.
- **Suggested CSS tokens:**
  - `--background: #F6F1E8`
  - `--surface: #FFFAF3`
  - `--surface-muted: #F0E7D9`
  - `--surface-strong: #E8DCC8`
  - `--foreground: #0E1726`
  - `--foreground-muted: #70685C`
  - `--line: #D8CEBE`
  - `--primary: #2457FF`
  - `--primary-foreground: #FFFFFF`
  - `--secondary: #F0E7D9`
  - `--secondary-foreground: #0E1726`
  - `--accent: #F0E7D9`
  - `--accent-foreground: #0E1726`
  - `--brand-secondary: #0F8A73`
  - `--accent-warm: #C98B1E`
  - `--danger: #C84C3A`
  - `--danger-foreground: #FFFFFF`
  - `--primary-soft: rgba(36, 87, 255, 0.10)`
  - `--secondary-soft: rgba(15, 138, 115, 0.12)`
  - `--accent-warm-soft: rgba(201, 139, 30, 0.12)`
  - `--shadow-soft: 0 16px 40px rgba(35, 36, 43, 0.08)`
  - `--shadow-strong: 0 20px 48px rgba(0, 0, 0, 0.28)`
  - `--background-dark: #0A1020`
  - `--surface-dark: #11192B`
  - `--surface-muted-dark: #182236`
  - `--surface-strong-dark: #22314D`
  - `--foreground-dark: #EEF3FF`
  - `--foreground-muted-dark: #C0CADC`
  - `--line-dark: #2E3C55`
  - `--primary-dark: #5B84FF`
  - `--primary-foreground-dark: #FFFFFF`
  - `--secondary-dark: #182236`
  - `--secondary-foreground-dark: #EEF3FF`
  - `--accent-dark: #182236`
  - `--accent-foreground-dark: #EEF3FF`
  - `--brand-secondary-dark: #38A58F`
  - `--accent-warm-dark: #D8A54D`
  - `--danger-dark: #DE6F62`
  - `--danger-foreground-dark: #FFFFFF`
  - `--editor-table-primary: #2457FF`
  - `--editor-table-secondary: #0F8A73`
  - `--editor-table-attention: #C98B1E`
  - `--editor-pk: #C98B1E`
  - `--editor-fk: #2457FF`
  - `--editor-nn: #0F8A73`
  - `--editor-ai: #C65D2E`
  - `--editor-domain: #0F8A73`
  - `--editor-domain-foreground: #FFFFFF`
  - `--validation-matched: #157A63`
  - `--validation-mismatch: #B77912`
  - `--validation-unregistered: #C84C3A`
  - `--validation-unchecked: #70685C`
  - `--status-connected: #157A63`
  - `--status-connecting: #2457FF`
  - `--status-disconnected: #C84C3A`
  - `--composition-valid-bg: #E7F6F1`
  - `--composition-valid-border: #9ED6C7`
  - `--composition-valid-foreground: #0E4B3F`
  - `--composition-valid-muted: #1A6557`
  - `--composition-warning-bg: #FFF4DD`
  - `--composition-warning-border: #E8C57A`
  - `--composition-warning-foreground: #6E4A00`
  - `--composition-warning-muted: #8A6114`

## Implementation Mapping
- **Implementation note:** `client/src/index.css` currently stores theme values as HSL channels, not raw hex strings. Convert the hex values above into HSL channel form when updating the live CSS variables.
- **Core token mapping to current app vars:**
  - `--background` maps to current `--background`
  - `--surface` maps to current `--card`, `--popover`
  - `--surface-muted` is the visual source for current soft-surface tokens
  - `--surface-strong` is a new helper token for hero bands, segmented controls, and emphasized rows
  - `--foreground` maps to current `--foreground`, `--card-foreground`, `--popover-foreground`
  - `--foreground-muted` maps to current `--muted-foreground`
  - `--line` maps to current `--border`, `--input`
  - `--primary` maps to current `--primary`
  - `--primary-foreground` maps to current `--primary-foreground`
  - current `--secondary` should stay a soft neutral surface and map near `--surface-muted`, not the jade brand color
  - current `--secondary-foreground` should map near `--foreground`
  - current `--accent` should stay a soft neutral surface and map near `--surface-muted`
  - current `--accent-foreground` should map near `--foreground`
  - `--brand-secondary` is the explicit jade helper token for dictionary emphasis, semantic badges, and editorial accents
  - `--secondary-soft` is the soft tint companion for `--brand-secondary`, not the soft-surface `--secondary` token
  - `--accent-warm-soft` is the soft tint companion for `--accent-warm`
  - `--danger` maps to current `--destructive`
  - `--danger-foreground` maps to current `--destructive-foreground`
  - `--header-bg` should stay near `--background-dark`
  - `--header-foreground` should stay near `--foreground-dark`
  - `--header-muted` should stay near `--foreground-muted-dark`
- **Editor token mapping to current app vars:**
  - `--editor-table-primary` maps to current `--erd-table-header`
  - `--editor-pk` maps to current `--erd-pk`
  - `--editor-fk` maps to current `--erd-fk`
  - `--editor-nn` maps to current `--erd-nn`
  - `--editor-ai` maps to current `--erd-ai`
  - `--editor-domain` maps to current `--erd-domain`
  - `--editor-domain-foreground` maps to current `--erd-domain-foreground`
  - `--status-connected` maps to current `--erd-status-connected`
  - `--status-connecting` maps to current `--erd-status-connecting`
  - `--status-disconnected` maps to current `--erd-status-disconnected`
  - `--validation-matched` maps to current `--erd-validation-matched`
  - `--validation-mismatch` maps to current `--erd-validation-mismatch`
  - `--validation-unregistered` maps to current `--erd-validation-unregistered`
  - `--validation-unchecked` maps to current `--erd-validation-unchecked`
  - dictionary mismatch and name/type mismatch UI should use `--validation-mismatch`
  - `--composition-valid-*` maps to current `--composition-valid-*`
  - `--composition-warning-*` maps to current `--composition-warning-*`

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable-compact. Workspace shell should breathe, editor controls should stay tight.
- **Scale:** `2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64) 4xl(96)`
- **Density tiers:**
  - display surfaces, radius `14-18px`, padding `24-40px`, soft shadow allowed
  - operational surfaces, radius `10-12px`, padding `12-20px`, shadow very light or none
  - data surfaces, radius `6-10px`, padding `8-14px`, avoid floating-card treatment

## Layout
- **Approach:** Hybrid
- **Grid:** `mobile 4`, `tablet 8`, `desktop 12`
- **Max content width:** `1120px` for Teams, Projects, Documents, Dictionary shell pages
- **Border radius:** `sm 6px`, `md 10px`, `lg 14px`, `xl 18px`, `pill 9999px`
- **Composition rules:**
  - Entry screens are not plain lists. The first viewport should read like a workspace cover page.
  - Every shell page needs one large anchor block, then denser operational content under it.
  - Use asymmetry lightly. This is a productivity product, not a poster experiment.

## Motion
- **Approach:** Intentional
- **Easing:** `enter cubic-bezier(0.22, 1, 0.36, 1)`, `exit cubic-bezier(0.4, 0, 1, 1)`, `move cubic-bezier(0.2, 0.8, 0.2, 1)`
- **Duration:** `micro 80ms`, `short 180ms`, `medium 280ms`, `long 420ms`
- **Rules:**
  - Hover should feel like a card lifting off paper, not glowing.
  - Hero sections can fade and slide very slightly on load.
  - Avoid decorative motion in the editor canvas shell. Reserve attention for actual ERD work.

## Surface Language
- App shell background uses warm paper, not blue-gray SaaS fog.
- Global header stays deep midnight, but the body below it should feel lighter and warmer.
- Main cards float on `--surface` with a soft edge shadow and a faint warm highlight, not generic flat white.
- Section heroes should use a restrained tint wash by context:
  - Teams: secondary jade tint
  - Projects: cobalt tint
  - Documents: warm amber tint
  - Dictionary: jade plus ivory, more knowledge-library than admin table
- Hero cards and landing surfaces may use the warmer, softer language. Dense rows, sidebars, toolbars, inspectors, and select controls should step down to operational or data-surface density.

## Component Rules
- **Buttons:** Primary is solid cobalt, secondary is ivory with ink border, ghost is text-led with subtle wash. No gradient CTA buttons.
- **Cards:** Use stronger padding, clearer vertical rhythm, and a noticeable but soft shadow. Cards should feel like deliberate objects, not divs with borders.
- **Inputs:** Ivory fill, visible line color, cobalt focus ring. Placeholder text should be muted but still readable.
- **Badges:** Small uppercase chips with real tint. Semantic badges are allowed. Random rainbow chips are not.
- **Tables and dense lists:** Use calm surfaces, heavier type hierarchy, and tabular numbers. The data should feel precise, not noisy.

## Application Rules
- **Teams page:** Treat as workspace landing, not a sparse CRUD grid. The page needs brand weight and a section-specific tone.
- **Projects page:** Hero gets editorial title treatment, project cards get stronger identity and action hierarchy.
- **Documents page:** This is the bridge between document platform and editor. It should visually borrow from both, warm shell plus sharper operational controls.
- **Dictionary:** Feels like a reference library. Slightly quieter, more secondary-color-led than the documents area.
- **Editor shell:** Keep the canvas functional, but carry the system in the top bar, side panels, badges, and utility chrome so it does not feel like a different product.
- **Editor interior:** Canvas semantics are part of the design system, not an exception. PK/FK/NN, validation, collaboration, and dictionary mismatch states must use the editor semantic palette above instead of ad-hoc legacy colors.

## Anti-Patterns
- Do not drift back to default slate-on-white everywhere.
- Do not center everything.
- Do not use generic violet gradients.
- Do not make every corner fully rounded just because Tailwind makes it easy.
- Do not let empty space become dead space. Large blank areas need composition, tint, or hierarchy.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-31 | Initial design system created | The workspace IA was cleaned up, but the visual system was still generic. This document locks the product into a warmer, more editorial, more memorable direction without sacrificing ERD tool clarity. |
