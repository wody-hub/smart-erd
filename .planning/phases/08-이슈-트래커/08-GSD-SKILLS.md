# 8단계 GSD 스킬 목록

**단계:** 08-이슈-트래커
**작성일:** 2026-04-23
**목적:** 8단계 구현 전에 사용할 GSD 워크플로와 스킬 순서를 미리 정리한다.

## 런타임 메모

7단계에서 확인한 현재 로컬 상황은 동일하다. GSD 스킬 markdown 파일과 `gsd-tools.cjs`는 존재하지만, `$gsd-discuss-phase` 같은 literal shell command는 이 런타임의 PATH에서 직접 실행되지 않는다. 따라서 아래 명령은 active agent 환경에서 호출할 GSD 스킬/워크플로 이름으로 취급하거나, 각 `SKILL.md`와 workflow markdown을 읽는 수동 Codex fallback으로 적용한다.

## 권장 진행 순서

| 순서 | GSD 스킬 / 워크플로 | 목적 | 예상 산출물 |
|------|----------------------|------|-------------|
| 1 | `$gsd-discuss-phase 8 --auto` | 계획 전에 제품/도메인 회색 지대 결정을 고정한다 | `08-CONTEXT.md`, `08-DISCUSSION-LOG.md` |
| 2 | `$gsd-ui-phase 8` | roadmap의 `UI hint: yes`에 맞춰 이슈 트래커 UI 설계 계약을 만든다 | `08-UI-SPEC.md` |
| 3 | `$gsd-plan-phase 8` | 구현 조사를 수행하고 실행 가능한 구현 계획을 만든다 | `08-RESEARCH.md`, `08-01-PLAN.md` |
| 4 | `$gsd-review 8` | 실행 전 교차 검토 또는 독립 plan review를 수행한다 | `08-REVIEWS.md` |
| 5 | `$gsd-plan-phase 8 --reviews` | review 우려사항을 실행 계획에 반영한다 | 수정된 `08-01-PLAN.md` |
| 6 | `$gsd-execute-phase 8` | 승인된 계획에 따라 백엔드/API/프론트엔드/테스트/문서를 구현한다 | 코드와 `08-01-SUMMARY.md` |
| 7 | `$gsd-validate-phase 8` | `ISSUE-01`부터 `ISSUE-04`까지 Nyquist/coverage 검증을 수행한다 | `08-VALIDATION.md` |
| 8 | `$gsd-ui-review 8` | 구현된 이슈 트래커 tab의 시각/UX 감사를 수행한다 | `08-UI-REVIEW.md` |
| 9 | `$gsd-verify-work 8` | phase 목표가 실제로 충족되었는지 goal-backward 방식으로 검증한다 | `08-VERIFICATION.md` |

## 스킬별 세부 사용법

### 1. `$gsd-discuss-phase 8 --auto`

사용자가 상호작용 방식의 제품 선택을 원하지 않으면 가장 먼저 사용한다.

입력으로 읽을 문서:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/07-인력-투입/07-CONTEXT.md`
- `.planning/phases/07-인력-투입/07-UI-SPEC.md`

확인할 결정:

- 이슈 트래커는 프로젝트 범위 기능이며 Paperclip/GitHub/WBS와 분리한다.
- 상태 enum은 `REGISTERED`, `IN_PROGRESS`, `DONE`이다.
- 우선순위 enum은 `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`이다.
- 담당자는 선택값이지만, 값이 있으면 현재 팀원이어야 한다.
- 필터는 백엔드가 소유하고 화면 목록과 Excel 내보내기가 공유한다.
- 상태 변경은 forward-only(`REGISTERED -> IN_PROGRESS -> DONE`)로 고정한다.
- 담당자 필터에는 명시적 `미배정` option을 포함한다.
- 삭제와 페이지네이션은 Stage 1 범위에서 제외한다.
- 댓글, 첨부파일, 알림, custom workflow, import, 보고서는 후속으로 미룬다.

현재 준비 상태:

- 수동 대응 결과가 이미 `08-CONTEXT.md`와 `08-DISCUSSION-LOG.md`에 반영되어 있다.

### 2. `$gsd-ui-phase 8`

8단계는 사용자-facing 프로젝트 허브 tab이며 로드맵에 `UI hint: yes`가 있으므로 반드시 사용한다.

UI 계약에 포함할 주제:

- 프로젝트 허브 `issues` tab을 `staffing` 뒤에 배치한다.
- 도구막대에는 생성, 새로고침, Excel 내보내기가 있어야 한다.
- 상태/우선순위/담당자 필터를 제공한다.
- 상태 전환 action이 있는 밀도 높은 issue table/list를 제공한다.
- 제목, 내용/설명, 우선순위, 담당자를 입력하는 create/edit dialog 또는 drawer를 제공한다.
- Viewer/read-only 동작을 명시한다.
- 내보내기 pending/success/error 상태를 명시한다.
- Page-level horizontal scroll 없이 반응형으로 동작해야 한다.
- `issues.*` 아래 ko/en i18n key를 사용한다.

재사용할 기존 참고 파일:

- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/wbs/WbsWorkspaceContent.tsx`
- `client/src/components/staffing/StaffingTab.tsx`
- `client/src/components/staffing/StaffingResourceDialog.tsx`
- `client/src/lib/download.ts`

### 3. `$gsd-plan-phase 8`

`08-CONTEXT.md`와 `08-UI-SPEC.md`가 존재한 뒤 사용한다.

계획이 반드시 다룰 항목:

- `project_issues` Flyway migration.
- `ProjectIssue`, `ProjectIssueStatus`, `ProjectIssuePriority` domain model.
- project/status/priority/assignee 기준 repository filtering.
- 생성/수정/상태 전환/목록/내보내기 service logic.
- 중첩 project route 아래 controller와 DTO.
- `ExcelUtils`를 사용하는 Excel 내보내기 service.
- 프론트엔드 `issuesApi.ts`, `types/issues.ts`, `queryKeys.issues`.
- Project hub tab wiring과 `client/src/components/issues/` 아래 component.
- Unit/controller/frontend test와 closeout 문서.

계획은 요구사항을 아래처럼 명시적으로 매핑해야 한다.

- `ISSUE-01`: 제목/내용/우선순위/담당자가 있는 이슈 생성.
- `ISSUE-02`: `REGISTERED -> IN_PROGRESS -> DONE` 상태 흐름.
- `ISSUE-03`: 상태/우선순위/담당자 필터.
- `ISSUE-04`: 현재 필터링된 목록의 Excel 내보내기.

### 4. `$gsd-review 8`

가능하면 실행 전에 사용한다.

검토 초점:

- 상태 의미: forward-only 전환 계약이 plan/API/UI 전반에서 깨지지 않는지.
- 팀원 제거 이후 담당자 membership 처리.
- 필터와 export의 parity.
- Stage 1 범위 밖인 삭제/페이지네이션이 우발적으로 plan에 다시 들어오지 않는지.
- Excel formula injection 또는 unsafe cell value 처리.
- 권한: viewer는 read/export 가능, write는 거부.
- Query/index 구조와 목록 크기 대응.
- UI 밀도와 mobile/tablet 동작.

### 5. `$gsd-plan-phase 8 --reviews`

`08-REVIEWS.md`가 있을 때 사용한다.

수정 계획은 검토 의견을 아래 영역에 반영해야 한다.

- `must_haves.truths`
- API error contract
- validation/test matrix
- UI acceptance criteria
- verification command

### 6. `$gsd-execute-phase 8`

구현은 백엔드 우선 순서가 적합하다.

1. Schema/enums/entity/repository.
2. Service validation, filtering, Excel 내보내기.
3. Controller/DTO/API test.
4. Frontend type/API/query key.
5. UI tab/component/i18n.
6. Unit/build/test 검증.
7. Summary와 planning state 업데이트.

실행 중 주의할 위험:

- 제품 코드에서 Paperclip issue 용어를 재사용해 도메인 소유권을 혼동시키지 않는다.
- 프론트엔드 Excel 생성을 직접 만들지 말고 서버 workbook download를 사용한다.
- 내보내기가 백엔드를 사용한다면 필터도 client-only로 만들지 않는다.
- 삭제, arbitrary status set, 페이지네이션을 8단계 v1에 끼워 넣지 않는다.
- 8단계에 보고서 생성, 댓글, 첨부파일을 추가하지 않는다.

### 7. `$gsd-validate-phase 8`

Nyquist validation은 모든 요구사항에 behavioral test 또는 명시적 smoke proof가 있는지 확인해야 한다.

필수 검증 row:

- 편집 가능한 팀원이 이슈를 생성할 수 있다.
- Viewer의 create/update/status/delete가 거부된다.
- 담당자는 현재 팀원이어야 한다.
- 상태 전환이 요구된 순서대로 동작한다.
- 상태, 우선순위, 담당자 필터를 조합할 수 있다.
- Excel 내보내기는 목록과 같은 필터를 사용한다.
- 빈 목록과 no-filter 상태가 올바르게 렌더링된다.

### 8. `$gsd-ui-review 8`

구현 후 screenshot/smoke가 가능한 시점에 사용한다.

검토 차원:

- Marketing/dashboard page가 아니라 밀도 높은 PM tool surface인지 확인한다.
- Filter, select/segmented status control, label 또는 tooltip이 있는 icon button 등 익숙한 control을 사용하는지 확인한다.
- Table text와 button이 mobile/desktop에서 부모 영역 안에 맞는지 확인한다.
- Page-level horizontal scroll이 없는지 확인한다.
- Read-only 상태가 명확하지만 과하게 시끄럽지 않은지 확인한다.

### 9. `$gsd-verify-work 8`

마감은 goal-backward 방식이어야 한다.

- `ISSUE-01`부터 `ISSUE-04`까지 요구사항이 완료로 체크되었거나, 증거와 함께 pending으로 명시되어야 한다.
- `08-VERIFICATION.md`는 실행한 test/build command를 정확히 기록해야 한다.
- `SUMMARY.md`는 전달 파일과 후속 non-blocking follow-up을 정리해야 한다.

## 권장 GSD 에이전트 역할

GSD orchestrator가 지원 환경에서 subagent를 사용한다면 유용한 역할은 다음과 같다.

- `gsd-ui-researcher`: `08-UI-SPEC.md` 작성.
- `gsd-ui-checker`: UI 계약 검증.
- `gsd-phase-researcher`: 구현 조사.
- `gsd-planner`: `08-01-PLAN.md` 작성.
- `gsd-plan-checker`: 계획 품질 검증.
- `gsd-executor`: 구현.
- `gsd-nyquist-auditor`: 요구사항/test coverage 검증.
- `gsd-ui-auditor`: 구현 후 시각 검토.
- `gsd-verifier`: 최종 goal-backward 검증.
- `gsd-integration-checker`: 8단계 데이터가 project hub 또는 이후 reporting surface와 연결될 때 통합 검증.

## 최소 다음 명령 set

이 준비 문서 이후 가장 짧은 구현 경로는 다음과 같다.

```bash
$gsd-ui-phase 8
$gsd-plan-phase 8
$gsd-review 8
$gsd-plan-phase 8 --reviews
$gsd-execute-phase 8
```

수동 fallback을 사용할 경우 `$HOME/.codex/skills/` 아래 관련 `SKILL.md`와 `$HOME/.codex/get-shit-done/workflows/` 아래 workflow markdown을 읽고 같은 순서로 적용한다.
