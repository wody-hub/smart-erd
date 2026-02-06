# Smart ERD — 구현 계획서

## 단계별 진행 상태

| 단계 | 기능 | 상태 | 비고 |
|------|------|------|------|
| 1단계 | 로그인 + 팀/프로젝트 생성 | DONE | 커밋 `45e9a1e` |
| 2단계 | ERD 기본 구현 | TODO | 1단계 의존 |
| 3단계 | 용어사전/도메인사전 등록 | TODO | 1단계 의존 |
| 4단계 | 사전 적용 + 유효성 검사 | TODO | 2, 3단계 의존 |
| 5단계 | 프로젝트 관리 (고급) | TODO | 1단계 의존 |

> 상태: `TODO` → `IN_PROGRESS` → `DONE`

---

## 구현 순서 근거: 1 → 2 → 3 → 4 → 5

**1단계: 로그인 + 팀/프로젝트 생성 (기반 인프라)**
- 모든 기능의 전제 조건. "누가" "어떤 팀의" "어떤 프로젝트에서" 작업하는지가 결정되어야 ERD든 사전이든 저장할 곳이 생김
- 이후 모든 기능이 "인증된 사용자 → 팀 선택 → 프로젝트 선택" 흐름 위에 동작

**2단계: ERD 기본 구현 (핵심 기능)**
- 프로젝트가 존재해야 다이어그램을 생성/저장 가능 → 1단계 의존
- 앱의 핵심 가치. 테이블 CRUD + 관계 매핑 + 캔버스 상태 영속화

**3단계: 용어사전/도메인사전 등록 (보조 데이터)**
- 팀 단위로 관리되므로 1단계 의존
- ERD와 독립적으로 CRUD 가능한 단순 기능

**4단계: 사전 적용 + 유효성 검사 (고급 기능)**
- 2단계(ERD) + 3단계(사전) 모두 완성 후에만 가능
- ERD 컬럼 생성/수정 시 용어사전 자동완성, 도메인사전 타입 자동 매핑

**5단계: 프로젝트 관리 (운영 기능)**
- 1단계에서 기본 CRUD는 완성. 고급 관리(멤버 역할 변경, 프로젝트 설정, 권한 관리 등)는 마지막

---

## 1단계: 로그인 + 팀/프로젝트 생성 — DONE

### 구현 완료 내역

**백엔드**
- [x] Team API — 7 엔드포인트 (`TeamController`, `TeamService`)
  - `POST /api/teams` — 팀 생성 (로그인 사용자가 owner + ADMIN)
  - `GET /api/teams` — 내가 속한 팀 목록
  - `GET /api/teams/{id}` — 팀 상세
  - `GET /api/teams/{id}/members` — 멤버 목록
  - `POST /api/teams/{id}/members` — 멤버 초대 (loginId + role)
  - `DELETE /api/teams/{id}/members/{userId}` — 멤버 제거
  - `PATCH /api/teams/{id}/members/{userId}` — 멤버 역할 변경
- [x] Project API — 4 엔드포인트 (`ProjectController`, `ProjectService`)
  - `POST /api/teams/{teamId}/projects` — 프로젝트 생성
  - `GET /api/teams/{teamId}/projects` — 프로젝트 목록
  - `GET /api/teams/{teamId}/projects/{id}` — 프로젝트 상세
  - `DELETE /api/teams/{teamId}/projects/{id}` — 프로젝트 삭제
- [x] `GlobalExceptionHandler` — 통합 에러 핸들링
- [x] `TeamMemberRepository`, `ProjectRepository` — 커스텀 쿼리 메서드 추가
- [x] Swagger/OpenAPI — `springdoc-openapi` 통합, 전체 컨트롤러/DTO 어노테이션

**프론트엔드**
- [x] react-router-dom 라우팅 + `ProtectedRoute` 인증 가드
- [x] `LoginPage` API 연동 + `SignupPage` 신규
- [x] `TeamsPage` — 팀 목록 + 생성 다이얼로그
- [x] `ProjectsPage` — 프로젝트 목록/생성/삭제 + 멤버 초대/관리
- [x] `useAuthStore` (Zustand) — 인증 상태 + localStorage 동기화
- [x] `Header` — 사용자명 표시, 로그아웃
- [x] Axios 401 인터셉터 — 토큰 만료 시 자동 로그아웃
- [x] shadcn/ui 추가: Dialog, DropdownMenu
- [x] Prettier + ESLint 통합

**검증**
- [x] `./gradlew build` 통과
- [x] `npm run build` 통과

---

## 2단계: ERD 기본 구현 — TODO

### 목표
프로젝트 내에서 ERD 다이어그램을 생성하고, 테이블/컬럼을 CRUD하며, 관계를 매핑하고, 캔버스 상태를 서버에 영속화한다.

### 백엔드

#### API 엔드포인트

**Diagram API** (`/api/teams/{teamId}/projects/{projectId}/diagrams`)
- `POST` — 다이어그램 생성 (빈 캔버스로 초기화)
- `GET` — 프로젝트의 다이어그램 목록
- `GET /{diagramId}` — 다이어그램 상세 (content JSON 포함)
- `PUT /{diagramId}` — 다이어그램 저장 (캔버스 상태 JSON 업데이트)
- `DELETE /{diagramId}` — 다이어그램 삭제
- `PATCH /{diagramId}` — 다이어그램 이름 변경

#### 서비스/리포지토리
- `DiagramService` — 다이어그램 CRUD, 프로젝트/팀 소속 확인
- `DiagramRepository` — `findByProject()`, `findByProjectAndId()`

#### 수정 대상 파일
- 신규: `api/diagram/DiagramController.java`, `api/diagram/dto/`
- 신규: `domain/diagram/service/DiagramService.java`
- 수정: `DiagramRepository` (커스텀 쿼리 메서드 추가)

### 프론트엔드

#### ERD 캔버스 기능 완성
- 테이블 생성/삭제/이름 변경 UI
- 컬럼 추가/삭제/수정 (이름, 타입, PK, FK, nullable 등)
- 드래그로 테이블 간 관계(FK) 연결
- 캔버스 저장 (Zustand → serialize → PUT API)
- 캔버스 로드 (GET API → deserialize → Zustand)

#### 다이어그램 목록/관리
- `DiagramsPage.tsx` 또는 `ProjectsPage` 내 다이어그램 목록
- 다이어그램 생성/삭제/이름 변경
- 다이어그램 클릭 시 ERD 편집기로 이동

#### Sidebar 기능 연동
- 현재 다이어그램의 테이블 목록 표시
- 테이블 추가 버튼
- 테이블 클릭 시 캔버스 포커스

#### 수정 대상 파일
- 신규 또는 수정: `pages/DiagramPage.tsx` (API 연동)
- 수정: `components/erd/ERDCanvas.tsx` (테이블/컬럼 CRUD UI)
- 수정: `components/erd/TableNode.tsx` (컬럼 편집 UI)
- 수정: `components/layout/Sidebar.tsx` (테이블 추가/목록 연동)
- 수정: `stores/useCanvasStore.ts` (저장/로드 API 연동)

### 검증
- 다이어그램 생성 → 테이블 추가 → 컬럼 추가 → 관계 연결 → 저장 → 새로고침 후 복원 확인
- `./gradlew build` 통과
- `npm run build` 통과

---

## 3단계: 용어사전/도메인사전 등록 — TODO

### 목표
팀 단위로 용어사전(Term)과 도메인사전(Domain)을 등록/관리한다.

### 백엔드

#### API 엔드포인트

**Domain API** (`/api/teams/{teamId}/domains`)
- `POST` — 도메인 생성
- `GET` — 도메인 목록
- `PUT /{domainId}` — 도메인 수정
- `DELETE /{domainId}` — 도메인 삭제

**Term API** (`/api/teams/{teamId}/terms`)
- `POST` — 용어 생성
- `GET` — 용어 목록
- `PUT /{termId}` — 용어 수정
- `DELETE /{termId}` — 용어 삭제

#### 서비스/리포지토리
- `DomainService` — 도메인 CRUD, 팀 소속 확인
- `TermService` — 용어 CRUD, 팀 소속 확인, Domain 참조 처리
- `DomainRepository` — `findByTeam()`
- `TermRepository` — `findByTeam()`

#### 수정 대상 파일
- 신규: `api/dictionary/DomainController.java`, `api/dictionary/TermController.java`, `dto/`
- 신규: `domain/dictionary/service/DomainService.java`, `TermService.java`
- 수정: `DomainRepository`, `TermRepository` (커스텀 쿼리 메서드 추가)

### 프론트엔드

#### 사전 관리 페이지
- `DictionaryPage.tsx` — 탭으로 도메인사전/용어사전 전환
- 도메인사전: 논리명, 물리타입, 길이, 설명 등 테이블 형태 CRUD
- 용어사전: 논리명, 물리명, 도메인 참조(선택), 설명 등 테이블 형태 CRUD

#### 라우팅 추가
- `/teams/:teamId/dictionary` — 사전 관리 페이지

#### 수정 대상 파일
- 신규: `pages/DictionaryPage.tsx`
- 수정: `App.tsx` (라우트 추가)
- 수정: `ProjectsPage.tsx` 또는 네비게이션 (사전 관리 링크)
- 추가 shadcn/ui: Table, Tabs, Select 등

### 검증
- 도메인 생성/수정/삭제 + 용어 생성/수정/삭제 흐름 확인
- 용어에 도메인 참조 연결/해제 확인
- `./gradlew build` 통과
- `npm run build` 통과

---

## 4단계: 사전 적용 + 유효성 검사 — TODO

### 목표
ERD 컬럼 생성/수정 시 용어사전 자동완성, 도메인사전 타입 자동 매핑. 사전에 등록되지 않은 컬럼명/타입 경고.

### 주요 기능
- 컬럼 논리명 입력 시 용어사전 자동완성 (검색/선택)
- 용어 선택 시 물리명 자동 매핑
- 용어에 도메인이 연결된 경우 데이터 타입 자동 매핑
- 유효성 검사: 사전 미등록 컬럼명/타입에 경고 표시
- 유효성 검사 결과 요약 패널

### 수정 대상 파일
- 수정: `components/erd/TableNode.tsx` (자동완성 UI, 경고 표시)
- 신규: `components/erd/ColumnAutoComplete.tsx` (용어 검색/선택)
- 신규: `components/erd/ValidationPanel.tsx` (유효성 검사 결과)
- 수정: `stores/useCanvasStore.ts` (유효성 검사 상태)
- API: 용어/도메인 검색 엔드포인트 (필요 시)

### 검증
- 컬럼 생성 시 용어 자동완성 동작 확인
- 용어 선택 시 물리명 + 타입 자동 매핑 확인
- 미등록 컬럼에 경고 표시 확인
- `./gradlew build` 통과
- `npm run build` 통과

---

## 5단계: 프로젝트 관리 (고급) — TODO

### 목표
팀/프로젝트 운영에 필요한 고급 관리 기능을 보강한다.

### 주요 기능
- 팀 설정 페이지 (팀 이름 변경, 팀 삭제)
- 멤버 역할별 권한 세분화 (ADMIN: 전체, MEMBER: 편집, VIEWER: 읽기 전용)
- 프로젝트 설정 (이름 변경, 설명 추가)
- 활동 로그 / 변경 이력 (선택적)
- 다이어그램 내보내기 (이미지, SQL DDL 등) (선택적)

### 수정 대상 파일
- 수정 또는 신규: 팀/프로젝트 설정 페이지
- 수정: 기존 API에 권한 체크 강화
- 신규: 내보내기 관련 유틸리티 (선택적)

### 검증
- 역할별 접근 권한 동작 확인
- 팀/프로젝트 설정 변경 확인
- `./gradlew build` 통과
- `npm run build` 통과
