# 8단계: 이슈 트래커 - 맥락

**수집일:** 2026-04-23
**상태:** UI 단계와 상세 계획 수립 준비 완료, Stage 1 scope freeze 반영
**방식:** `$gsd-discuss-phase 8 --auto`의 수동 Codex 대응. 현재 런타임에는 해당 셸 명령이 PATH에 설치되어 있지 않으므로, 로컬 GSD 논의 워크플로를 읽고 권장 기본값을 적용했다.

<domain>
## 단계 경계

8단계는 SI 프로젝트 실행 과정에서 발생하는 이슈를 프로젝트 단위로 관리하는 기능을 추가한다. 사용자는 프로젝트 이슈를 등록하고, 팀원에게 담당자를 배정하며, `등록 -> 처리중 -> 완료` 상태 흐름으로 이슈를 진행시키고, 상태/우선순위/담당자 기준으로 목록을 필터링한 뒤 현재 필터 조건의 이슈 목록을 Excel로 내보낼 수 있어야 한다.

이 기능은 Smart ERD 제품 내부의 프로젝트 관리 기능이다. Paperclip 태스크 시스템, GitHub 이슈, 소스코드 이슈 트래커와 통합하지 않는다. 기존 프로젝트 허브의 PM 화면군에 배치하고, 4단계의 프로젝트 컨텍스트, 6/6.1단계의 WBS 작업공간 패턴, 7단계의 인력 투입/팀원 선택 패턴, 기존 백엔드 Excel 내보내기 유틸리티를 재사용한다.

</domain>

<decisions>
## 구현 결정

### 이슈 데이터 소유권

- **D-01:** 이슈는 PM 도메인 아래 프로젝트 범위 행으로 저장한다. 패키지 후보는 `domain/pm/issue` 또는 `domain/pm/tracker`다.
- **D-02:** 각 이슈는 하나의 프로젝트에 속하며 `/api/teams/{teamId}/projects/{projectId}/issues` 경로로 접근한다.
- **D-03:** 조회와 내보내기는 `ProjectContextLoader.load(..., false)`를 사용하고, 생성/수정/삭제/상태 변경은 `load(..., true)`를 사용한다.
- **D-04:** 8단계 이슈 데이터는 Paperclip 이슈, GitHub 이슈, WBS 항목, 인력 투입 행과 분리한다.

### 필수 필드와 식별 정보

- **D-05:** v1 이슈의 최소 필드는 제목, 내용/설명, 우선순위, 상태, 선택 담당자다.
- **D-06:** 제목은 필수이며 길이 제한을 둔다. 내용/설명은 표시와 수정이 가능해야 한다. 최종 계획에서 명시적인 분류 흐름을 선택하면 빈 내용 또는 짧은 내용도 허용할 수 있다.
- **D-07:** 담당자는 `users` 행을 참조하며, 배정 또는 변경 시점에는 현재 팀원이어야 한다.
- **D-08:** 담당자가 나중에 팀에서 제거되어도 기존 이슈 행은 계속 보여야 한다. 새 배정은 팀원이 아닌 사용자에게 허용하지 않는다.

### 우선순위 모델

- **D-09:** 우선순위는 고정 enum `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`을 사용한다.
- **D-10:** 한국어 라벨은 `낮음`, `보통`, `높음`, `긴급`이고, 영어 i18n 라벨은 `Low`, `Medium`, `High`, `Critical`이다.
- **D-11:** 사용자가 명시적으로 선택하지 않으면 기본 우선순위는 `MEDIUM`이다.

### 상태 흐름

- **D-12:** 상태는 고정 enum `REGISTERED`, `IN_PROGRESS`, `DONE`을 사용한다.
- **D-13:** 한국어 라벨은 `등록`, `처리중`, `완료`이고, 영어 i18n 라벨은 `Registered`, `In progress`, `Done`이다.
- **D-14:** v1의 상태 변경 계약은 `REGISTERED -> IN_PROGRESS -> DONE` 순서의 전진 액션만 허용한다.
- **D-15:** 생성 시 기본 상태는 `REGISTERED`이며, 수정 UI나 API에서 임의 상태 선택 또는 역방향 전환을 허용하지 않는다.
- **D-16:** 재오픈, 취소, 중복, blocked, 커스텀 워크플로 상태는 후속 단계로 미룬다.

### 필터와 목록 계약

- **D-17:** 필터링 의미는 백엔드가 소유한다. 프론트엔드는 query parameter를 보내고 반환된 목록을 렌더링한다.
- **D-18:** 필수 필터는 상태, 우선순위, 담당자이며 서로 조합할 수 있어야 한다.
- **D-19:** 담당자 필터는 현재 팀원 목록과 함께 명시적인 `미배정` option을 같은 control 안에 제공한다.
- **D-20:** 기본 정렬은 결정적이어야 한다. 권장 순서는 미완료 이슈 우선(`REGISTERED`, `IN_PROGRESS`), 우선순위 높은 순, 최신 수정/생성 순이다.
- **D-21:** v1은 페이지네이션 없이 bounded project issue list + 서버 소유 필터로 시작한다. query contract는 이후 페이지네이션을 추가해도 filter/export parity가 깨지지 않게 유지한다.
- **D-22:** Excel 내보내기는 화면 목록과 같은 필터 계약을 사용해야 한다. 사용자가 보는 현재 이슈 목록과 내려받은 workbook이 일치해야 한다.

### Excel 내보내기

- **D-23:** `.xlsx` 파일은 기존 Apache POI / `ExcelUtils` 패턴을 사용해 서버에서 생성한다.
- **D-24:** 프로젝트 이슈 경로 아래에 다운로드 엔드포인트를 추가한다. 예: `GET /api/teams/{teamId}/projects/{projectId}/issues/download/excel`.
- **D-25:** 내보내기 컬럼은 최소한 상태, 우선순위, 제목, 담당자, 내용/설명, 생성일, 수정일을 포함한다.
- **D-26:** 기존 `Content-Disposition` 처리와 프론트엔드 `downloadBlob()` helper를 재사용한다.
- **D-27:** 8단계에서는 프론트엔드 spreadsheet 라이브러리를 새로 도입하지 않는다.

### UI와 작업 흐름

- **D-28:** 기존 프로젝트 허브에 `issues` 탭을 추가한다. PM 탭 묶음이 이어지도록 `staffing` 뒤에 배치한다.
- **D-29:** 필터와 도구막대 action이 있는 밀도 높은 운영형 목록/table을 사용한다. 마케팅형 페이지나 dashboard 우선 화면을 만들지 않는다.
- **D-30:** 이슈 생성/수정은 기존 Radix/shadcn 스타일 primitive를 사용한 dialog 또는 side panel로 제공한다.
- **D-31:** 상태 전환 control은 목록 행 또는 상세 dialog에서 바로 사용할 수 있게 한다. 단순 상태 진행을 위해 별도 페이지 이동을 요구하지 않는다.
- **D-32:** viewer/read-only 사용자는 조회와 내보내기는 가능하지만 생성, 수정, 배정, 상태 변경은 할 수 없다.
- **D-33:** 화면에 보이는 모든 문구는 `issues.*` namespace와 project-hub meta key 아래의 ko/en i18n을 거쳐야 한다.

### 이전 PM 단계와의 관계

- **D-34:** 4단계의 프로젝트/팀 권한 검증이 기본 의존성이다.
- **D-35:** WBS task와 이슈 행은 8단계에서 자동 동기화하지 않는다.
- **D-36:** 인력 투입 행은 사용자가 담당자를 고를 때 참고 맥락은 될 수 있지만, 8단계 배정 기준 데이터는 인력 투입 행이 아니라 팀원이다.
- **D-37:** v2 보고서 기능은 나중에 WBS 진척과 이슈 상태를 집계할 수 있다. 8단계는 깨끗한 status/priority 데이터를 제공하되 보고서 생성은 구현하지 않는다.

### 제외 범위

- **D-38:** 댓글, 첨부파일, mention, 알림, watcher, SLA/마감일 자동화, 이슈 template, custom field, kanban board, risk matrix, WBS-to-issue 변환, Paperclip/GitHub 통합, 보고서 생성을 제외한다.
- **D-39:** 이슈 삭제와 페이지네이션은 Stage 1 범위에서 제외한다.
- **D-40:** 기존 `BaseAuditEntity`의 생성/수정 metadata를 넘어서는 전체 활동 timeline/audit log는 제외한다.
- **D-41:** Excel/CSV import는 제외한다.

### 에이전트 재량 영역

- 정확한 패키지 이름은 `pm/issue`, `pm/projectissue`, `pm/tracker` 중 코드베이스에 가장 자연스러운 이름을 선택한다. 단, PM 도메인 안에 두고 Paperclip 이슈와 혼동되지 않아야 한다.
- 생성/수정 UI를 dialog로 할지 drawer로 할지는 구현자가 정한다. 기존 프로젝트 허브 패턴과 맞아야 한다.
- table 밀도, badge, filter control 배치는 구현자가 정한다. 필수 필터가 일급 기능이고 반응형이어야 한다.
- 담당자 필터의 `미배정` option을 단일 선택 select로 둘지 multi-select/checkbox group 안의 한 option으로 둘지는 구현자가 정한다. 단, 팀원 option과 같은 필터 흐름 안에서 노출되어야 한다.

</decisions>

<canonical_refs>

## 표준 참고 문서

**후속 에이전트는 계획 또는 구현 전에 아래 문서를 반드시 읽어야 한다.**

### 계획과 단계 범위

- `.planning/PROJECT.md` - SI 프로젝트 관리 제품 경계와 협업/커뮤니케이션 기능 영역.
- `.planning/REQUIREMENTS.md` - `ISSUE-01`부터 `ISSUE-04`까지의 요구사항과 이후 보고서 기능이 소비할 이슈 상태 의존성.
- `.planning/ROADMAP.md` - 8단계 목표, 4단계 의존성, 성공 기준, UI 힌트.
- `.planning/STATE.md` - 현재 프로젝트 상태, 7단계 마감, 3단계 마감 관련 주의사항.
- `.planning/phases/07-인력-투입/07-CONTEXT.md` - 이전 단계의 논의 스타일, 팀원 자격 정책, 프로젝트 허브 확장 방식.
- `.planning/phases/07-인력-투입/07-UI-SPEC.md` - 8단계 UI가 맞춰야 할 운영형 PM 탭 설계 계약.
- `.planning/phases/07-인력-투입/SUMMARY.md` - 7단계 마감과 검증 기준선.

### 백엔드 패턴

- `src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java` - 재사용 가능한 read/write 권한 gate.
- `src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java` - PM entity 스타일, enum/validation 스타일, nullable 담당자/date 필드.
- `src/main/java/com/smarterd/domain/pm/wbs/service/WbsService.java` - 담당자 팀원 검증, entity 조회, PM service 스타일.
- `src/main/java/com/smarterd/api/project/WbsController.java` - 중첩 project route 규칙.
- `src/main/java/com/smarterd/domain/pm/staffing/service/ProjectStaffingService.java` - 현재 팀원 검증과 7단계 response aggregation 스타일.
- `src/main/java/com/smarterd/api/project/ProjectStaffingController.java` - 최신 project-hub API 규칙.
- `src/main/java/com/smarterd/domain/team/repository/TeamMemberRepository.java` - 현재 팀원 존재 여부 확인 API.
- `src/main/java/com/smarterd/utils/ExcelUtils.java`와 `src/main/java/com/smarterd/utils/excel/ExcelDataMethodSet.java` - 서버 측 Excel 생성/download helper.
- `src/main/java/com/smarterd/api/dictionary/WordController.java` - 기존 Excel download endpoint 패턴.

### 프론트엔드 패턴

- `client/src/pages/diagram/DiagramsPage.tsx` - `issues` 탭을 추가할 프로젝트 허브 tab shell.
- `client/src/components/wbs/WbsTab.tsx`와 `client/src/components/wbs/WbsWorkspaceContent.tsx` - 밀도 높은 PM 목록/작업공간 패턴.
- `client/src/components/staffing/StaffingTab.tsx` - 7단계 React Query mutation, refresh, read-only 상태, tab 구성.
- `client/src/components/staffing/StaffingResourceDialog.tsx` - 팀원 선택이 있는 생성/수정 dialog 패턴.
- `client/src/api/wbsApi.ts`와 `client/src/api/staffingApi.ts` - API 함수와 JSDoc 스타일.
- `client/src/constants/query-keys.ts` - `issues`를 추가할 React Query key 계층.
- `client/src/hooks/useProjectQueryInvalidation.ts` - 이후 이슈 count/status가 프로젝트 요약에 영향을 줄 경우 확장할 project-scoped invalidation helper.
- `client/src/lib/download.ts` - blob download와 filename 추출 helper.
- `client/src/i18n/locales/ko/translation.json`와 `client/src/i18n/locales/en/translation.json` - 화면 문구를 추가할 위치.

</canonical_refs>

<code_context>

## 기존 코드 맥락

### 재사용 자산

- `ProjectContextLoader`는 이미 팀/프로젝트 권한 검증을 중앙화하므로 재사용한다.
- `TeamMemberRepository.existsByTeamAndUser(...)`는 현재 팀원 자격 확인 방식이다. 지금 도메인에는 inactive/pending 상태가 없다.
- `WbsService.resolveAssignee(...)`는 가장 가까운 기존 담당자 검증 모델이다.
- `ProjectStaffingService`는 현재 PM 기능 패턴을 보여준다: thin controller, domain service, repository, response DTO, React Query tab UI.
- `ExcelUtils.download(...)`와 `downloadBlob(...)`는 서버 workbook 전달과 브라우저 download 문제를 이미 해결한다.
- `queryKeys`에는 이미 project-scoped `wbs`, `milestones`, `staffing` key가 있으므로 같은 계층에 `issues`를 추가한다.

### 확립된 패턴

- PM 기능 endpoint는 `/api/teams/{teamId}/projects/{projectId}/...` 아래에 둔다.
- 프론트엔드 API 함수는 `/api`를 생략한다. `axiosInstance`가 base URL을 소유한다.
- 백엔드 controller는 얇게 유지하고 validation annotation이 있는 DTO record를 사용한다.
- 도메인 service는 class-level `@Transactional(readOnly = true)`와 write method의 `@Transactional`을 사용한다.
- 도메인 validation은 hard-coded text가 아니라 localized `MessageCode`를 던진다.
- 프론트엔드 UI는 React Query, sonner toast, local `Button`/`Dialog`/`Select`/`Table` primitive, lucide icon, i18n을 사용한다.
- 프론트엔드 API 파일은 `lint:docs` 검증 때문에 JSDoc이 필요하다.

### 통합 지점

- `src/main/java/com/smarterd/domain/pm/issue/**` 또는 동등한 백엔드 package를 추가한다.
- `src/main/java/com/smarterd/api/project/**` 아래에 controller와 DTO를 추가한다.
- `project_issues` table migration을 추가한다. 필드는 project FK, optional assignee FK, status enum string, priority enum string, title, description/content, audit field, project-filter index를 포함한다.
- `client/src/types/issues.ts`, `client/src/api/issuesApi.ts`, `queryKeys.issues.all(teamId, projectId, filters)`, project-hub `issues` tab wiring을 추가한다.
- `client/src/components/issues/*` 아래에 tab, filter, table/list, create/edit dialog, status action control, export action을 추가한다.
- tab label, filter, status, priority, validation, toast, empty state, export에 대한 한국어/영어 translation key를 추가한다.

</code_context>

<specifics>
## 구체 아이디어

- 상태 필터는 자유 텍스트 input이 아니라 compact segmented control 또는 checkbox가 적합하다.
- 우선순위는 큰 card가 아니라 절제된 semantic color의 작은 badge로 보여준다.
- 담당자 필터는 팀원 option을 사용하고, v1에서 미배정을 허용한다면 `미배정` option을 포함한다.
- 이슈 table은 필요하면 local horizontal scroll을 사용한다. 일반 desktop project-hub 폭에서는 page-level horizontal scroll 없이 맞아야 한다.
- Excel 내보내기는 active filter state를 query param에 포함하고, download 중에는 pending 상태를 표시하거나 버튼을 비활성화한다.
- 상태별 요약 count strip은 유용할 수 있지만, 요구사항 핵심 화면은 table/filter workflow다.

</specifics>

<deferred>
## 후속 아이디어

- 댓글, 첨부파일, mention, 알림, watcher, 마감일 reminder.
- Kanban board 또는 drag-and-drop 상태 lane.
- Custom workflow, custom status, custom field, tag, priority와 별도 severity, risk matrix.
- WBS item, milestone, staffing row, 문서와의 issue link.
- Excel/CSV import.
- 보고서 생성. 8단계는 이후 보고서 단계가 집계할 수 있는 status 데이터를 제공하는 데 집중한다.
- Paperclip/GitHub/Jira 통합.
- reopen/cancel/blocked lifecycle 상태.

</deferred>

---

_단계: 08-이슈-트래커_
_맥락 수집일: 2026-04-23_
