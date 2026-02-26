# 대용량 ERD 동기화 개선 작업티켓 백로그

## 1. 운영 원칙

- 이 문서는 Phase 1, Phase 2 실행 티켓을 정의한다.
- Phase 2는 착수 게이트(의사결정 3종) 완료 전 개발 시작 금지다.
- 티켓 완료 판정은 DoD(완료 기준) 충족 여부로만 판단한다.
- QA는 리뷰 삼총사 관점(아키텍처/개발/디자인) 체크를 포함한다.
- 본 백로그의 라우팅 모드는 `routing=multi-delegate`로 고정한다.

## 2. 상태 코드

- `todo`: 착수 전
- `doing`: 진행 중
- `blocked`: 외부 의사결정/의존성 대기
- `review`: 구현 완료, 리뷰 대기
- `done`: DoD 충족 완료

## 2.3 블로킹 규칙

- `GATE-01~03` 중 1개라도 `done`이 아니면 모든 `P2-*`는 `blocked`로 유지한다.
- 선행조건 티켓이 `done`이 아니면 후행 티켓은 `doing`으로 전환할 수 없다.
- `n-a` 워크스트림은 변경 발생 시 즉시 `in`으로 승격하고 백로그를 갱신한다.

## 2.1 워크스트림 라우팅 선언 (riskzero-development-group)

| Workstream              | 이번 스코프 | 리드 팀                           |
| ----------------------- | ----------- | --------------------------------- |
| web frontend            | in          | riskzero-development-team         |
| QA automation           | in          | riskzero-qa-automation-team       |
| release management      | in          | riskzero-release-management-team  |
| architecture/governance | in          | riskzero-architecture-review-team |
| backend/service         | n-a         | no-change                         |
| mobile                  | n-a         | no-change                         |
| data/ML                 | n-a         | no-change                         |
| infra/platform          | n-a         | no-change                         |
| security                | n-a         | no-change                         |
| shared library/SDK      | n-a         | no-change                         |

## 2.2 게이트 산출물 경로

- GATE-01: `plan/decisions/DR-01-rename-policy.md`
- GATE-02: `plan/decisions/DR-02-group-remap-policy.md`
- GATE-03: `plan/decisions/DR-03-threshold-defaults.md`

## 3. Phase 1 티켓 (즉시 실행)

| ID    | 우선순위 | 제목                                      | 오너                                       | 선행조건            | 예상 | DoD                                                                                          | 산출물                                                                                                                                   | 상태 |
| ----- | -------- | ----------------------------------------- | ------------------------------------------ | ------------------- | ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P1-01 | P0       | 대형 다이어그램 정책 상수/설정 도입       | FE (riskzero-development-team)             | 없음                | 0.5d | 임계치(경고 150, 제한 300)와 `syncPolicy` 기본값이 코드에 반영되고 설정 로딩 경로가 동작한다 | `client/src/lib/sync-policy.ts`, `client/src/constants/storage.ts`                                                                       | done |
| P1-02 | P0       | 자동 Apply 가드 구현                      | FE (riskzero-development-team)             | P1-01               | 1d   | 임계치 초과 시 자동 Apply가 차단되고 수동 확인 플로우로 전환된다                             | `client/src/hooks/useApplyToErd.ts`, `client/src/hooks/useBidirectionalCodeSync.ts`                                                      | done |
| P1-03 | P0       | 레이아웃 모드 분기(full/incremental/none) | FE (riskzero-development-team)             | P1-01               | 1d   | 대형에서 기본 `incremental` 또는 `none` 동작, 소형은 기존 full 유지                          | `client/src/lib/auto-layout.ts`, `client/src/hooks/useApplyToErd.ts`                                                                     | done |
| P1-04 | P0       | Apply 성능 텔레메트리 계측                | FE (riskzero-development-team)             | P1-02, P1-03        | 1d   | parse/apply/layout/total 지표가 누락 없이 수집되고 로그 포맷이 고정된다                      | `client/src/hooks/useApplyToErd.ts` (`[erd-sync-metrics]`)                                                                               | done |
| P1-05 | P1       | 성능 측정 스크립트 `perf:erd:apply` 추가  | QA-AUTO (riskzero-qa-automation-team)      | P1-04               | 1d   | `S50/S200/S500` 입력으로 p50/p95 JSON 리포트 생성이 가능하다                                 | `client/scripts/perf/erd-apply.mjs`, `client/perf-reports/erd-apply-report.json`                                                         | done |
| P1-06 | P1       | 대형 Apply UX 문구/모달 정리              | FE-UI (riskzero-development-team)          | P1-02               | 0.5d | 경고/확인 문구와 흐름이 읽기 쉬우며 편집자 오해를 줄인다                                     | `client/src/i18n/locales/ko/translation.json`, `client/src/i18n/locales/en/translation.json`                                             | done |
| P1-07 | P1       | 회귀 테스트 및 QA 패킷 작성               | QA-AUTO (riskzero-qa-automation-team)      | P1-02, P1-03, P1-04 | 1d   | 단위/빌드/핵심 수동 시나리오 체크리스트가 문서화된다                                         | `client/test/unit/sync-policy.test.ts`, `client/test/unit/code-sync-apply-gate.test.ts`, `plan/대용량-ERD-동기화-개선-Phase1-QA-패킷.md` | done |
| P1-08 | P1       | Phase 1 결과 리포트/릴리즈 노트           | RELEASE (riskzero-release-management-team) | P1-05, P1-07        | 0.5d | KPI 결과와 남은 리스크가 릴리즈 노트에 반영된다                                              | `plan/대용량-ERD-동기화-개선-Phase1-릴리즈-노트.md`                                                                                      | done |

## 4. Phase 2 착수 게이트 티켓 (의사결정)

| ID      | 우선순위 | 제목                       | 오너                                                                      | 선행조건 | 예상 | DoD                                               | 산출물                                       | 상태 |
| ------- | -------- | -------------------------- | ------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------- | -------------------------------------------- | ---- |
| GATE-01 | P0       | rename 판정 정책 확정      | PM + LEAD-FE (riskzero-development-group)                                 | 없음     | 0.5d | rename vs delete+add 규칙이 예시와 함께 문서 확정 | `plan/decisions/DR-01-rename-policy.md`      | done |
| GATE-02 | P0       | 그룹 재매핑 강도 정책 확정 | ARCH + FE (riskzero-architecture-review-team + riskzero-development-team) | 없음     | 0.5d | 보수/공격 정책 중 1안 확정 및 실패 처리 규칙 고정 | `plan/decisions/DR-02-group-remap-policy.md` | done |
| GATE-03 | P0       | 임계치 기본값 최종 확정    | SRE + FE (riskzero-platform-sre-team + riskzero-development-team)         | P1-05    | 0.5d | 실측 기반 기본값(경고/제한) 확정                  | `plan/decisions/DR-03-threshold-defaults.md` | done |

## 5. Phase 2 티켓 (게이트 완료 후 실행)

| ID    | 우선순위 | 제목                                      | 오너                                                                        | 선행조건              | 예상 | DoD                                                                            | 산출물           | 상태 |
| ----- | -------- | ----------------------------------------- | --------------------------------------------------------------------------- | --------------------- | ---- | ------------------------------------------------------------------------------ | ---------------- | ---- |
| P2-01 | P0       | Diff 모델(`DiffPlan`) 타입 정의           | FE (riskzero-development-team)                                              | GATE-01, GATE-02      | 0.5d | 테이블/컬럼/엣지 add/update/delete 모델이 타입으로 고정된다                    | `client/src/lib/erd-diff-plan.ts`, `client/test/unit/erd-diff-plan.test.ts`          | done |
| P2-02 | P0       | 테이블 매칭/디프 계산기 구현              | FE (riskzero-development-team)                                              | P2-01                 | 1.5d | 물리명/논리명/시그니처 단계 매칭이 동작하고 불확실 케이스는 안전 처리된다      | `client/src/lib/erd-diff-builder.ts`, `client/test/unit/erd-diff-builder.test.ts`      | done |
| P2-03 | P0       | 컬럼/관계 디프 계산기 확장                | FE (riskzero-development-team)                                              | P2-02                 | 1.5d | 컬럼/관계 변경이 누락 없이 디프에 반영된다                                     | `client/src/lib/erd-diff-builder.ts`, `client/test/unit/erd-diff-builder.test.ts`      | done |
| P2-04 | P0       | `applyDiffToYDoc` 증분 반영기 구현        | FE (riskzero-development-team)                                              | P2-03                 | 1.5d | Yjs 원자 트랜잭션으로 증분 반영이 수행되고 데이터 무결성이 유지된다            | `client/src/lib/erd-diff-apply.ts`, `client/test/unit/erd-diff-apply.test.ts`, `client/src/stores/canvas/canvasTableActions.ts` | done |
| P2-05 | P0       | 그룹 멤버십 보존/재매핑 적용              | FE (riskzero-development-team)                                              | P2-04, GATE-02        | 1d   | 매칭 성공 테이블의 그룹 멤버십이 유지되고 불확실 멤버십은 규칙대로 처리된다    | `client/src/lib/erd-diff-apply.ts`, `client/test/unit/erd-diff-apply.test.ts` | done |
| P2-06 | P0       | Diff 실패 시 Full Replace 폴백 파이프라인 | FE (riskzero-development-team)                                              | P2-04, P2-05, GATE-02 | 1d   | 실패 시 폴백 전환, 그룹 처리 규칙, 사용자 알림이 정상 동작한다                 | `client/src/hooks/useApplyToErd.ts`, `client/src/lib/erd-fallback-group-remap.ts`, `client/src/i18n/locales/ko/translation.json`, `client/src/i18n/locales/en/translation.json` | done |
| P2-07 | P1       | Feature Flag 기반 점진 전환               | FE + RELEASE (riskzero-development-team + riskzero-release-management-team) | P2-06                 | 0.5d | `useDiffApply` 플래그로 내부/베타/전체 전환이 가능하다                         | `client/src/lib/diff-apply-rollout.ts`, `client/src/hooks/useApplyToErd.ts`, `plan/대용량-ERD-동기화-개선-Phase2-Feature-Flag-운영가이드.md` | done |
| P2-08 | P1       | 대용량 회귀 테스트 세트 확장              | QA-AUTO (riskzero-qa-automation-team)                                       | P2-06                 | 1d   | no-op, rename, partial update, fallback 시나리오 자동 검증이 가능하다          | `client/test/unit/erd-diff-regression.test.ts` | done |
| P2-09 | P1       | KPI 재측정 및 목표 검증                   | SRE + QA-AUTO (riskzero-platform-sre-team + riskzero-qa-automation-team)    | P2-08                 | 1d   | 500테이블 목표 지표 달성 여부와 편차 원인이 보고된다                           | `client/perf-reports/erd-apply-report.json`, `plan/대용량-ERD-동기화-개선-Phase2-KPI-검증-리포트.md` | done |
| P2-10 | P1       | 릴리즈 준비/롤백 문서화                   | RELEASE (riskzero-release-management-team)                                  | P2-07, P2-09          | 0.5d | 배포 시나리오와 롤백 절차가 운영 문서로 확정된다                               | `plan/대용량-ERD-동기화-개선-Phase2-릴리즈-롤백-패킷.md` | done |
| P2-11 | P1       | Phase 2 QA-PACKET 최종 제출               | QA-AUTO (riskzero-qa-automation-team)                                       | P2-08, P2-09, P2-10   | 0.5d | 자동검증 결과, 고위험 회귀경로, 수동 체크리스트, Known gap이 패킷으로 제출된다 | `plan/대용량-ERD-동기화-개선-Phase2-QA-패킷.md` | done |

## 6. 즉시 착수 권장 순서

1. P2-01
2. P2-02
3. P2-03
4. P2-04
5. P2-05
6. P2-06
7. P2-07
8. P2-08
9. P2-09
10. P2-10
11. P2-11

## 7. 티켓 실행 시 공통 체크

- 코드 변경 전: 영향 범위와 폴백 경로 확인
- 코드 변경 후: 빌드/단위/핵심 시나리오 검증
- 머지 전: 리뷰 삼총사 체크리스트 업데이트

## 8. 점검-수정 반복 로그 (최대 10회)

| 회차 | 점검 결과                                            | 수정 사항                                                              | Critical/High 잔여 | 상태      |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------ | --------- |
| 1    | 오너/워크스트림/게이트산출물/의존성/QA패킷 누락 식별 | 오너를 riskzero 팀 매핑으로 변경, 라우팅/게이트 경로/의존성/P2-11 반영 | 0                  | continue  |
| 2    | 수정 반영 후 재점검                                  | 추가 구조 누락 없음 확인                                               | 0                  | continue  |
| 3    | 운영 규칙 보강 점검                                  | `routing=multi-delegate`, 블로킹 규칙 추가                             | 0                  | done-stop |
| 4    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 5    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 6    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 7    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 8    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 9    | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
| 10   | 조기 종료                                            | 미진행                                                                 | -                  | stopped   |
