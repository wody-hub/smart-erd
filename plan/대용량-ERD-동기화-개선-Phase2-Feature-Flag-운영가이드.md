# 대용량 ERD 동기화 개선 Phase 2 Feature Flag 운영가이드

## 1. 목적

- Diff Apply 경로를 한 번에 전체 전환하지 않고 단계적으로 확장한다.
- 이 문서는 `useDiffApply` rollout 모드(`off/internal/beta/all`) 운영 기준을 정의한다.

## 2. 제어 변수

- `VITE_ERD_DIFF_APPLY_MODE`
  - `off`: 전체 비활성(기본값)
  - `internal`: 내부 대상만 활성
  - `beta`: 샘플링 대상만 활성
  - `all`: 전체 활성
- `VITE_ERD_DIFF_APPLY_BETA_PERCENT`
  - `beta` 모드에서 활성 비율(0~100)
  - 기본값 `10`
- `VITE_ERD_DIFF_APPLY_INTERNAL_IDS`
  - `internal` 모드 허용 loginId 목록(csv)
  - 예: `alice,bob,carol`

## 3. 로컬 오버라이드(운영/디버그용)

- key: `smart-erd-diff-apply-force-mode`
  - 값: `off|internal|beta|all`
  - env 모드보다 우선
- key: `smart-erd-diff-apply-internal-opt-in`
  - 값: `true|1`
  - `internal` 모드에서 allowlist가 아니어도 내부 opt-in 허용

## 4. 전환 절차

1. `off` 유지 + 모니터링
2. `internal` 전환 (`INTERNAL_IDS` 지정)
3. `beta` 전환 (`BETA_PERCENT=10` 시작)
4. `beta` 점진 확대 (`25 -> 50 -> 100`)
5. `all` 전환

## 5. 모니터링 항목

- `[erd-sync-metrics] rollout.mode`, `rollout.enabled`, `rollout.reason`
- `[erd-sync-metrics] diff.skippedOperations`
- `[erd-sync-metrics] diff.groupDroppedCount`
- 폴백 이벤트: `diff-apply-fallback` 로그 빈도

## 6. 롤백 기준

- fallback 비율 급증
- 그룹 멤버십 drop 비율 급증
- 사용자 오류 신고 증가

위 조건 중 1개 이상 충족 시 즉시 `VITE_ERD_DIFF_APPLY_MODE=off`로 롤백한다.
