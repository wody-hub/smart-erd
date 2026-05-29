---
phase: 05
plan: single
status: done
one_liner: "WBS/마일스톤 도메인·API·UI와 프로젝트 진척도 연동을 한 번에 구현해 PM 기능을 가동했다."
requirements-completed: [WBS-01, WBS-03, WBS-04, WBS-05, MILE-01, MILE-02, MILE-03, MILE-04]
key_files:
  created:
    - src/main/resources/db/migration/V20260414_02__phase5_wbs_milestone_tables.sql
    - src/main/java/com/smarterd/api/project/WbsController.java
    - src/main/java/com/smarterd/api/project/MilestoneController.java
    - src/main/java/com/smarterd/domain/pm/wbs/service/WbsService.java
    - src/main/java/com/smarterd/domain/pm/milestone/service/MilestoneService.java
    - src/main/java/com/smarterd/domain/project/service/ProjectProgressProvider.java
    - src/main/java/com/smarterd/domain/pm/wbs/service/WbsProgressProvider.java
    - src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java
    - client/src/components/wbs/WbsTab.tsx
    - client/src/components/milestone/MilestonePanel.tsx
    - client/src/hooks/useProjectQueryInvalidation.ts
  modified:
    - src/main/java/com/smarterd/domain/project/service/ProjectService.java
    - src/main/java/com/smarterd/api/project/dto/BusinessOverviewResponse.java
    - client/src/pages/diagram/DiagramsPage.tsx
    - client/src/constants/query-keys.ts
    - client/src/i18n/locales/ko/translation.json
    - client/src/i18n/locales/en/translation.json
    - client/src/lib/format.ts
---

## What was done
- `V20260414_02__phase5_wbs_milestone_tables.sql`로 `milestones`, `wbs_items` 테이블과 인덱스/체크 제약(depth, progress_rate, estimated_mm, period)을 추가했다.
- 백엔드에 WBS/마일스톤 CRUD + reorder API(`WbsController`, `MilestoneController`)와 DTO/서비스/리포지토리(QueryDSL custom)를 구현했다.
- `WbsService`에서 트리 정렬/재부모화/깊이 검증/사이클 방지 로직을 포함한 재정렬 처리와 도메인 검증을 완성했다.
- `MilestoneService`에서 연결 WBS 집계를 기반으로 달성률/지연 여부를 계산하고, 삭제 시 WBS 참조 정리를 수행했다.
- `ProjectService`의 사업 개요 진행률을 `ProjectProgressProvider` 인터페이스로 분리하고 `WbsProgressProvider` 구현으로 WBS 평균 진척률을 연동했다.
- 프론트엔드에 `WbsTab`, `MilestonePanel`, DnD 재정렬 유틸, 폼 다이얼로그, API/타입/번역/쿼리키를 추가해 탭 UI를 통합했다.
- 커밋 `0bb81d4`에서 검증으로 지정된 테스트 세트(`MilestoneControllerMvcTest`, `WbsControllerMvcTest`, `MilestoneServiceTest`, `WbsServiceTest`, `ProjectServiceTest`)와 `client` 빌드가 수행됐다.

## Key decisions
- 프로젝트 도메인이 PM 도메인 구현체에 직접 의존하지 않도록 `ProjectProgressProvider` DIP 경계를 도입했다.
- WBS/마일스톤 서비스의 중복 권한/소속 검증을 `ProjectContextLoader`로 추출해 동일한 인증 흐름을 강제했다.
- WBS 재정렬은 서버(`computeDepth`)와 클라이언트(`buildReorderPayload`) 양쪽에서 깊이/부모/정렬 유효성을 방어하도록 설계했다.
- 마일스톤 지연 판단은 `Clock` 주입 기반 `targetDate < today && achievementRate < 100` 규칙으로 테스트 가능성을 확보했다.
