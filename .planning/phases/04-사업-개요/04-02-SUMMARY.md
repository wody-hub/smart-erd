---
phase: 04
plan: 02
status: done
one_liner: "사업 개요 FE 데이터 계약(타입/API/쿼리키/포맷/i18n)을 추가해 UI 구현 기반을 완성했다."
requirements-completed: [BIZ-01, BIZ-02]
key_files:
  created:
    - client/src/lib/format.ts
  modified:
    - client/src/types/project.ts
    - client/src/api/projectApi.ts
    - client/src/constants/query-keys.ts
    - client/src/i18n/locales/ko/translation.json
    - client/src/i18n/locales/en/translation.json
---

## What was done
- `types/project.ts`에 `BusinessOverviewResponse`(11개 응답 필드)와 `UpdateBusinessOverviewPayload`(PATCH 6개 필드)를 추가했다.
- `projectApi.ts`에 `fetchBusinessOverview()`/`updateBusinessOverview()`를 추가해 신규 백엔드 엔드포인트를 FE에서 호출 가능하게 했다.
- React Query 키에 `projects.businessOverview(teamId, projectId)`를 추가해 캐시 무효화/재조회 경로를 분리했다.
- `format.ts`를 신설해 금액 포맷, 날짜 포맷, 날짜 쌍/순서 검증 유틸을 공통화했다.
- ko/en 번역 리소스에 `businessOverview` 네임스페이스를 추가해 필드 라벨/검증 문구/토스트 메시지를 정리했다.

## Key decisions
- BE 응답 스키마와 FE 타입을 1:1로 매핑해 중간 변환 객체 없이 계약 불일치 위험을 낮췄다.
- PATCH payload를 `Partial`이 아닌 명시적 인터페이스로 고정해 전송 필드 의도를 명확히 했다.
- 날짜/금액 포맷과 검증 로직을 컴포넌트 내부가 아닌 `client/src/lib/format.ts`로 추출해 재사용성과 테스트 용이성을 확보했다.
