---
phase: 04
plan: 01
status: done
one_liner: "Project 엔티티/서비스/API를 확장해 business-overview 조회/수정 백엔드 기능을 도입했다."
key_files:
  created:
    - src/main/resources/db/migration/V20260414_01__project_business_overview_columns.sql
    - src/main/java/com/smarterd/api/project/dto/BusinessOverviewResponse.java
    - src/main/java/com/smarterd/api/project/dto/UpdateBusinessOverviewRequest.java
  modified:
    - src/main/java/com/smarterd/domain/project/entity/Project.java
    - src/main/java/com/smarterd/domain/project/service/ProjectService.java
    - src/main/java/com/smarterd/api/project/ProjectController.java
    - src/main/java/com/smarterd/domain/diagram/repository/DiagramRepository.java
    - src/main/java/com/smarterd/domain/team/repository/TeamMemberRepository.java
    - src/main/java/com/smarterd/domain/team/service/TeamService.java
    - src/main/java/com/smarterd/domain/common/message/MessageCode.java
    - src/main/resources/i18n/messages.properties
    - src/main/resources/i18n/messages_ko.properties
---

## What was done
- `V20260414_01__project_business_overview_columns.sql`로 `projects` 테이블에 사업 개요 6개 nullable 컬럼을 추가했다.
- `Project` 엔티티에 사업 개요 필드와 `updateBusinessOverview()`를 추가하고, 시작일/종료일 역전(`startDate > endDate`) 도메인 검증을 포함했다.
- `ProjectService`에 `getBusinessOverview()`/`updateBusinessOverview()`를 추가해 팀 권한 검증 후 사업 개요 + 요약 지표(멤버 수, 문서 수)를 반환하도록 했다.
- `ProjectController`에 `GET/PATCH /api/teams/{teamId}/projects/{projectId}/business-overview`를 추가하고 DTO/Bean Validation을 연결했다.
- 메시지 코드와 다국어 메시지(`messages*.properties`)를 확장해 사업 개요 검증 실패 케이스를 명시했다.

## Key decisions
- 날짜 순서 불변식은 서비스가 아닌 엔티티(`Project.updateBusinessOverview`)에서 강제해 도메인 경계 내 일관성을 유지했다.
- 기존 `PUT /projects/{projectId}`와 분리해 사업 개요는 `PATCH /business-overview` 전용 엔드포인트로 관리했다.
- `ProjectService`가 `TeamMemberRepository`를 직접 주입하지 않고 `TeamService.countMembers()`를 통해 멤버 수를 조회하도록 계층 의존을 유지했다.

