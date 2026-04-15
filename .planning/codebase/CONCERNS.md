# Codebase Concerns

**Analysis Date:** 2026-04-02

## Active Tech Debt

**Diagram 엔티티의 content/ydocSnapshot 이중 저장:**
- Issue: `content` (TEXT)와 `ydocSnapshot` (BYTEA)이 동일 데이터의 두 가지 표현으로 공존. Yjs 안정화 후 content는 export 전용으로 전환 예정이나 아직 미착수.
- Files: `src/main/java/com/smarterd/domain/diagram/entity/Diagram.java:64`
- Impact: 저장 시 양쪽 모두 갱신해야 하며, 불일치 시 데이터 정합성 위험. snapshot이 null이면 content에서 복원하는 fallback 로직 필요.
- Fix approach: Yjs 안정화 후 content 필드를 export 전용으로 전환하는 마이그레이션 전략 수립 (TODO 코멘트에 명시됨).

**코드 모드 shared draft의 debounce 기반 서버 영속화:**
- Issue: 코드 모드 shared draft가 debounce 기반(1500ms)으로 서버에 영속화되므로, 이 윈도우 내 서버 장애 시 최신 draft가 유실될 수 있다.
- Files: `client/src/constants/code-sync.ts:16`
- Impact: 서버 재기동/장애 시 최신 code 모드 draft 유실 가능.
- Fix approach: 구조 변경 감지 즉시 저장 또는 더 짧은 저장 정책으로 재설계 (TODO 코멘트에 명시됨).

**Frontend Export API 미연결:**
- Issue: `MarkdownToolbar.tsx`에 `onExport` 핸들러가 존재하나, `diagramApi.ts`에 실제 POST `/exports` 호출 함수가 없다. 백엔드 엔드포인트는 구현 완료.
- Files: `client/src/api/diagramApi.ts`, `client/src/components/markdown/MarkdownToolbar.tsx`
- Impact: 마크다운 문서의 export 기능이 프론트엔드에서 동작하지 않음.
- Fix approach: `diagramApi.ts`에 `exportDocument()` 함수 추가 및 UI 연결 (잔여 작업 T1).

**증분 동기화(Section-Update) 미구현:**
- Issue: Y.Text 동기화가 전체 문서 교체 방식(delete-all/insert-all). 동시 편집 시 CRDT 병합 품질 저하, O(문서크기) 네트워크 비용.
- Files: `client/src/collaboration/yjs/markdown-yjs-document-adapter.ts`
- Impact: 대용량 문서에서 협업 성능 저하. 같은 섹션 편집 시 문자 단위 CRDT 병합 불가.
- Fix approach: Phase 7(증분 동기화) 구현. `diff-match-patch` 도입하여 변경 범위만 Y.Text에 적용 (선행 조건 Phase 6 완료됨, 즉시 착수 가능).

**증분 프리뷰 렌더링 미구현 (Phase 9-B):**
- Issue: 프리뷰 렌더링이 매 변경마다 전체 문서를 파싱. 비동기 Worker(Phase 9-A)는 완료되었으나 증분 렌더링은 미착수.
- Files: `client/src/components/markdown/MarkdownPreviewPane.tsx`
- Impact: 5,000줄+ 대용량 문서에서 프리뷰 지연 가능 (현재 Web Worker로 메인 스레드 차단은 방지됨).
- Fix approach: Phase 7 완료 후 section index를 활용한 증분 프리뷰 구현.

## Architecture Concerns

**`ddl-auto: update` 프로덕션 위험:**
- Issue: `application.yml`에서 `ddl-auto: update`를 사용. 프로덕션 환경에서 Hibernate가 스키마를 자동 변경할 수 있어 위험.
- Files: `src/main/resources/application.yml:51`
- Impact: 프로덕션 배포 시 예기치 않은 스키마 변경, 데이터 유실 위험. Flyway 마이그레이션 파일이 존재하지만(`src/main/resources/db/migration/`) Flyway 자체는 활성화되어 있지 않음.
- Fix approach: 프로덕션 프로파일에서 `ddl-auto: validate`로 전환하고 Flyway를 활성화하여 마이그레이션 관리.

**Diagram 엔티티가 ERD와 마크다운 문서를 모두 포함:**
- Issue: `Diagram` 엔티티 하나가 ERD(`content` = React Flow JSON)와 마크다운 문서(`pluginId = MARKDOWN`)를 모두 담당. `pluginId` 필드로 구분하지만, ERD 전용 필드(`content`)와 마크다운 전용 필드(`templateKey`, `summaryText`)가 혼재.
- Files: `src/main/java/com/smarterd/domain/diagram/entity/Diagram.java`
- Impact: 엔티티가 비대해지고, 플러그인별 null 허용 필드가 늘어남. 새 문서 타입 추가 시 엔티티 수정 필요 (OCP 위반 가능성).
- Fix approach: 후속 작업으로 API/엔티티 naming을 `diagram` -> `document`로 정리하는 계획이 이미 수립됨.

**대형 프론트엔드 파일:**
- Issue: 일부 파일이 과도하게 큼. 복잡도와 유지보수 난이도 증가.
- Files:
  - `client/src/components/erd/DslCodeEditorPanel.tsx` (2,555줄)
  - `client/src/collaboration/plugins/erd/erd-document-mutation-applier.ts` (1,419줄)
  - `client/src/lib/ddl-parser.ts` (1,180줄)
  - `client/src/components/erd/ERDCanvas.tsx` (1,106줄)
  - `client/src/lib/dsl-parser.ts` (1,012줄)
  - `client/src/lib/erd-diff-apply.ts` (996줄)
  - `client/src/stores/canvas/canvasSyncActions.ts` (929줄)
- Impact: 변경 시 충돌 가능성 높음, 단위 테스트 작성 어려움, 코드 리뷰 부담.
- Fix approach: 기능별 모듈 분리. 특히 파서(`ddl-parser.ts`, `dsl-parser.ts`)는 단계별 파싱 로직을 별도 모듈로 추출 가능.

**대형 백엔드 서비스 파일:**
- Issue: 일부 서비스 클래스가 과도하게 큼.
- Files:
  - `src/main/java/com/smarterd/domain/dictionary/service/AbstractBulkService.java` (1,210줄)
  - `src/main/java/com/smarterd/domain/dictionary/service/DomainBulkService.java` (745줄)
  - `src/main/java/com/smarterd/utils/excel/ExcelWriter.java` (740줄)
  - `src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotService.java` (712줄)
  - `src/main/java/com/smarterd/domain/diagram/service/DiagramService.java` (557줄)
- Impact: SRP 위반 가능성. 테스트 설정 복잡도 증가.
- Fix approach: `AbstractBulkService`는 전략 패턴으로 공통 로직 추출, `DiagramService`는 UseCase 단위로 분리 검토.

## Security Considerations

**JWT 토큰 localStorage 저장:**
- Risk: localStorage에 JWT Access/Refresh Token을 저장하여 XSS 공격에 노출 가능.
- Files: `client/src/stores/useAuthStore.ts:39-48`, `client/src/api/axiosInstance.ts:15`
- Current mitigation: DOMPurify로 HTML sanitization 적용 (`dompurify` 의존성 존재), CSP connect-sources 설정 가능.
- Recommendations: httpOnly cookie 기반 토큰 저장 전환 검토. 현재 Electron 앱 지원 때문에 localStorage를 사용하는 것으로 보이며, 웹 전용 배포 시 cookie 기반으로 전환 권장.

**개발용 JWT secret이 application.yml에 하드코딩:**
- Risk: Base64 인코딩된 기본 secret이 소스 코드에 포함됨.
- Files: `src/main/resources/application.yml:83`
- Current mitigation: `${SMART_ERD_JWT_SECRET:...}` 형태로 환경변수 오버라이드 가능. 개발용 기본값.
- Recommendations: 프로덕션 배포 시 반드시 환경변수로 secret 주입. CI/CD 파이프라인에서 기본값 사용 감지 경고 추가 권장.

**CORS 허용 범위:**
- Risk: 개발 편의를 위해 다수의 localhost 포트가 CORS allowed-origins에 포함됨.
- Files: `src/main/resources/application.yml:77`
- Current mitigation: `${SMART_ERD_CORS_ORIGINS:...}` 환경변수로 프로덕션 오버라이드 가능.
- Recommendations: 프로덕션 프로파일에서 allowed-origins를 실제 도메인으로 제한.

## Performance Concerns

**DDL 파서의 `@typescript-eslint/no-explicit-any` 다량 사용:**
- Problem: `ddl-parser.ts`에 14개의 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석. 타입 안전성 저하.
- Files: `client/src/lib/ddl-parser.ts` (1,180줄, 14개 any 캐스팅)
- Cause: DDL 파싱 라이브러리(`node-sql-parser`)의 AST 타입이 정교하지 않아 any 캐스팅 필요.
- Improvement path: `node-sql-parser` AST 노드에 대한 커스텀 타입 정의를 추가하여 any 사용 최소화.

**Diagram 목록 조회 최적화 (Phase 8 완료, 검증 필요):**
- Problem: Phase 8에서 목록용 프로젝션(`DiagramSummaryProjection`)이 도입되었으나, `content`와 `ydocSnapshot` 제외가 SQL 레벨에서 확인 필요.
- Files: `src/main/java/com/smarterd/domain/diagram/repository/DiagramRepositoryCustomImpl.java:188-219`
- Cause: QueryDSL `select` 절에서 명시적으로 필요한 컬럼만 선택하고 있어 정상적으로 동작할 것으로 보이나, 대규모 데이터에서의 실측 검증이 필요.
- Improvement path: p6spy 로그로 실행 SQL 확인, 100개+ 문서에서 응답 시간 측정.

## Naming Debt

**`Diagram` -> `Document` 리네이밍 미완:**
- Issue: 마크다운 에디터 플러그인 도입으로 `Diagram`이 더 이상 ERD만을 의미하지 않음. API 경로, 엔티티명, 프론트엔드 타입 모두 `diagram`으로 되어 있어 혼란.
- Files:
  - 백엔드: `src/main/java/com/smarterd/domain/diagram/` 전체
  - 프론트엔드: `client/src/api/diagramApi.ts`, `client/src/types/diagram.ts`, `client/src/pages/diagram/`
  - API 경로: `/api/teams/{teamId}/projects/{projectId}/diagrams/**`
- Impact: 새 개발자가 코드베이스를 이해할 때 혼란. 마크다운 문서 관련 코드가 `diagram` 네임스페이스에 위치.
- Fix approach: 후속 phase로 `diagram` -> `document` 리네이밍이 이미 계획됨. 엔티티, API 경로, 프론트엔드 타입 일괄 변경 필요.

## Migration Path

**Flyway 마이그레이션 부분 적용:**
- Issue: `src/main/resources/db/migration/` 디렉토리에 12개의 마이그레이션 SQL 파일이 존재하나, Flyway가 build.gradle에 의존성으로 포함되어 있지 않고 `ddl-auto: update`에 의존. 마이그레이션 파일은 수동으로 관리되는 보충 스크립트 성격.
- Files: `src/main/resources/db/migration/V20260*.sql` (12개 파일)
- Impact: 스키마 변경 이력 추적이 불완전. 프로덕션 환경에서 Hibernate의 자동 스키마 변경에 의존하면 위험.
- Fix approach: Flyway 의존성 추가 및 `ddl-auto: validate` 전환. 기존 마이그레이션 파일이 이미 준비되어 있으므로 전환 비용 낮음.

**증분 동기화(Phase 7) 구현 시 필요한 변경:**
- 프론트엔드: `diff-match-patch` 패키지 설치, `markdown-yjs-document-adapter.ts` 수정, `markdown-scope-resolver.ts` 확장
- 백엔드: `MarkdownScopeResolver.java` 신규 (section/{id} scope)
- 예상 규모: ~540줄 추가/수정, 1~2주 소요

## Dependencies

**QueryDSL 5.1.0 — 유지보수 상태 불투명:**
- Risk: QueryDSL 5.x는 유지보수 빈도가 낮고, Jakarta EE 전환 이후 커뮤니티 활동 감소.
- Impact: Spring Boot 업그레이드 시 호환성 문제 가능성.
- Migration plan: Spring Data JPA의 Specification, Criteria API, 또는 jOOQ 전환 검토. 현재 QueryDSL 사용처가 광범위하여 즉시 전환은 비용 큼.

**Blaze-Persistence 1.6.17 — 니치 라이브러리:**
- Risk: 사용 범위 대비 의존성 무게가 큼. 실제 사용처가 제한적일 수 있음.
- Impact: 업그레이드 시 호환성 확인 필요. Hibernate 6.2+ 통합 모듈 사용 중.
- Migration plan: 실제 Blaze-Persistence 활용 범위 조사 후, 필요 없으면 제거 검토.

**Java 25 — 얼리 액세스:**
- Risk: Java 25는 아직 GA 전(2025년 9월 예정). 일부 라이브러리와의 호환성 문제 가능.
- Impact: 의존성 업그레이드 시 Java 25 지원 여부 확인 필요.
- Migration plan: GA 이전까지는 Java 21(LTS) fallback 계획 유지 권장.

## Test Coverage Gaps

**프론트엔드 컴포넌트/페이지 테스트 부재:**
- What's not tested: React 컴포넌트 렌더링 테스트, 페이지 통합 테스트가 없음. 기존 49개 단위 테스트는 모두 순수 로직(파서, diff, 상태 머신 등) 대상.
- Files: `client/test/unit/*.test.ts` (49개), `client/e2e/` (E2E)
- Risk: UI 렌더링 버그, 이벤트 핸들러 연결 오류가 런타임까지 발견되지 않음.
- Priority: Medium — E2E 테스트가 일부 커버하지만, 컴포넌트 단위 테스트로 빠른 피드백 루프 확보 권장.

**마크다운 백엔드 통합 테스트 — 기본 커버리지 확보 (PR #5에서 추가):**
- 추가된 테스트: export MvcTest 3개(정상/빈format/잘못된format), export ControllerTest 1개, createDiagram 서비스 테스트 7개(ERD/Markdown 정상+에러 분기)
- 잔여 갭: Controller 레벨 createDiagram MVC 테스트, markdown 문서 저장/재열기 통합 테스트
- Priority: Medium — 기본 커버리지는 확보됨, 추가 통합 테스트는 선택적.

**협업 엣지 케이스 검증 부족:**
- What's not tested: 네트워크 끊김 후 재연결, 동시 편집 중 브라우저 강제 종료, remote-pending 상태 3가지 선택 후 정합성.
- Files: `client/src/pages/document/use-markdown-document-session.ts`
- Risk: 실 사용 환경에서 데이터 유실 또는 상태 불일치 가능.
- Priority: Medium — 잔여 작업 T5로 이미 식별됨.

---

*Concerns audit: 2026-04-02*
