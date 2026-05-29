---
phase: 04
plan: 03
status: done
one_liner: "DiagramsPage에 사업 개요 탭을 도입하고 문서 허브 영역을 분리해 화면 구조를 재구성했다."
requirements-completed: [BIZ-01, BIZ-02]
key_files:
  created:
    - client/src/components/project/BusinessOverviewTab.tsx
    - client/src/components/workspace/DocumentHubTabContent.tsx
  modified:
    - client/src/pages/diagram/DiagramsPage.tsx
---

## What was done
- `BusinessOverviewTab`을 신설해 조회/편집 모드, 요약 카드(member/document/progress), 빈 상태, 유효성 검사, 저장 뮤테이션을 구현했다.
- 기존 DiagramsPage 문서 허브 렌더링/쿼리/다이얼로그 로직을 `DocumentHubTabContent`로 추출해 페이지 책임을 줄였다.
- `DiagramsPage`를 탭 기반(`documents`, `overview`)으로 재구성해 문서 허브와 사업 개요를 같은 프로젝트 워크스페이스에서 전환 가능하게 했다.
- 문서 탭 이탈 시 생성 다이얼로그를 닫는 탭 전환 처리와 프로젝트 히어로의 탭별 액션 분기를 적용했다.

## Key decisions
- 사업 개요 지표(`memberCount`, `documentCount`, `progressRate`)는 별도 prop 주입 대신 `BusinessOverviewTab`의 자체 쿼리 응답을 단일 소스로 사용했다.
- 문서 허브 기능은 독립 컴포넌트(`DocumentHubTabContent`)로 분리해 이후 WBS/마일스톤 탭 확장을 위한 페이지 구조를 준비했다.
- 편집 UX는 `isEditing` 상태로 읽기/편집을 명확히 분리하고, 저장 실패 시 편집 상태를 유지해 재시도를 가능하게 했다.
