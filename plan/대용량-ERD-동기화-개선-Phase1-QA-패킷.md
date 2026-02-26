# 대용량 ERD 동기화 개선 Phase 1 QA 패킷

작성일: 2026-02-26  
대상 범위: P1-01 ~ P1-08

## 1. 변경 요약 (Workstream 기준)

- FE-WEB (riskzero-development-team)
    - `client/src/lib/sync-policy.ts`
    - `client/src/hooks/useApplyToErd.ts`
    - `client/src/hooks/useBidirectionalCodeSync.ts`
    - `client/src/lib/auto-layout.ts`
    - `client/src/constants/sync-status.ts`
    - `client/src/lib/sync-status-meta.ts`
    - `client/src/components/erd/DdlCodeEditorPanel.tsx`
    - `client/src/components/erd/DslCodeEditorPanel.tsx`
    - `client/src/components/erd/CodeEditorFooter.tsx`
    - `client/src/constants/storage.ts`
    - `client/src/i18n/locales/ko/translation.json`
    - `client/src/i18n/locales/en/translation.json`
- QA-AUTO (riskzero-qa-automation-team)
    - `client/scripts/perf/erd-apply.mjs`
    - `client/perf-reports/erd-apply-report.json`
    - `client/test/unit/code-sync-apply-gate.test.ts`
    - `client/test/unit/sync-policy.test.ts`
    - `client/tsconfig.test.json`
    - `client/package.json` (`perf:erd:apply`, `perf:erd:apply:sample`)
- DOC/RELEASE
    - `README.md`
    - 본 문서 및 Phase 1 릴리즈 노트

## 2. 자동 검증 결과

- `npm run build` (client): 통과
- `npm run test:unit` (client): 통과 (23/23)
- `npm run perf:erd:apply` (client): 통과
    - 기본 리포트: `/tmp/smart-erd/perf/erd-apply-report.json`
- `npm run perf:erd:apply:sample` (client): 통과
    - 샘플 리포트: `client/perf-reports/erd-apply-report.json`
- `npm run lint` (client): 통과

## 3. 핵심 수동 검증 체크리스트

- [ ] SQL/DSL 코드 편집 중 S150+ 규모에서 경고 문구 노출 확인
- [ ] S300+ 규모에서 자동 반영이 `manual confirm` 상태로 전환되는지 확인
- [ ] 수동 Apply 시 확인 다이얼로그 문구(대형 설명 포함) 확인
- [ ] 소형 다이어그램에서 기존 full 레이아웃 유지 확인
- [ ] 대형 다이어그램에서 full 요청 시 incremental 대체 동작 확인
- [ ] 동기화 상태 배지(`manualConfirmHold`) 한/영 노출 확인
- [ ] 원격 편집 락과 manual-confirm 상태 간 충돌/오표시 여부 확인

## 4. 고위험 회귀 경로

- 코드->ERD 자동반영 루프 차단 로직(`originRef`, `suppressNextErdSyncRef`)
- `replaceFromDdl` 이후 레이아웃 분기(full/incremental/none) 일관성
- 대형 임계치 전후(149/150/299/300)에서 상태 전이 경계
- DSL 패널의 사전 로딩 지연 구간에서 auto-apply 보류 처리

## 5. Known Gaps / Assumptions

- `perf:erd:apply`는 Node 기반 synthetic benchmark로, 실제 브라우저 렌더링/React commit 비용은 제외
- 성능 리포트 수치는 실행 환경/부하 상태에 따라 변동될 수 있으므로 절대값보다 추세 비교가 중요함
- 정책 저장은 localStorage 기반(다이어그램 단위)이며 서버 동기화는 Phase 1 범위 밖
