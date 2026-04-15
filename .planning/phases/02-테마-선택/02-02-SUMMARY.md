---
phase: 02-테마-선택
plan: 02
subsystem: ui
tags: [css, theme, design-tokens, dark-mode]

requires:
  - phase: 02-테마-선택 P01
    provides: theme store, theme switcher, .dark compatibility bit
provides:
  - 3-theme CSS variable token rollout (Paper/Graphite/Midnight)
  - Theme-specific body background gradients
  - DESIGN.md theme architecture documentation
affects: [02-테마-선택 P03]

tech-stack:
  added: []
  patterns: [theme-class-driven CSS variable override, dark-surface shadow override pattern]

key-files:
  created: []
  modified:
    - DESIGN.md
    - client/src/index.css

key-decisions:
  - "Graphite token set uses 02-UI-SPEC.md exact HSL values with independent palette (no Paper inheritance)"
  - "Midnight migrates .dark values to .theme-midnight with explicit shadow overrides"
  - "Shadow tokens use shared dark-surface overrides for both Graphite and Midnight (deeper opacity than Paper)"
  - ".dark standalone token block removed; .dark retained as Tailwind compatibility bit only"
  - "Theme body gradients defined via theme-class selectors in @layer base"

patterns-established:
  - "Theme token override: :root/.theme-paper (baseline), .theme-graphite (independent cool gray), .theme-midnight (navy dark ex-.dark)"
  - "Dark shadow override: Graphite and Midnight use identical shadow values for consistent dark-surface depth"

requirements-completed: [THEME-02]

duration: 5min
completed: 2026-04-03
---

# Phase 02 Plan 02: 3-Theme CSS Variable Token Rollout Summary

**Paper/Graphite/Midnight 3개 테마의 완전한 CSS variable token set을 index.css에 전개하여, 모든 UI 컴포넌트가 class 전환만으로 tone을 바꿀 수 있게 함**

## What Was Done

### Task 1: DESIGN.md + index.css theme token rollout

index.css의 token selector 구조를 3-theme 체계로 전환:

- `:root, .theme-paper` -- Paper 토큰 (기존 `:root` 값 그대로 유지)
- `.theme-graphite` -- UI-SPEC의 exact HSL 값을 반영한 cool gray 독립 토큰셋
- `.theme-midnight` -- 기존 `.dark` 값을 이전한 navy dark 토큰셋

주요 구현 사항:
1. **Graphite 토큰셋**: `--background: 220 14% 18%`, `--primary: 220 80% 62%`, `--erd-table-header: 220 80% 62%`, `--erd-table-supporting: 168 54% 42%` 등 UI-SPEC exact match
2. **Midnight 토큰셋**: semantic/ERD/validation/composition/cursor 값은 기존 `.dark` 그대로, shadow만 dark override 적용
3. **Shadow override**: Graphite/Midnight 모두 `rgba(0,0,0,0.24/0.48/0.20)` 기반 deep shadow 사용
4. **Body gradient**: `.theme-graphite body`는 opacity 0.05, `.theme-midnight body`는 기존 dark gradient 유지
5. **Legacy `.dark` 제거**: standalone `.dark` token block 삭제, compatibility bit로만 남김
6. **DESIGN.md**: Theme Architecture 섹션 추가 (Monaco mapping, token ownership, shadow override 방침)

## Token Inventory Parity Check

기존 `:root`와 `.dark`에서 사용 중인 모든 token 이름을 Graphite/Midnight에 빠짐없이 반영 완료:
- core/surface: background, foreground, foreground-secondary, card, popover, secondary, muted, accent
- overlay/shell: field-highlight, overlay-scrim, header-bg/foreground/muted
- ERD: 모든 erd-* 토큰 (table-header, pk, fk, nn, handle, warning, ai, domain, status, cursor-foreground)
- validation/composition: erd-validation-*, composition-valid-*, composition-warning-*
- cursor: cursor-color-1~6
- shadow/utilities: shadow-soft, shadow-strong, shadow-operational, shadow-primary, shadow-primary-hover, shadow-destructive, shadow-field-inset

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `4debf0a` | 3-theme CSS variable rollout + DESIGN.md theme architecture |

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
