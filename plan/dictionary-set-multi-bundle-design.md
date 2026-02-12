# Smart ERD 사전 세트(용어+도메인) 다중 관리 설계서

## Context
- 현재는 팀(`Team`) 기준으로 용어(`Term`)와 도메인(`Domain`)이 1세트처럼 관리된다.
- 요구사항:
  - 한 팀이 여러 개의 사전 세트(용어+도메인 묶음)를 관리해야 한다.
  - 다이어그램 생성 시 사전 세트를 선택해 적용해야 한다.
  - 다이어그램마다 적용 세트가 다를 수 있어야 한다.

## 목표
- 팀 단위 다중 사전 세트 관리 지원.
- 다이어그램 단위 사전 세트 지정/변경 지원.
- 기존 권한 모델(ADMIN/MEMBER/VIEWER)과 팀 소속 검증 유지.
- 기존 데이터 마이그레이션 가능.

## 비목표
- 세트 간 자동 동기화/상속.
- 세트 버전 히스토리(버저닝).
- 다이어그램 콘텐츠 자체의 자동 변환 고도화(단순 안전 모드 우선).

## 핵심 정책
- `Domain`/`Term`은 반드시 하나의 `DictionarySet`에 속한다.
- `Diagram`은 반드시 하나의 `DictionarySet`을 참조한다.
- `Term.domain`은 같은 `DictionarySet`의 `Domain`만 참조 가능.
- `Diagram.project.team == Diagram.dictionarySet.team` 무결성 보장.

## 데이터 모델 설계

### 1) 신규 엔티티: `DictionarySet`
- 필드:
  - `id`
  - `name` (팀 내 유니크)
  - `description` (nullable)
  - `team` (`ManyToOne`)
  - `isDefault` (boolean)
  - `createdAt`, `updatedAt`
- 제약:
  - `UNIQUE(team_id, name)`
  - 팀당 `is_default=true` 1개
  - DB 레벨 단일성 강제:
    - PostgreSQL partial unique index: `UNIQUE(team_id) WHERE is_default = true`

### 2) 기존 엔티티 확장
- `Domain`:
  - `team_id` 유지
  - `dictionary_set_id` FK 추가 (NOT NULL)
  - 유니크 변경: `(dictionary_set_id, logical_name)`
- `Term`:
  - `team_id` 유지
  - `dictionary_set_id` FK 추가 (NOT NULL)
  - 유니크 변경: `(dictionary_set_id, logical_name)`
- `Diagram`:
  - `dictionary_set_id` FK 추가 (NOT NULL)

### 3) 무결성 규칙
- `Term.domain_id`가 존재하면 `Term.dictionary_set_id == Domain.dictionary_set_id` 검증.
- `Diagram.dictionary_set_id`는 `project.team_id`와 동일 팀 소속 세트인지 검증.
- `Domain.team_id == DictionarySet.team_id` 강제.
- `Term.team_id == DictionarySet.team_id` 강제.
- `Term.team_id == Domain.team_id` 강제(`domain_id` 존재 시).

### 3-1) DB 강제 방식 (구현 고정)
- `dictionary_sets`:
  - `UNIQUE (id, team_id)` 추가
- `domains`:
  - `dictionary_set_id`, `team_id`에 대해 복합 FK:
    - `FOREIGN KEY (dictionary_set_id, team_id) REFERENCES dictionary_sets(id, team_id)`
  - `UNIQUE (id, dictionary_set_id, team_id)` 추가 (`terms` 복합 FK 대상)
- `terms`:
  - `FOREIGN KEY (dictionary_set_id, team_id) REFERENCES dictionary_sets(id, team_id)`
  - `domain_id`가 있을 때 복합 FK로 same-set/same-team 강제:
    - `FOREIGN KEY (domain_id, dictionary_set_id, team_id) REFERENCES domains(id, dictionary_set_id, team_id)`

### 3-2) Diagram 팀 무결성 DB 강제 (구현 고정)
- `projects`:
  - `UNIQUE (id, team_id)` 보장(없으면 추가)
- `diagrams`:
  - `team_id` 컬럼 유지/추가 후 백필
  - `FOREIGN KEY (project_id, team_id) REFERENCES projects(id, team_id)`
  - `FOREIGN KEY (dictionary_set_id, team_id) REFERENCES dictionary_sets(id, team_id)`
- 위 복합 FK로 `Diagram.project.team == Diagram.dictionarySet.team`을 DB에서 강제한다.

### 3-3) FK 인덱스 정책 (구현 고정)
- 복합 FK가 걸리는 자식 컬럼에는 동일 순서의 인덱스를 필수로 둔다.
- 필수 인덱스:
  - `domains (dictionary_set_id, team_id)`
  - `terms (dictionary_set_id, team_id)`
  - `terms (domain_id, dictionary_set_id, team_id)`
  - `diagrams (project_id, team_id)`
  - `diagrams (dictionary_set_id, team_id)`

### 4) `team_id` 유지 정책
- 기존 팀 기준 권한/조회 로직 호환을 위해 `Domain/Term.team_id`는 유지한다.
- 단, 소유권의 기준(SSOT)은 `dictionary_set_id`로 본다.
- `team_id`는 `dictionary_set.team_id`와 불일치가 발생하지 않도록 DB/서비스 레벨에서 강제한다.

### 5) 기본 세트 단일성/동시성 정책
- 기본 세트 변경(`PATCH .../default`)은 단일 트랜잭션으로 처리한다.
- 트랜잭션 내 처리 순서:
  1. 대상 팀의 기존 default를 `false`로 일괄 업데이트
  2. 요청된 세트를 `true`로 업데이트
- DB partial unique index를 최종 방어선으로 사용한다.
- 경합으로 unique 제약 위반 시 비즈니스 에러로 변환하여 재시도 가능 상태를 반환한다.

## API 설계

### 1) 사전 세트 관리 API (신규)
- `GET /api/teams/{teamId}/dictionary-sets`
- `POST /api/teams/{teamId}/dictionary-sets`
- `GET /api/teams/{teamId}/dictionary-sets/{setId}`
- `PUT /api/teams/{teamId}/dictionary-sets/{setId}`
- `DELETE /api/teams/{teamId}/dictionary-sets/{setId}`
- `PATCH /api/teams/{teamId}/dictionary-sets/{setId}/default`

### 2) 도메인/용어 API 세트 스코프화
- 도메인:
  - `/api/teams/{teamId}/dictionary-sets/{setId}/domains/**`
- 용어:
  - `/api/teams/{teamId}/dictionary-sets/{setId}/terms/**`
- 추천/업로드/템플릿도 동일하게 `setId` 포함:
  - 예) `/api/teams/{teamId}/dictionary-sets/{setId}/dictionary/suggest`
- 기존 팀 스코프 API(`/api/teams/{teamId}/domains|terms|dictionary/suggest`)는 유지하지 않고 제거한다.

### 3) 다이어그램 API 확장
- 생성 요청에 `dictionarySetId` 추가:
  - `CreateDiagramRequest { name, dictionarySetId }`
- 응답 확장:
  - `DiagramResponse`, `DiagramDetailResponse`에 `dictionarySetId`, `dictionarySetName` 포함
- 다이어그램 세트 변경 API (신규):
  - `PATCH /api/teams/{teamId}/projects/{projectId}/diagrams/{diagramId}/dictionary-set`
  - Body: `{ dictionarySetId }`
  - 성공 응답에 무효화된 바인딩 요약 포함:
    - 예) `{ dictionarySetId, invalidatedTermBindingCount, invalidatedDomainBindingCount }`
  - 제약: 편집 세션이 존재하면 변경 거부(`409 Conflict`)

## 백엔드 서비스/리포지토리 변경

### 1) 신규 서비스
- `DictionarySetService`
  - CRUD
  - default 세트 지정
  - 삭제 정책 검증(기본 세트 삭제 금지, 참조 중 삭제 금지)
  - 참조 중 범위: `diagrams` 1건 이상 참조 시 삭제 금지(핵심 정책)
  - `domains`/`terms`만 존재하고 `diagrams` 참조가 없으면 삭제 허용(도메인 정책)
  - default 변경 시 트랜잭션 + DB unique 제약 기반 동시성 제어

### 2) 기존 서비스 변경
- `DomainService`, `TermService`:
  - 팀 기준 -> 팀+세트 기준 조회/중복/검증
- `DomainBulkService`, `TermBulkService`:
  - 업로드/검증/저장 모두 세트 기준
- `DictionarySuggestService`:
  - 추천 데이터 소스를 팀+세트 기준으로 제한
- `DiagramService`:
  - 생성/조회 시 세트 정보 포함
  - 세트 변경 시 팀 무결성 검증
  - 세트 변경 시 활성 편집 세션 존재 여부 확인 후 거부(서버 기준)

### 2-1) 편집 세션/세트 변경 원자성 정책 (구현 고정)
- 활성 편집 세션 소스는 노드 메모리가 아닌 공유 저장소(Redis)로 고정한다.
- 편집 세션은 heartbeat + TTL 기반으로 관리한다(예: 30초 TTL, heartbeat 10초).
- 세트 변경 API는 아래 순서로 처리한다.
  1. 분산 락 획득: `diagram:{diagramId}:set-change-lock` (`SET NX PX`)
  2. 공유 편집 세션 조회(활성 세션 존재 시 `409`)
  3. DB 트랜잭션에서 다이어그램 행 잠금(`SELECT ... FOR UPDATE`) 후 `dictionary_set_id` 변경
  4. 안전 모드 규칙에 따라 불일치 `termId/domainId` 해제까지 같은 트랜잭션에서 영속화
- 락 보유 중 편집 세션 시작 요청은 `409` 또는 재시도 응답으로 거부한다.

### 3) 리포지토리 변경 방향
- `findByTeam(...)` 계열 -> `findByDictionarySet(...)` 계열 추가
- 중복 검사:
  - `existsByDictionarySetAndLogicalName(...)`
  - `existsByDictionarySetAndLogicalNameAndIdNot(...)`
- bulk 조회도 `dictionarySet` 기준으로 변경

## 프론트엔드 설계

### 1) 타입/상수
- `types/dictionary.ts`
  - `DictionarySet` 타입 추가
- `types/diagram.ts`
  - `dictionarySetId`, `dictionarySetName` 추가
- `constants/query-keys.ts`
  - `queryKeys.dictionary.sets(teamId)`
  - `queryKeys.dictionary.domains(teamId, setId)`
  - `queryKeys.dictionary.terms(teamId, setId)`
  - `queryKeys.dictionary.suggest(teamId, setId, keyword)`

### 2) API 모듈
- 신규: `api/dictionarySetApi.ts`
- 변경:
  - `domainApi.ts`, `termApi.ts`, `suggestApi.ts`에 `setId` 인자 추가
  - `diagramApi.ts` 생성/상세/목록 응답 타입 확장
  - 다이어그램 세트 변경 API 추가

### 3) 화면/컴포넌트
- `DictionaryPage`:
  - 세트 선택 드롭다운 + 생성/수정/삭제 UI
  - 선택된 `setId`를 `DomainTab`/`TermTab`에 전달
- `DomainTab`/`TermTab`:
  - `teamId`만 사용하던 쿼리를 `teamId + setId`로 변경
- `DiagramsPage`:
  - 다이어그램 생성 다이얼로그에 세트 선택 필드 추가
  - 다이어그램 세트 변경 UI 제공(편집 진입 전 변경)
  - 다이어그램 목록/카드에서 세트 변경 후 편집 화면으로 진입
- `DiagramPage`:
  - 현재 적용 세트 표시
  - 세트 변경 액션은 제공하지 않음(편집 중 변경 금지 정책)
  - 편집 화면 진입 시 `dictionarySetId`는 고정(read-only)으로 취급
- `ErdDictionaryProvider`:
  - `teamId` -> `teamId + dictionarySetId` 기반 캐시 로드

### 4) 세트 변경 시 다이어그램 동작 정책
- 안전 모드:
  - 기존 노드의 텍스트(name/type)는 유지
  - `termId/domainId`는 새 세트에서 불일치 시 해제
  - 사용자에게 토스트/배너로 재매핑 필요 안내
  - 영속화 시점: 세트 변경 API 성공 시점에 서버가 즉시 DB 반영(저장 버튼 시점까지 지연하지 않음)

## 권한/에러 정책

### 권한
- 조회: 팀 멤버
- 생성/수정/삭제: `verifyEditable` (ADMIN, MEMBER)

### 신규 메시지 코드(예시)
- `error.not-found.dictionary-set`
- `error.duplicate.dictionary-set-name`
- `error.business.dictionary-set-team-mismatch`
- `error.business.term-domain-set-mismatch`
- `error.business.diagram-dictionary-set-in-use`
- `error.business.dictionary-set-default-delete-forbidden`
- `error.business.diagram-dictionary-set-change-while-editing`

## 마이그레이션 전략

### 1단계: 스키마 + 데이터 이관
- `dictionary_sets` 테이블 생성
- 팀별 기본 세트(`Default`) 1개 생성
- 기존 `domains`, `terms`, `diagrams`의 `dictionary_set_id`를 팀 기본 세트로 백필
- FK/UNIQUE 제약 전환
- 대용량 안전 이관을 위해 expand/contract 절차를 고정한다.
  1. `diagrams.team_id` nullable 컬럼 추가
  2. `project_id` 기준으로 `diagrams.team_id` 배치 백필
  3. 신규 복합 인덱스 생성(가능하면 `CONCURRENTLY`)
  4. 복합 FK 추가(가능하면 `NOT VALID` 후 `VALIDATE CONSTRAINT`)
  5. 백필/검증 완료 후 `diagrams.team_id`를 `NOT NULL`로 전환
  6. 구 제약/구 인덱스 정리(contract)

### 2단계: 애플리케이션 전환
- 백엔드/프론트를 `setId` 기반 API로 전환
- 구 팀 단위 사전 API는 호환 레이어 없이 제거한다.
- 서버/클라이언트는 동일 릴리스 윈도우에서 동시 전환한다.
- 전환/롤백 판단은 핵심 API 상태를 기준으로 한다.
- 전환 안전장치:
  - FE 정적 자산은 캐시 버스트 파일명으로 배포하고, 서비스워커는 즉시 활성화(`skipWaiting`) 정책 적용
  - 앱 부트스트랩에서 `app-version` 불일치 시 강제 새로고침으로 구번들 요청을 차단
  - 전환 윈도우 동안 404/405(구 API 경로) 비율을 별도 모니터링 지표로 추적

### 3단계: 전환 검증/롤백 기준 (핵심 API 기반)
- 핵심 API:
  - `GET /api/teams/{teamId}/dictionary-sets`
  - `GET /api/teams/{teamId}/dictionary-sets/{setId}/domains`
  - `GET /api/teams/{teamId}/dictionary-sets/{setId}/terms`
  - `POST /api/teams/{teamId}/projects/{projectId}/diagrams`
  - `GET /api/teams/{teamId}/projects/{projectId}/diagrams/{diagramId}`
- 배포 게이트:
  - 위 API에 대한 스모크 테스트가 모두 성공해야 트래픽 전환
- 롤백 트리거:
  - 핵심 API 중 하나라도 5xx 비율이 `>= 1%` 상태가 `5분` 이상 지속 시 즉시 롤백
  - 핵심 사용자 플로우(사전 조회/다이어그램 생성/편집 진입) 성공률이 `99%` 미만으로 `5분` 이상 지속 시 롤백

### 참고
- 현재 `ddl-auto:update`만으로는 안전한 데이터 이관이 어려우므로
  SQL 마이그레이션 스크립트를 별도 관리한다.

## 구현 순서 (권장)
1. DB 스키마/마이그레이션 스크립트 작성
2. 엔티티/리포지토리 확장
3. `DictionarySetService` 및 세트 API 구현
4. Domain/Term/Bulk/Suggest 세트 스코프 전환
5. Diagram 생성/조회/변경 API 확장
6. 프론트 QueryKey/API/페이지 전환
7. 통합 테스트 + 회귀 테스트

## 테스트 전략
- 백엔드:
  - 세트별 중복 제약 테스트
  - 팀당 default 1개 보장 테스트(동시 요청 포함)
  - `Term.domain` same-set 검증 테스트
  - 다이어그램 세트 팀 무결성 테스트
  - 편집 세션 존재 시 다이어그램 세트 변경 API `409` 거부 테스트
  - 멀티 인스턴스 환경(공유 Redis)에서 편집 세션 `409` 거부 일관성 테스트
  - 세션 시작/세트 변경 경쟁 상황(TOCTOU)에서 원자성 보장 테스트
  - 세트 변경 성공 시 불일치 바인딩 즉시 영속화 검증 테스트
  - 세트 삭제 정책(기본/참조중) 테스트
- 프론트:
  - 세트 전환 시 캐시 키 분리 검증
  - 다이어그램 생성 시 세트 선택 필수 검증
  - 다이어그램 세트 변경 시 안내 UX 검증
  - 세트 변경 응답의 무효화 건수 표시/안내 일관성 검증

## 확정 결정 사항
- 다이어그램 세트 변경 권한: ADMIN/MEMBER 동일 허용
- 세트 삭제 시 참조 다이어그램이 있으면 삭제 금지
- 세트 삭제 차단 기준은 `diagrams` 참조 여부를 기준으로 판단
- 기본 세트 자동 선택 규칙: 다이어그램 생성 시 명시 선택
- 기존 팀 스코프 사전 API는 유지하지 않고 제거
- `Domain/Term.team_id`는 유지하고, `dictionary_set.team_id`와 일치 강제
- 다이어그램 세트 변경은 서버 기준으로 편집 중 거부
- 다이어그램 세트 변경 UI는 다이어그램 선택 화면(`DiagramsPage`)에서만 제공
- 편집 화면(`DiagramPage`)에서는 세트 변경을 허용하지 않음(read-only)
- 편집 세션 판정은 공유 저장소(Redis) 기준으로 처리
- 세트 변경 시 불일치 바인딩은 서버 트랜잭션에서 즉시 영속화
- 배포 전환/롤백 판단은 핵심 API 상태 기준
