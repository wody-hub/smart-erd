# Phase 7: 인력 투입 (M/M) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 07-인력-투입
**Areas discussed:** 인력 등급/단가 소유권, 계획/실적 입력 단위, 중복 투입 정책, WBS 관계, M/M 및 비용 계산, 제외 범위
**Mode:** `$gsd-discuss-phase 7 --auto` fallback

---

## Execution Note

The literal `$gsd-discuss-phase` command was not available on the shell PATH in this workspace. I read the local GSD skill and workflow from:

- `/Users/j.jaeyo/.codex/skills/gsd-discuss-phase/SKILL.md`
- `/Users/j.jaeyo/.codex/get-shit-done/workflows/discuss-phase.md`
- `/Users/j.jaeyo/.codex/get-shit-done/templates/context.md`

`workflow.discuss_mode` resolved to `discuss`. Because the requested invocation included `--auto`, I selected the recommended defaults for each gray area and documented the choices below.

---

## 인력 등급/단가 소유권

| Option                       | Description                                                  | Selected |
| ---------------------------- | ------------------------------------------------------------ | -------- |
| 프로젝트 staffing row에 저장 | 프로젝트별 계약 조건 스냅샷으로 등급과 월 단가를 보존한다    | ✓        |
| 사용자/조직 master에 저장    | 사용자 프로필 또는 조직 공통 단가표를 source of truth로 둔다 |          |
| 하이브리드                   | master 기본값을 복사하되 프로젝트 row에서 override한다       |          |

**Auto-selected choice:** 프로젝트 staffing row에 저장

**Notes**

- Phase 7 v1은 프로젝트 실행 관리를 닫는 것이 목표이며, 조직 전역 인사/단가 관리는 별도 기능이다.
- 프로젝트 계약 시점의 등급/단가가 나중의 user profile 변경으로 바뀌면 비용 집계가 흔들린다.
- `JUNIOR`, `MIDDLE`, `SENIOR`, `EXPERT` enum과 `초급`, `중급`, `고급`, `특급` 라벨을 사용한다.

---

## 계획/실적 입력 단위

| Option              | Description                                                              | Selected |
| ------------------- | ------------------------------------------------------------------------ | -------- |
| 기간/참여율 기반 v1 | 계획/실적 모두 시작일, 종료일, 참여율을 입력하고 백엔드가 M/M을 계산한다 | ✓        |
| 타임시트 기반       | 일/시간 단위 실적을 입력해 actual M/M을 집계한다                         |          |
| 월별 직접 입력      | 월별 plan/actual M/M을 사용자가 직접 입력한다                            |          |

**Auto-selected choice:** 기간/참여율 기반 v1

**Notes**

- 요구사항은 팀원별 투입 기간, 참여율, 등급, 단가, 계획 대비 실적 비교다.
- `REQUIREMENTS.md`의 out-of-scope에는 타임시트/시간 단위 기록이 명시되어 있다.
- 월별 직접 입력은 빠르지만 Phase 7에서 날짜 기반 staffing period와 충돌한다.

---

## 중복/다중 투입 정책

| Option                  | Description                                                            | Selected |
| ----------------------- | ---------------------------------------------------------------------- | -------- |
| 멤버당 프로젝트 row 1개 | `(project_id, user_id)` unique로 단순하고 검증 가능한 v1 모델을 만든다 | ✓        |
| 기간 겹침만 금지        | 같은 사람이 여러 row를 가질 수 있지만 기간 overlap을 막는다            |          |
| 모든 다중 구간 허용     | 동일 인원의 여러 투입 구간과 overlap까지 허용한다                      |          |

**Auto-selected choice:** 멤버당 프로젝트 row 1개

**Notes**

- Phase 7 v1은 M/M과 비용 계산 기준을 먼저 안정화해야 한다.
- 다중 구간은 UI, validation, matrix, cost explainability를 크게 늘린다.
- 후속 고도화에서 split interval 또는 capacity planning으로 확장할 수 있다.

---

## WBS assignee와 staffing row의 관계

| Option                     | Description                                                                     | Selected |
| -------------------------- | ------------------------------------------------------------------------------- | -------- |
| 읽기 전용 참고             | WBS assignee는 참고 정보일 뿐 staffing row 생성/수정은 사용자가 명시적으로 한다 | ✓        |
| WBS assignee에서 자동 생성 | WBS 담당자를 기준으로 staffing row를 자동 생성한다                              |          |
| 양방향 동기화              | WBS assignee와 staffing row를 서로 자동 반영한다                                |          |

**Auto-selected choice:** 읽기 전용 참고

**Notes**

- Phase 6.1은 WBS 담당자 입력 기반을 닫았지만, staffing을 WBS에 종속시키지는 않았다.
- WBS `estimatedMm`는 작업 예상 공수이고, Phase 7 staffing은 사람별 투입/단가/실적/비용이다.
- 자동 생성/동기화는 잘못된 비용 데이터가 생길 위험이 있어 v1 범위에서 제외한다.

---

## M/M 및 비용 계산 기준

| Option                                     | Description                                                              | Selected |
| ------------------------------------------ | ------------------------------------------------------------------------ | -------- |
| 월별 일할 계산 + 2자리 M/M + KRW 정수 비용 | calendar month overlap days로 M/M을 계산하고 표시값과 비용 계산을 맞춘다 | ✓        |
| 단순 30일 월 기준                          | 모든 월을 30일로 보고 계산한다                                           |          |
| 월 단위 정액 계산                          | 하루라도 투입되면 월 전체 또는 사용자가 지정한 월값으로 계산한다         |          |

**Auto-selected choice:** 월별 일할 계산 + 2자리 M/M + KRW 정수 비용

**Notes**

- 월별 contribution은 `(overlap days / days in month) * participationRate / 100`이다.
- 총 M/M은 월별 contribution 합계 후 `HALF_UP` 2자리로 반올림한다.
- 비용은 사용자가 보는 rounded M/M과 KRW integer monthly rate를 곱하고 `HALF_UP`으로 KRW 정수 반올림한다.
- planned와 actual은 독립 계산하여 variance를 보여준다.

---

## Phase 7 제외 범위

| Option                  | Description                                                      | Selected |
| ----------------------- | ---------------------------------------------------------------- | -------- |
| 인력 M/M 및 인건비 v1만 | 급여/회계/타임시트/비용 카테고리는 제외하고 staffing v1을 닫는다 | ✓        |
| 비용 관리까지 확장      | 인건비 외 경비/외주비/라이선스까지 포함한다                      |          |
| 인사/급여 연동까지 확장 | HR/payroll/accounting 시스템 연동을 포함한다                     |          |

**Auto-selected choice:** 인력 M/M 및 인건비 v1만

**Notes**

- Phase 7 성공 기준은 HR-01~HR-04다.
- 비용 관리 고도화는 v2 `COST-*` 요구사항 영역이다.
- 외부 연동은 회사별 시스템 편차와 보안/정산 정책 차이가 크므로 Phase 7에 넣지 않는다.

---

## the agent's Discretion

- Exact backend persistence shape for derived calculated fields.
- Exact UI component split under `client/src/components/staffing/`.
- Exact empty-state copy and validation copy, within ko/en i18n requirements.
- Exact month range derivation for the matrix, provided real staffed months are visible and stable.

## Deferred Ideas

- Organization-wide grade/rate master.
- Multiple staffing intervals per person.
- Monthly direct override matrix.
- Timesheet or hourly actual entry.
- Payroll, accounting, ERP, or HR integration.
- Non-labor cost categories.
- Automatic staffing generation from WBS assignees.
- WBS/staffing bidirectional sync.

## Blocking Questions

None. The auto discussion resolved Phase 7 gray areas without PM-blocking questions.
