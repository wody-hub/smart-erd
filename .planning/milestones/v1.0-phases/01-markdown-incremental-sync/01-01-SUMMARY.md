---
phase: 01-markdown-incremental-sync
plan: 01
subsystem: lib
tags: [diff-match-patch, markdown, section-index, tdd, typescript]

# Dependency graph
requires: []
provides:
  - "SectionBoundary 인터페이스 — section 경계 정보 타입"
  - "computeSectionBoundaries() — markdown body 에서 heading 기준 section 경계 배열 계산"
  - "findAffectedSection() — 변경 offset 범위가 속하는 section ID 반환"
  - "diff-match-patch 패키지 설치 (증분 Y.Text 적용용)"
  - "테스트 스캐폴드: markdown-section-update.test.ts (9 케이스, Plan 02용)"
  - "테스트 스캐폴드: markdown-section-preview.test.ts (5 케이스, Plan 03용)"
affects: [01-markdown-incremental-sync plan 02, 01-markdown-incremental-sync plan 03]

# Tech tracking
tech-stack:
  added: [diff-match-patch 1.0.5, "@types/diff-match-patch 1.0.36"]
  patterns: [slug-based-section-id, tdd-red-green]

key-files:
  created:
    - client/src/lib/markdown-section-index.ts
    - client/test/unit/markdown-section-index.test.ts
    - client/test/unit/markdown-section-update.test.ts
    - client/test/unit/markdown-section-preview.test.ts
  modified:
    - client/package.json
    - client/package-lock.json

key-decisions:
  - "slug 기반 section ID 채택 — index 패턴(heading-{index}-{slug}) 대신 slugify(text) + 충돌 접미사(-1,-2)로 heading 추가/삭제 시 기존 ID 안정성 확보"
  - "빈 slug 기본값 'section' — 특수문자만인 heading에서도 유효한 ID 보장"
  - "한글 포함 slug 지원 — 기존 slugify() 패턴에서 가-힣 범위 유지"

patterns-established:
  - "slug-based-section-id: computeSectionBoundaries()에서 heading text → slug → 충돌 접미사 방식으로 안정적 section ID 생성"
  - "section-boundary-primitive: 증분 동기화와 증분 프리뷰의 공통 기반으로 SectionBoundary 배열 사용"

requirements-completed: [DOC-01, DOC-02]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 01 Plan 01: Section Index 순수 함수 TDD 구현 Summary

**diff-match-patch 설치 + slug 기반 SectionBoundary 순수 함수 라이브러리 완전 구현(12 케이스 GREEN) + Wave 2-3 테스트 스캐폴드 14개 케이스 작성**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T13:02:56Z
- **Completed:** 2026-04-02T13:06:02Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- diff-match-patch + @types/diff-match-patch 패키지 설치 완료
- computeSectionBoundaries(): 빈 body, heading 없음, 단일/복수 heading, slug 충돌, 한글, 다양한 level 모두 처리
- findAffectedSection(): 단일 section 내 변경, 경계 넘는 변경, 빈 변경 모두 정확히 판별
- Wave 2-3용 테스트 스캐폴드 2개 파일(14개 케이스) 생성 — import 주석 해제만으로 연결 가능

## Task Commits

Each task was committed atomically:

1. **Task 1: diff-match-patch 설치 + Section Index 순수 함수 구현 (TDD GREEN)** - `da96ad3` (feat)
2. **Task 2: Wave 2-3 플랜을 위한 테스트 스캐폴드 생성 (RED)** - `05d0101` (test)

## Files Created/Modified
- `client/src/lib/markdown-section-index.ts` - SectionBoundary 인터페이스 + computeSectionBoundaries + findAffectedSection 순수 함수
- `client/test/unit/markdown-section-index.test.ts` - 12개 테스트 케이스 (전체 GREEN)
- `client/test/unit/markdown-section-update.test.ts` - 증분 Y.Text 적용 + section-aware 커맨드 발행 스캐폴드 (9 케이스, RED)
- `client/test/unit/markdown-section-preview.test.ts` - Section HTML 캐시 무효화 스캐폴드 (5 케이스, RED)
- `client/package.json` - diff-match-patch, @types/diff-match-patch 의존성 추가
- `client/package-lock.json` - lockfile 갱신

## Decisions Made
- slug 기반 section ID 채택: `heading-{index}-{slug}` 패턴 대신 `slugify(text)` + 충돌 시 `-1`, `-2` 접미사 방식으로 heading 추가/삭제 시 기존 section ID가 shift 되지 않도록 안정성 확보
- 빈 slug 기본값으로 `'section'` 사용: 특수문자만인 heading(`# ***`)에서도 유효한 ID 보장
- 한글 포함 slug: 기존 `lib/markdown.ts`의 `slugify()` 패턴에서 `가-힣` 범위를 유지하여 한글 heading 지원

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 테스트 케이스 3 endOffset 수정**
- **Found during:** Task 1 (테스트 작성)
- **Issue:** 플랜의 케이스 3에서 `'# Hello\n\nContent'` 길이를 17로 명시했으나 실제 길이는 16
- **Fix:** endOffset 기대값을 16으로 수정
- **Files modified:** client/test/unit/markdown-section-index.test.ts
- **Verification:** 전체 테스트 224개 PASS
- **Committed in:** da96ad3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 플랜의 문자열 길이 계산 오류 수정. 기능에 영향 없음.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `computeSectionBoundaries()`와 `findAffectedSection()` 이 Plan 02(markdown-section-projector)와 Plan 03(markdown-section-preview-cache)에서 import 가능
- 테스트 스캐폴드가 Plan 02/03 실행자에게 구현 계약을 명확히 전달
- diff-match-patch 패키지가 설치되어 Plan 02에서 즉시 사용 가능

## Known Stubs
None - 모든 함수가 완전 구현되었으며 스텁이 존재하지 않음.

## Self-Check: PASSED

---
*Phase: 01-markdown-incremental-sync*
*Completed: 2026-04-02*
