# 대용량 ERD 동기화 개선 Phase 2 릴리즈/롤백 패킷

작성일: 2026-02-26  
대상 티켓: P2-10

## 1. 릴리즈 범위

- Diff 계산/적용 경로
  - `client/src/lib/erd-diff-plan.ts`
  - `client/src/lib/erd-diff-builder.ts`
  - `client/src/lib/erd-diff-apply.ts`
  - `client/src/hooks/useApplyToErd.ts`
- 폴백/그룹 재매핑
  - `client/src/lib/erd-fallback-group-remap.ts`
- 점진 전환(Feature Flag)
  - `client/src/lib/diff-apply-rollout.ts`
  - `plan/대용량-ERD-동기화-개선-Phase2-Feature-Flag-운영가이드.md`

## 2. 배포 전 게이트

- 자동 검증:
  - `npm run lint` 통과
  - `npm run test:unit` 통과
  - `npm run build` 통과
  - `npm run perf:erd:apply:sample` 통과
- 문서 게이트:
  - P2-09 KPI 리포트 작성 완료
  - 본 릴리즈/롤백 패킷 작성 완료

## 3. 점진 배포 절차

1. `VITE_ERD_DIFF_APPLY_MODE=off`로 배포 후 메트릭 관찰
2. `internal` 전환 + 내부 대상 `VITE_ERD_DIFF_APPLY_INTERNAL_IDS` 지정
3. `beta` 전환 + `VITE_ERD_DIFF_APPLY_BETA_PERCENT=10`
4. 베타 비율 확장 (`25 -> 50 -> 100`)
5. 최종 `all` 전환

## 4. 모니터링/알람 기준

- 핵심 로그/지표:
  - `[erd-sync-metrics] rollout.mode`, `rollout.enabled`, `rollout.reason`
  - `[erd-sync-metrics] diff.skippedOperations`
  - `[erd-sync-metrics] diff.groupDroppedCount`
  - `diff-apply-fallback` 발생률
- 즉시 롤백 트리거:
  - fallback 빈도 급증
  - 그룹 멤버십 drop 비율 급증
  - 사용자 오류 신고 급증

## 5. 롤백 절차

1. 런타임 설정을 즉시 `VITE_ERD_DIFF_APPLY_MODE=off`로 전환
2. 재배포 후 신규 세션부터 Full Replace 경로 강제
3. `diff-apply-fallback`/오류 로그 추적 기간을 별도 기록
4. 원인 분석 완료 전 `internal/beta/all` 재전환 금지

## 6. 커뮤니케이션 템플릿 (운영 공지)

- 제목: `[Smart-ERD] Phase2 Diff Apply 롤아웃 단계 전환 공지`
- 본문 필수 항목:
  - 전환 시각/모드(`off|internal|beta|all`)
  - 대상 범위(loginId/percent)
  - 롤백 기준과 담당자
  - 다음 점검 시각

## 7. 책임자 매핑

- 릴리즈 리드: riskzero-release-management-team
- 기능 리드: riskzero-development-team
- 성능/지표 리드: riskzero-platform-sre-team
- QA 리드: riskzero-qa-automation-team
