# 계획 리뷰 결과: RIS-295 WBS/간트/마일스톤 개선

## 리뷰 대상

- [implementation-plan.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-28-RIS-295-WBS-간트-마일스톤-개선/implementation-plan.md)
- [RIS-292 비교 분석](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-04-28-RIS-292-WBS-간트-마일스톤-관계-분석/00-비교-분석.md)
- 현재 코드 진입점
  - [gantt-adapter.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/gantt/gantt-adapter.ts)
  - [GanttTab.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/gantt/GanttTab.tsx)
  - [WbsWorkspaceContent.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsWorkspaceContent.tsx)
  - [MilestonePanel.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/milestone/MilestonePanel.tsx)
  - [WbsItem.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/wbs/entity/WbsItem.java)
  - [Milestone.java](/Users/j.jaeyo/Project/ETC/smart-erd/src/main/java/com/smarterd/domain/pm/milestone/entity/Milestone.java)

## 체크 결과

| # | 항목 | 상태 | 비고 |
| --- | --- | --- | --- |
| 1 | RIS-292 문제 정의 반영 | PASS | dependency 부재, milestone gate 부족, rolling-wave 부재가 계획에 직접 반영됐다. |
| 2 | 기존 API 경계 보존 | PASS | `PUT /wbs/{id}` 와 `PATCH /wbs/reorder` 경계를 유지하고 dependency를 별도 엔터티로 분리했다. |
| 3 | 구현 순서 현실성 | PASS | 데이터 모델 -> API -> adapter -> UI -> QA 순서라 병목이 적다. |
| 4 | 과도한 범위 확장 억제 | PASS | CPM/고급 leveling/approval automation을 제외 범위로 명시했다. |
| 5 | QA 분리 가능성 | PASS | 승인 직후 QA child issue를 따로 만들 수 있게 체크리스트가 분리됐다. |

## Findings

- 발견 사항 없음

## 남은 판단 포인트

- `@svar-ui/react-gantt`의 link 표현 제약에 따라 9-B의 시각 강조 범위는 일부 조정될 수 있다.
- cycle 검증은 현재 계획대로면 서비스 레벨 DFS로 충분하지만, bulk import까지 열리면 후속 최적화가 필요하다.

## 종합 판정

- PASS: 구현 child issue를 열기 전 승인 요청을 보낼 수 있는 수준으로 계획이 잠겼다.

## 다음 액션

1. 이슈 document `plan` 업데이트
2. board/user 대상으로 계획 승인 `request_confirmation` 생성
3. 승인 후 child issue 5개 + QA issue 1개 생성
