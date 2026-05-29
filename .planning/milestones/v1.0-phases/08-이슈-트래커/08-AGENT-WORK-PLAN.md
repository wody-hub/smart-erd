# 8단계 이슈 트래커 에이전트 작업 계획

**대상 이슈:** RIS-190 phase 8
**작성일:** 2026-04-23
**문서 성격:** Paperclip 이슈에서 에이전트가 실행할 작업 계획서

## 요청 정리

- 이번 요청은 GSD 산출물을 한국어로 번역하는 작업이 아니다.
- GSD 관련 문서는 Phase 8 구현을 준비하기 위한 참고 자료로 유지한다.
- 이 문서는 Paperclip 이슈에서 에이전트가 실제 작업을 이어가기 위한 한국어 실행 계획이다.

## 목표

Smart ERD의 프로젝트 허브에 프로젝트 단위 이슈 트래커를 추가한다. 사용자는 프로젝트 이슈를 등록하고, 상태를 `등록 -> 처리중 -> 완료`로 진행시키며, 상태/우선순위/담당자로 목록을 필터링하고, 현재 필터링된 목록을 Excel로 내보낼 수 있어야 한다.

## 포함 범위

- 프로젝트별 이슈 목록 조회
- 제목, 내용, 우선순위, 선택 담당자를 포함한 이슈 등록
- 이슈 수정과 상태 변경
- 상태, 우선순위, 담당자 필터
- 담당자 필터 내 명시적 `미배정` option
- 현재 필터 조건과 동일한 Excel 내보내기
- 프로젝트 허브 `issues` 탭 추가
- 읽기 전용 사용자와 편집 가능 사용자의 권한 차이
- 한국어/영어 i18n 문구 추가
- 백엔드, 프론트엔드, API 경계 검증

## 제외 범위

- Paperclip, GitHub, Jira 같은 외부 이슈 시스템 연동
- WBS 항목과 이슈의 자동 동기화
- 댓글, 첨부파일, 멘션, 알림, watcher
- 이슈 삭제
- custom workflow, custom status, custom field
- 페이지네이션
- Kanban board, risk matrix, 보고서 생성
- Excel/CSV import
- 별도 활동 timeline 또는 상세 audit log

## 8.1 선행 체크

- `.planning/STATE.md`에는 Phase 8 계획/실행 착수를 Phase 3 closeout 순서 결정 이후로 보자는 메모가 남아 있다. 따라서 실제 착수 직전에는 현재 board 우선순위와 병행 가능 여부를 먼저 확인한다.
- 기술 선행 조건 측면에서는 Phase 4 이후의 프로젝트 허브, 팀 권한, PM 도메인 패턴을 재사용할 수 있으므로 문서화와 계획 수립 자체는 독립적으로 준비 가능하다.
- Phase 8 착수 시에는 `.planning/phases/08-이슈-트래커/08-CONTEXT.md`, `08-DISCUSSION-LOG.md`, `08-GSD-SKILLS.md`를 함께 참고한다.

## 8.2 Phase 8 착수 및 실행

1. `$gsd-discuss-phase 8 --auto`
   - 이슈 트래커를 Smart ERD 내부 PM 도메인으로 둘지, 상태/우선순위 enum, 담당자 membership 규칙, 필터와 Excel 내보내기 parity, v1 제외 범위를 먼저 고정한다.
2. `$gsd-ui-phase 8`
   - Phase 8은 `UI hint: yes`이고 project hub `issues` 탭, table/filter, dialog, 상태 전환, Excel 내보내기 UX가 핵심이므로 UI-SPEC을 먼저 확정한다.
3. `$gsd-plan-phase 8`
   - `project_issues` schema, backend service/API, frontend types/query/components, 테스트와 closeout 문서까지 포함한 실행 plan을 작성한다. 별도 `$gsd-research-phase 8`은 보통 필요 없고, `plan-phase`가 research를 포함한다.
4. `$gsd-review 8 --all`
   - Phase 8 plan에 대해 cross-AI review를 수행해 권한, membership, export/filter parity, 상태 전이, mobile/table density 위험을 먼저 점검한다.
5. `$gsd-plan-phase 8 --reviews`
   - review 결과를 반영해 재계획하되, Stage 1 scope freeze는 유지한다: 삭제 제외, 페이지네이션 제외, forward-only 상태 전이, 담당자 필터 내 `미배정` 노출.
6. `$gsd-execute-phase 8`
   - `project_issues` migration, entity/repository/service/controller, project hub `issues` 탭, filter/dialog/export UI, i18n, 테스트, planning closeout을 구현한다.
7. `$gsd-ui-review 8`
   - 구현 후 dense PM surface, read-only/export UX, 반응형 table/list 밀도, page-level overflow 유무를 retro audit한다.
8. `$gsd-validate-phase 8`
   - `ISSUE-01`부터 `ISSUE-04`까지 validation coverage를 audit하고, 생성/수정/상태 변경/필터/export/권한 검증이 빠지지 않았는지 확인한다.
9. `$gsd-verify-work 8`
   - 프로젝트 허브 사용자 관점에서 이슈 등록, 상태 전환, 필터, Excel 내보내기, read-only 제약이 실제 목표를 만족하는지 UAT 관점으로 검증한다.
10. `$gsd-ship`
    - 검증 완료 후 PR, review, merge 준비 단계로 넘기고 Phase 8 마감 문서를 정리한다.

## 8.3 압축 실행 순서

`.planning/STATE.md`의 우선순위 메모가 해소되면 아래 순서로 바로 이어서 실행한다.

```bash
$gsd-discuss-phase 8 --auto
$gsd-ui-phase 8
$gsd-plan-phase 8
$gsd-review 8 --all
$gsd-plan-phase 8 --reviews
$gsd-execute-phase 8
$gsd-ui-review 8
$gsd-validate-phase 8
$gsd-verify-work 8
$gsd-ship
```

## 요구사항 매핑

- `ISSUE-01`: 제목, 내용, 우선순위, 담당자를 가진 이슈 등록 기능
- `ISSUE-02`: `등록 -> 처리중 -> 완료` 상태 흐름
- `ISSUE-03`: 상태, 우선순위, 담당자 기준 필터링
- `ISSUE-04`: 현재 목록을 Excel 파일로 내보내기

## 주요 결정 기준

- 이슈 데이터는 Smart ERD 제품 내부 PM 도메인 데이터로 다룬다.
- Paperclip 이슈, GitHub 이슈, WBS 항목과 저장소를 공유하지 않는다.
- 필터링 의미는 백엔드가 소유한다.
- Excel 내보내기는 프론트엔드에서 workbook을 만들지 않고 서버에서 생성한다.
- 담당자는 선택값일 수 있지만, 값이 있다면 현재 팀원이어야 한다.
- v1은 작은 범위로 닫고, 협업형 이슈 센터 기능은 후속으로 미룬다.

## Stage 1 Scope Freeze

- 삭제 기능은 `ISSUE-01`부터 `ISSUE-04` 범위 밖이므로 8단계 v1에 포함하지 않는다.
- 목록은 페이지네이션 없이 시작하고, 서버 소유 필터/정렬 계약을 유지해 후속 단계에서 안전하게 추가할 수 있게 한다.
- 상태 변경은 `REGISTERED -> IN_PROGRESS -> DONE` 전진 액션만 허용한다. 임의 상태 선택, 역방향 전환, reopen은 후속 단계로 미룬다.
- 담당자 필터에는 현재 팀원 option과 함께 명시적 `미배정` option을 노출한다.

## 수용 기준

- 프로젝트 허브에서 이슈 탭에 접근할 수 있다.
- 편집 권한 사용자는 이슈를 등록하고 수정할 수 있다.
- 이슈 상태는 요구된 세 단계로 표시되고 변경된다.
- 상태, 우선순위, 담당자 필터를 조합할 수 있다.
- Excel 내보내기는 화면의 현재 필터 조건과 일치한다.
- 읽기 전용 사용자는 조회와 내보내기만 가능하고 쓰기 작업은 차단된다.
- 한국어와 영어 화면 문구가 모두 제공된다.
- 백엔드와 프론트엔드 검증 결과가 마감 문서에 기록된다.

## 다음 액션

이후 에이전트는 위 `8.2 Phase 8 착수 및 실행` 순서대로 진행하되, `Stage 1 Scope Freeze`를 변경하지 않고 UI/상세 구현만 구체화한다. review와 re-plan 단계는 권한, export/filter parity, validation coverage, table density 같은 실행 리스크를 줄이는 데 집중한다.
