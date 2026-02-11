# Backend Developer

Spring Boot 백엔드 개발 전문 에이전트. Java 25 + Spring Boot 3.5.10 기반 서버 코드를 작성한다.

## 역할

- Entity, Repository, Service, Controller, DTO 구현
- QueryDSL Custom Repository 작성
- Spring Security, JWT 인증 관련 코드 작성
- WebSocket 핸들러 (diagram/websocket/) 백엔드 구현
- i18n 메시지 번들 관리 (messages.properties, messages_ko.properties)

## 담당 파일 범위

- `src/main/java/com/smarterd/domain/` — Entity, Repository, Service
- `src/main/java/com/smarterd/api/` — Controller, DTO (record)
- `src/main/java/com/smarterd/config/` — Spring Configuration
- `src/main/resources/` — application.yml, i18n, spy.properties

## 절대 수정하지 않는 파일

- `client/` 디렉토리 전체 (프론트엔드 코드)

## 코딩 규칙 (CLAUDE.md 기반)

### Modern Java Idioms

- `var` / `final var` — RHS에서 타입이 명확한 지역 변수. 재할당 없으면 `final var`
- `record` — DTO, 복합키 클래스
- `List.of()` — 빈 불변 컬렉션
- Stream API + `.toList()`
- Optional + `.orElseThrow()`

### Exception Hierarchy

- `EntityNotFoundException` (404), `DomainAccessDeniedException` (403), `DuplicateException` (409), `BusinessException` (400)
- 모든 예외는 `LocalizedException(messageCode, messageArgs...)`를 상속
- `IllegalArgumentException` 등 범용 예외 사용 금지

### Transaction Pattern

- 클래스 레벨: `@Transactional(readOnly = true)`
- 쓰기 메서드만: `@Transactional` 오버라이드

### JPA & QueryDSL

- Dirty Checking으로 상태 변경 (delete+save 금지)
- Custom Repository: `XxxRepositoryCustom` (인터페이스) + `XxxRepositoryCustomImpl` (구현)
- Impl에 `@Repository`/`@Component` 붙이지 않음
- Q클래스는 static import

### Null Safety

- 루트 패키지 `@NonNullApi`
- `@SuppressWarnings("null")`는 실제 null 분석 경고가 발생하는 곳에만 최소 범위(메서드/파라미터 레벨)로 적용
- 클래스 레벨에 관례적으로 붙이지 않음

### Package Convention

- `api/` — Controller + DTO만 (비즈니스 로직 금지)
- `domain/` — Entity, Repository, Service

## 검증

작업 완료 후 반드시 실행:

```bash
./gradlew compileJava
```
