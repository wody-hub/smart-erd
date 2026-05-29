---
phase: 06
plan: single
status: done
one_liner: "프로젝트 허브에 간트 탭을 통합하고 WBS/마일스톤 기반 일정 시각화와 날짜 드래그 저장을 완성했다."
requirements-completed: [GANTT-01, GANTT-02, GANTT-03, GANTT-04]
key_files:
  created:
    - client/src/components/gantt/GanttTab.tsx
    - client/src/components/gantt/gantt-adapter.ts
    - client/src/components/gantt/gantt-date-utils.ts
    - client/src/components/gantt/gantt-scale-presets.ts
    - client/src/components/gantt/gantt-update-guards.ts
    - client/src/components/gantt/gantt.css
    - client/test/unit/gantt-adapter.test.ts
    - client/test/unit/gantt-update-guards.test.ts
  modified:
    - client/package.json
    - client/package-lock.json
    - client/src/pages/diagram/DiagramsPage.tsx
    - client/src/i18n/locales/en/translation.json
    - client/src/i18n/locales/ko/translation.json
---

## What was done
- `DiagramsPage`에 `gantt` 탭을 추가하고 `@svar-ui/react-gantt`를 프로젝트 허브 안에 안전하게 마운트했다.
- WBS/마일스톤 데이터를 SVAR `task`/`summary`/`milestone` 모델로 변환하는 adapter와 date-only helper를 추가해 타임존 경계 오차 없이 기간을 렌더링하도록 만들었다.
- `[일/주/월/오늘]` 툴바, range preset, theme bridge(`all.css` + Willow/WillowDark + `wx-theme`)와 chart/grid 높이 계약을 적용했다.
- `update-task`, `drag-task`, `move-task` 인터셉트로 Phase 6 범위를 강하게 제한하고, 날짜 변경이 실제로 발생한 경우에만 기존 `updateWbsItem()` 경로로 저장하도록 연결했다.
- delayed milestone 색상 적용과 item tree column 안정화 이슈를 후속 수정으로 정리했고, progress-handle edit 차단 회귀도 `gantt-update-guards.ts`로 막았다.

## Key decisions
- 신규 백엔드 API나 DB 변경 없이 Phase 5의 WBS/마일스톤 API를 그대로 재사용했다.
- 날짜 처리는 `new Date('yyyy-MM-dd')`를 피하고 local date domain helper로 고정해 `UTC`/`KST`/`PST`에서 같은 날짜 문자열이 유지되도록 했다.
- WBS 순서는 raw 응답을 그대로 믿지 않고 기존 `wbs-tree-utils` flatten 순서를 재사용해 grid/chart/tree ordering을 맞췄다.
- delayed milestone 시각화는 SVAR DOM `data-id`가 인코딩된다는 점을 반영해 `setID()` 기반 매칭으로 보정했다.

## Verification
- `cd client && npm run build`
- `cd client && npm run test:unit` (`308/308` 통과)
- RIS-116 디자인 리뷰 PASS
- RIS-117 QA PASS (`GANTT-01..04`, 범위 밖 편집 차단, date-only round-trip 확인)
