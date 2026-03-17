# ARCH / DEV / DESIGN 리뷰 기록 (2026-02-27)

## 범위
- 브랜치의 미커밋 변경분 전체 재검토
- 관점: `arch`, `dev`, `design`
- 검증 실행:
  - `./gradlew compileJava` 통과
  - `npm run test:unit --prefix client` 통과

## 주요 이슈 (심각도 순)

### 1) High - 용어 대량 업로드 저장 시 `IN` 단건 대량 조회 리스크
- 위치:
  - `src/main/java/com/smarterd/domain/dictionary/service/TermBulkService.java` (약 296 line)
  - `src/main/java/com/smarterd/domain/dictionary/repository/TermRepository.java` (약 50 line)
  - `src/main/java/com/smarterd/domain/dictionary/service/AbstractBulkService.java` (`MAX_ROWS = 100_000`)
- 내용:
  - 최대 10만 건에서 `findByDictionarySetAndLogicalNameIn(...)`를 배치 분할 없이 1회 호출.
  - DB 파라미터 한도/실행계획 악화로 저장 실패 가능.
- 권장:
  - 도메인 업로드와 동일하게 logical name 조회 배치 분할 적용.

### 2) High - 검증 세션 인메모리 저장으로 멀티 인스턴스 불안정
- 위치:
  - `src/main/java/com/smarterd/domain/dictionary/service/TermBulkService.java` (`validationSessions`)
  - `src/main/java/com/smarterd/domain/dictionary/service/DomainBulkService.java` (`validationSessions`)
- 내용:
  - 토큰/검증결과를 JVM 메모리에만 저장.
  - LB 환경에서 validate/save가 다른 인스턴스로 라우팅되면 토큰 무효 발생 가능.
  - 대량 행 데이터 세션 메모리 사용량 증가.
- 권장:
  - Redis 등 공유 스토리지로 이전 또는 sticky session 강제 + 세션 메모리 상한/압축 정책 추가.

### 3) Medium - 다이어그램 조회 시 권한 스코프 확인 전에 flush 실행
- 위치:
  - `src/main/java/com/smarterd/domain/diagram/service/DiagramService.java` (약 138~139 line)
- 내용:
  - `findDiagramByProjectAndId`(프로젝트 소속 검증) 전에 `flushDiagramSnapshotNow(diagramId)` 호출.
  - 유효하지 않은 diagramId 요청에서도 flush 부하가 먼저 발생 가능.
- 권장:
  - 다이어그램 소속 확인 이후 flush 실행 순서로 변경.

### 4) Medium - DSL 인용부호 라운드트립 불완전
- 위치:
  - `client/src/lib/dsl-generator.ts` (약 60 line, `'` -> `''` 이스케이프)
  - `client/src/lib/dsl-parser.ts` (약 152 line, 외곽 따옴표만 제거)
- 내용:
  - 생성기 이스케이프와 파서 언이스케이프가 비대칭.
  - 따옴표 포함 식별자에서 사전 매핑 실패 가능.
- 권장:
  - 파서에 `'' -> '` 역변환 처리 추가(단/복수 인용부호 규칙 정합화).

### 5) Low - ko 리소스 일부 영어 문구 잔존
- 위치:
  - `src/main/resources/i18n/messages_ko.properties` (약 64~71 line)
- 내용:
  - 오류 리포트 엑셀 컬럼명이 영어로 표기됨.
- 권장:
  - 한국어 문구로 정리.

## 상태
- 본 문서는 리뷰 결과 기록용.
- 코드 조치는 별도 패치 단계에서 진행.
