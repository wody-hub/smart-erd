# 8단계: 이슈 트래커 - 논의 기록

> **감사용 기록 전용.** 계획, 조사, 실행 에이전트의 기본 입력으로 쓰지 않는다.
> 결정 사항은 `08-CONTEXT.md`에 정리되어 있으며, 이 문서는 검토한 대안과 선택 이유를 보존한다.

**일자:** 2026-04-23
**단계:** 08-이슈-트래커
**논의 영역:** 이슈 데이터 소유권, 상태 흐름, 우선순위 모델, 담당자 의미, 필터/내보내기 계약, UI 화면, 제외 범위
**방식:** `$gsd-discuss-phase 8 --auto` 수동 대응

---

## 실행 메모

현재 작업공간에서는 `$gsd-discuss-phase` 명령을 PATH에서 바로 실행할 수 없었다. 대신 아래 로컬 GSD 스킬과 도구로 단계를 확인했다.

- `/Users/j.jaeyo/.codex/skills/gsd-discuss-phase/SKILL.md`
- `/Users/j.jaeyo/.codex/get-shit-done/workflows/discuss-phase.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" init phase-op 8`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase 8`

이슈 요청은 7단계처럼 8단계 내용을 분석하고 진행할 GSD 스킬 목록을 미리 정리하라는 것이었다. 따라서 roadmap이 강제하지 않은 회색 지대는 권장 기본값을 선택했고, 그 선택 이유를 아래에 남긴다.

---

## 이슈 데이터 소유권

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 프로젝트 범위 PM 이슈 table | 이슈 행을 프로젝트 PM 도메인 아래 직접 저장한다 | 예 |
| Paperclip 이슈 재사용 | Smart ERD 프로젝트 이슈를 Paperclip/company task record로 취급한다 | 아니오 |
| WBS 항목 재사용 | 특수 status/priority 필드가 있는 WBS task로 이슈를 모델링한다 | 아니오 |

**자동 선택:** 프로젝트 범위 PM 이슈 table

**메모**

- 8단계는 Smart ERD 사용자를 위한 제품 기능이며 Paperclip 회사 업무 조율 기능이 아니다.
- WBS 항목은 이미 계획된 프로젝트 작업을 의미한다. 이슈는 실행 중 발생한 문제/조치 항목이므로 별도 상태 흐름이 필요하다.
- 프로젝트 범위 table은 이후 보고서 집계를 단순하게 만든다.

---

## 상태 흐름

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 세 가지 고정 상태 | `REGISTERED -> IN_PROGRESS -> DONE`만 사용한다 | 예 |
| 확장 상태 set | blocked/cancelled/reopened/duplicate 등을 추가한다 | 아니오 |
| Custom workflow | 팀 또는 프로젝트 설정이 상태를 정의한다 | 아니오 |

**자동 선택:** 세 가지 고정 상태

**메모**

- roadmap은 명시적으로 `등록 -> 처리중 -> 완료`를 요구한다.
- 추가 상태는 유용하지만 UI, validation, export, 보고서 의미를 모두 확장한다.
- v1은 테스트와 설명이 쉬운 상태 흐름으로 닫는 편이 낫다.

---

## 우선순위 모델

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 네 가지 고정 우선순위 | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | 예 |
| 세 가지 고정 우선순위 | low/medium/high만 사용한다 | 아니오 |
| 숫자 rank | 자유 numeric severity 또는 score를 사용한다 | 아니오 |

**자동 선택:** 네 가지 고정 우선순위

**메모**

- 네 단계는 일반 운영 도구와 잘 맞고, 정말 긴급한 항목을 분리할 수 있다.
- 우선순위는 필수 필터 차원이므로 고정 enum이 index, translation, export에 유리하다.
- severity/risk category는 후속 범위로 미룬다.

---

## 담당자 의미

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 선택 담당자 | 이슈는 triage를 위해 미배정일 수 있고, 배정된 사용자는 팀원이어야 한다 | 예 |
| 필수 담당자 | 모든 이슈는 생성 시점부터 책임 팀원이 있어야 한다 | 아니오 |
| Staffing row 담당자 | 이슈 담당자는 7단계 staffing row에서만 선택한다 | 아니오 |

**자동 선택:** 선택 담당자

**메모**

- 요구사항은 제목/내용/우선순위/담당자 등록을 말하지만, SI 이슈 접수는 미배정 상태로 시작하는 경우가 많다.
- 팀원 멤버십이 현재 사용자 자격 기준이다. staffing row는 프로젝트 배정/비용 record이지 identity/assignment master가 아니다.
- 배정된 사용자가 나중에 팀에서 제거되어도 기존 이슈는 이력으로 유지한다. 새 배정은 비팀원에게 허용하지 않는다.

---

## 필터와 내보내기 계약

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 서버 소유 필터 + 동일 query export | UI와 Excel download가 status/priority/assignee query parameter를 공유한다 | 예 |
| Client-only 필터 | 백엔드는 모든 이슈를 반환하고 UI만 로컬 필터링한다 | 아니오 |
| 전체 프로젝트 이슈 export | Excel은 현재 필터를 무시한다 | 아니오 |

**자동 선택:** 서버 소유 필터와 동일 filter state 내보내기

**메모**

- 요구사항은 현재 이슈 목록을 내보낸다고 말한다. 따라서 내보내기는 active filter와 일치해야 한다.
- 서버 측 필터는 테스트하기 쉽고 이후 pagination을 넣기 좋다.
- Client-only 필터는 이슈 수가 늘거나 pagination이 추가될 때 쉽게 drift가 생긴다.

---

## UI 화면

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 프로젝트 허브 tab | WBS/Gantt/Staffing 옆에 이슈 트래커 tab을 추가한다 | 예 |
| 전용 route 우선 | 즉시 별도 full-page tracker route를 만든다 | 아니오 |
| Dashboard card 우선 | status/priority card를 주 화면으로 만든다 | 아니오 |

**자동 선택:** 프로젝트 허브 tab

**메모**

- 7단계는 staffing을 프로젝트 허브 안에 추가했다. 8단계도 같은 패턴을 이어가는 것이 자연스럽다.
- 요구사항 핵심 흐름은 list/filter/create/status/export이므로 dashboard 우선 화면보다 밀도 높은 운영형 화면이 맞다.
- 이슈 트래커가 kanban/reporting까지 확장되면 전용 route를 후속으로 추가할 수 있다.

---

## 8단계 제외 범위

| 선택지 | 설명 | 선택 |
|--------|------|------|
| 이슈 트래커 v1만 | create/status/filter/export에 집중한다 | 예 |
| 협업형 이슈 센터 | 댓글, 첨부파일, mention, 알림까지 포함한다 | 아니오 |
| 보고서 package | 일일/주간 보고서와 이슈 rollup을 함께 만든다 | 아니오 |

**자동 선택:** 이슈 트래커 v1만

**메모**

- 보고서는 명시적으로 v2 요구사항이다.
- 댓글/첨부파일/mention은 가치가 있지만 `ISSUE-01`부터 `ISSUE-04`까지를 만족하는 데 필수는 아니다.
- 4~7단계에서 이미 PM 기능이 넓게 추가되었으므로, 8단계는 실행과 검증이 가능한 작은 범위로 닫아야 한다.

---

## 2026-04-23 Stage 1 scope freeze

| 결정 항목 | 확정안 | 이유 |
|-----------|--------|------|
| 삭제 포함 여부 | v1 제외 | 요구사항이 `ISSUE-01`부터 `ISSUE-04`까지로 한정되어 있고, 삭제는 확인 dialog/권한/감사 흔적까지 확장되어 별도 범위가 된다 |
| 페이지네이션 시점 | v1 제외 | 서버 소유 필터로도 현재 요구사항을 충족할 수 있고, 목록/Excel parity를 단순하게 유지할 수 있다 |
| 상태 변경 방식 | forward-only | roadmap이 요구한 `등록 -> 처리중 -> 완료` 흐름에 가장 직접적으로 맞고 테스트 계약이 단순해진다 |
| 미배정 담당자 필터 | 노출 | 담당자가 선택값이기 때문에 triage 중인 이슈를 찾으려면 `미배정`이 일급 필터여야 한다 |

**추가 메모**

- 생성 시 기본 상태는 `REGISTERED`로 두고, 수정 폼이나 일반 edit API에서 임의 status set은 허용하지 않는다.
- 이후 단계에서 페이지네이션을 추가하더라도 filter/export query 의미는 바꾸지 않는다.
- `미배정`은 별도 숨겨진 토글이 아니라 담당자 필터 흐름 안에서 보여야 한다.

---

## 에이전트 재량 영역

- `domain/pm` 아래 정확한 package 이름.
- 이슈 상세를 dialog로 열지 drawer로 열지.
- 필수 컬럼과 filter parity를 유지하는 범위 안에서의 export workbook styling.
- 담당자 필터 control의 구체 형태(select, combobox, checkbox group).

## 후속 아이디어

- 댓글, 첨부파일, mention, 알림, watcher.
- Kanban lane, custom workflow state, reopen/cancel/blocked 상태.
- WBS/milestone/document/staffing row와의 link.
- Excel 또는 CSV issue import.
- 보고서 생성과 자동 report aggregation.
- 외부 issue tracker 통합.

## 막힌 질문

준비 작업 기준으로 막힌 질문은 없다. RIS-193에서 삭제, 페이지네이션, 상태 전이 방식, `미배정` 필터 노출 여부를 scope freeze로 확정했으므로, 이후 단계는 UI 세부 표현과 검증 범위를 구체화하면 된다.
