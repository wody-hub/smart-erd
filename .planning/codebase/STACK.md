# Technology Stack

**Analysis Date:** 2026-04-02

## Languages

**Primary:**
- Java 25 - 백엔드 (Spring Boot), `build.gradle` toolchain `languageVersion = JavaLanguageVersion.of(25)`
- TypeScript ~5.6.2 - 프론트엔드 (React), `client/package.json`

**Secondary:**
- SQL - Flyway 마이그레이션 (`src/main/resources/db/migration/V*.sql`), QueryDSL 쿼리
- CSS - Tailwind CSS 기반 스타일링 (`client/src/index.css`)

## Runtime

**Environment:**
- JVM (Java 25) - Spring Boot 백엔드
- Node.js - Vite 개발 서버 및 빌드
- Electron 40.x - 데스크톱 앱 배포 (Mac/Win)

**Package Manager:**
- Gradle 9.4.0 (wrapper) - 백엔드 빌드, `gradle/wrapper/gradle-wrapper.properties`
- npm - 프론트엔드 패키지 관리, `client/package.json` (`"type": "module"`)
- Lockfile: `gradle.lockfile` 미사용, `package-lock.json` 존재

## Frameworks

**Core:**
- Spring Boot 3.5.11 - 백엔드 프레임워크, `build.gradle` plugin
- Spring Security 6.x - 인증/인가 (OAuth2 Resource Server JWT)
- Spring Data JPA - ORM/데이터 액세스
- React 19.2.x - 프론트엔드 UI 프레임워크
- Vite 6.x - 프론트엔드 빌드/개발 서버, `client/vite.config.ts`

**Testing:**
- JUnit 5 (JUnit Platform) - 백엔드 단위/통합 테스트
- Spring Boot Test + Spring Security Test - 백엔드 테스트 지원
- Testcontainers (PostgreSQL) - 테스트용 DB 격리
- Playwright 1.58.x - E2E 테스트, `client/playwright.config.*`
- Node.js built-in test runner - 프론트엔드 유닛 테스트 (`node --test`)

**Build/Dev:**
- Gradle 9.4.0 - 백엔드 빌드 (`./gradlew build`)
- Vite 6.x - 프론트엔드 빌드 (`tsc -b && vite build`)
- electron-vite 5.x - Electron 빌드 (`electron-vite build`)
- electron-builder 26.x - 데스크톱 패키징 (DMG/NSIS), `client/electron-builder.yml`

## Key Dependencies

**Backend Critical:**
- `spring-boot-starter-web` - REST API 서버
- `spring-boot-starter-websocket` - Yjs 실시간 협업 WebSocket
- `spring-boot-starter-data-jpa` - JPA/Hibernate ORM
- `spring-boot-starter-oauth2-resource-server` - JWT 인증 (HMAC-SHA256)
- `spring-boot-starter-validation` - Bean Validation (Jakarta)
- `spring-boot-starter-data-redis` - WebSocket 티켓 저장소 (선택적, 기본 in-memory)

**Backend Infrastructure:**
- `querydsl-jpa:5.1.0:jakarta` - 타입 안전 동적 쿼리
- `blaze-persistence-core-api-jakarta:1.6.17` - 고급 JPA 쿼리 빌더
- `postgresql` - PostgreSQL JDBC 드라이버
- `springdoc-openapi-starter-webmvc-ui:2.8.6` - Swagger UI/OpenAPI 문서
- `p6spy-spring-boot-starter:1.12.1` - SQL 로깅 (바인딩 파라미터 포함)
- `poi-ooxml:5.4.1` - Excel import/export
- `commons-lang3:3.17.0` / `commons-collections4:4.4` - Apache Commons 유틸리티
- `lombok` - 보일러플레이트 코드 제거

**Backend Test:**
- `spring-boot-testcontainers` + `testcontainers:postgresql` - 테스트 DB 격리

**Frontend Critical:**
- `@xyflow/react:^12.0.0` - ERD 캔버스 (React Flow)
- `zustand:^5.0.0` - 클라이언트 상태 관리
- `@tanstack/react-query:^5.90.20` - 서버 상태 관리 (캐싱, 무효화)
- `axios:^1.7.0` - HTTP 클라이언트
- `yjs:^13.6.29` - CRDT 실시간 협업
- `react-router-dom:^7.13.0` - SPA 라우팅

**Frontend UI:**
- `@radix-ui/*` (dialog, dropdown-menu, select, tabs 등) - shadcn/ui 기반 프리미티브
- `lucide-react:^0.563.0` - 아이콘
- `tailwind-merge:^3.4.0` + `clsx:^2.1.1` - CSS 클래스 유틸리티
- `class-variance-authority:^0.7.1` - 컴포넌트 variant 관리
- `tailwindcss-animate:^1.0.7` - 애니메이션
- `sonner:^2.0.7` - 토스트 알림
- `cmdk:^1.1.1` - 커맨드 팔레트

**Frontend Feature:**
- `@monaco-editor/react:^4.6.0` + `monaco-editor:^0.55.1` - 코드 에디터 (DSL/DDL)
- `dagre:^0.8.5` - ERD 자동 레이아웃 (방향 그래프)
- `node-sql-parser:^5.4.0` - SQL DDL 파싱 (PostgreSQL/MySQL/MSSQL)
- `html-to-image:^1.11.13` + `jspdf:^4.1.0` - ERD 이미지/PDF 내보내기
- `dompurify:^3.2.7` - HTML 새니타이징
- `marked:^14.0.0` - Markdown 렌더링
- `js-yaml:^4.1.1` - YAML 파싱
- `@dnd-kit/core:^6.3.1` + `@dnd-kit/sortable:^10.0.0` - 드래그 앤 드롭
- `react-hotkeys-hook:^5.2.4` - 키보드 단축키
- `i18next:^25.8.4` + `react-i18next:^16.5.4` - 다국어 (ko/en)
- `electron-store:^11.0.2` - Electron 로컬 저장소

## Configuration

**Environment:**
- 백엔드: `application.yml` (`smart-erd.*` 네임스페이스), 환경변수 오버라이드
- 프론트엔드: `.env.frontend-dev`, `.env.frontend-local`, `.env.frontend-test` (Vite 모드별)
- `.envrc` 파일 존재 (direnv 사용)
- 주요 환경변수: `SMART_ERD_JWT_SECRET`, `SERVER_PORT`, `SMART_ERD_CORS_ORIGINS`, `SMART_ERD_DB_*`, `VITE_*`

**Build:**
- `build.gradle` - Gradle 빌드 설정 (annotation processor 순서: Lombok -> QueryDSL)
- `client/vite.config.ts` - Vite 빌드 (수동 chunk splitting, `@/` alias, proxy 설정)
- `client/electron.vite.config.ts` - Electron 빌드
- `client/electron-builder.yml` - 데스크톱 패키징 (Mac DMG universal, Win NSIS/portable)
- `client/tsconfig.app.json` - TypeScript 설정 (`@/*` 경로 별칭)
- `.prettierrc.json` - Prettier (Java tabWidth 4/printWidth 120, TS tabWidth 2/printWidth 100)

**DB Migration:**
- Flyway 마이그레이션: `src/main/resources/db/migration/V*.sql` (11개 파일)
- `ddl-auto: update` 병행 사용

## Platform Requirements

**Development:**
- Java 25 JDK
- Node.js (ESM 지원 버전)
- Docker Desktop 실행 필수 (PostgreSQL 17 컨테이너)
- npm 캐시 이슈: `--cache /tmp/npm-cache-smarterd` 사용 권장

**Production:**
- JVM (Java 25)
- PostgreSQL 17
- Redis 7 (선택적, WebSocket 티켓/벌크 검증 저장소)
- Electron 데스크톱 앱: macOS (universal), Windows (x64)

---

*Stack analysis: 2026-04-02*
