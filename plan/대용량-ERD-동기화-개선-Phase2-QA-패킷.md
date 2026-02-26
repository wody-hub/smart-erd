# 대용량 ERD 동기화 개선 Phase 2 QA 패킷

작성일: 2026-02-26  
대상 범위: P2-01 ~ P2-11

## 1. 변경 요약 (Workstream 기준)

- FE-WEB (riskzero-development-team)
  - `client/src/lib/erd-diff-plan.ts`
  - `client/src/lib/erd-diff-builder.ts`
  - `client/src/lib/erd-diff-apply.ts`
  - `client/src/lib/erd-fallback-group-remap.ts`
  - `client/src/lib/diff-apply-rollout.ts`
  - `client/src/hooks/useApplyToErd.ts`
  - `client/src/stores/canvas/canvasStoreTypes.ts`
  - `client/src/stores/canvas/canvasTableActions.ts`
  - `client/src/constants/storage.ts`
  - `client/src/i18n/locales/ko/translation.json`
  - `client/src/i18n/locales/en/translation.json`
- QA-AUTO (riskzero-qa-automation-team)
  - `client/test/unit/erd-diff-plan.test.ts`
  - `client/test/unit/erd-diff-builder.test.ts`
  - `client/test/unit/erd-diff-apply.test.ts`
  - `client/test/unit/erd-fallback-group-remap.test.ts`
  - `client/test/unit/diff-apply-rollout.test.ts`
  - `client/test/unit/erd-diff-regression.test.ts`
  - `client/perf-reports/erd-apply-report.json`
- DOC/RELEASE
  - `plan/대용량-ERD-동기화-개선-Phase2-Feature-Flag-운영가이드.md`
  - `plan/대용량-ERD-동기화-개선-Phase2-KPI-검증-리포트.md`
  - `plan/대용량-ERD-동기화-개선-Phase2-릴리즈-롤백-패킷.md`

## 2. 자동 검증 결과

- `npm run lint` (client): 통과
- `npm run test:unit` (client): 통과 (47/47)
- `npm run build` (client): 통과
- `npm run perf:erd:apply:sample` (client): 통과
  - 산출물: `client/perf-reports/erd-apply-report.json`

## 3. 리뷰 삼총사 관점 점검

- ARCH
  - Diff 실패 시 Full Replace 폴백 경로가 유지되어 안전성 확보
  - 그룹 재매핑은 고신뢰 update만 유지하는 보수 정책으로 확정
- DEV
  - no-op/rename/partial/fallback 회귀 시나리오 자동화 완료
  - `useApplyToErd`에 rollout + fallback + metrics 경로 통합 검증 완료
- DESIGN
  - 대형 Apply 경고/폴백 안내 문구의 ko/en i18n 키 반영 확인
  - 사용자 체감상 위험 동작은 모달/토스트 기반 안내로 명시

## 4. 고위험 회귀 경로

- rename 승격 오탐으로 인한 잘못된 table-id 재사용
- diff 적용 중 예외 발생 시 fallback 전환 누락
- fallback 이후 그룹 멤버십 과삭제/과보존
- rollout 모드 전환 시 사용자군 계산 오류(내부/베타)

## 5. 수동 검증 체크리스트

- [ ] `off/internal/beta/all` 모드 전환 시 기대 경로(diff/full-replace) 확인
- [ ] rename 1건 포함 DDL 적용 시 table id/position 보존 확인
- [ ] partial update(컬럼 추가/삭제/타입변경) 후 edge 정합성 확인
- [ ] diff 예외 유발 시 fallback 토스트 노출 및 편집 지속 가능 여부 확인
- [ ] 그룹 포함 다이어그램에서 fallback 후 멤버십 재구성 결과 확인

## 6. Known Gaps / Assumptions

- 성능 측정은 Node synthetic benchmark 기준이며 브라우저 렌더링 부하는 제외
- KPI는 절대값보다 동일 환경 내 추세 비교에 의미가 크다
- 실제 운영에서 rollout/rollback 속도는 배포 파이프라인 정책에 의존한다
