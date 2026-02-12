# 5단계: 프로젝트 관리 (고급) 기획서

## 개요

팀/프로젝트 운영에 필요한 고급 관리 기능을 보강한다. 팀 설정(이름 변경, 삭제), 멤버 역할별 권한 세분화(ADMIN/MEMBER/VIEWER), 프로젝트 설정(이름 변경, 설명), SQL DDL 내보내기를 구현한다.

> **이미지 내보내기(PNG/JPG/SVG/PDF)**는 `useExportDiagram` 훅 + `CanvasToolbar` 드롭다운으로 4단계에서 이미 구현 완료되었으므로 본 기획 범위에서 제외한다.

---

## 기존 코드 분석 결과 요약

### 1. 현재 권한 체크 현황

| 서비스 | 메서드 | 현재 체크 | 문제점 |
|--------|--------|-----------|--------|
| `TeamService` | `addMember`, `removeMember`, `updateMemberRole` | `verifyAdmin` (ADMIN만) | 정상 |
| `TeamService` | `getTeam`, `getMembers` | `verifyMembership` (전체 멤버) | 정상 |
| `ProjectService` | `createProject`, `deleteProject` | `verifyMembership` (전체 멤버) | VIEWER도 생성/삭제 가능 |
| `ProjectService` | `getProjects`, `getProject` | `verifyMembership` (전체 멤버) | 정상 |
| `DiagramService` | CRUD 전체 | `verifyMembership` (전체 멤버) | VIEWER도 편집/삭제 가능 |
| `DomainService` | CRUD 전체 | `verifyMembership` (전체 멤버) | VIEWER도 생성/삭제 가능 |
| `TermService` | CRUD 전체 | `verifyMembership` (전체 멤버) | VIEWER도 생성/삭제 가능 |

**핵심 문제**: `TeamMemberRole`에 ADMIN/MEMBER/VIEWER 3개 역할이 정의되어 있으나, 실제로는 ADMIN과 나머지(MEMBER+VIEWER)만 구분하고 있다. VIEWER의 읽기 전용 제약이 전혀 없다.

### 2. 미구현 API

| 기능 | 현재 상태 |
|------|-----------|
| 팀 이름 변경 | API 없음 |
| 팀 삭제 | API 없음 |
| 프로젝트 이름 변경 | API 없음 |
| 프로젝트 설명 추가/수정 | `Project` 엔티티에 `description` 필드 없음 |
| SQL DDL 내보내기 | 기능 없음 |

### 3. 프론트엔드 UI 패턴 현황

- **리스트 페이지**: 카드 그리드(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) + 생성 버튼
- **다이얼로그**: `CreateResourceDialog`(생성), `ConfirmDialog`(삭제 확인), `MembersDialog`(멤버 관리)
- **토스트**: `toast.success()` / `toast.error(getErrorMessage(err, t('key')))`
- **인라인 편집**: `useInlineEdit` 훅 (더블클릭 → 입력 → Enter/Escape)
- **내보내기 드롭다운**: `CanvasToolbar`에서 `DropdownMenu` 사용 (PNG/JPG/SVG/PDF)
- **역할 기반 UI 제한**: 전혀 없음 (모든 버튼이 모든 사용자에게 노출)

### 4. 기존 타입 정의

```typescript
// types/team.ts
interface Team { id: number; name: string; ownerName: string; memberCount: number; createdAt: string; }
interface TeamMember { userId: number; loginId: string; name: string; role: TeamMemberRole; }
type TeamMemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

// types/project.ts
interface Project { id: number; name: string; teamId: number; createdAt: string; }
```

---

## 사용자 스토리

### 팀 설정

- [ ] US-1: ADMIN으로서, 팀 이름을 변경하기 위해, 팀 설정에서 이름을 수정할 수 있다.
- [ ] US-2: ADMIN으로서, 팀을 삭제하기 위해, 팀 설정에서 팀 삭제를 실행할 수 있다 (모든 하위 리소스 포함).
- [ ] US-3: MEMBER/VIEWER로서, 팀 설정을 확인하기 위해, 팀 정보를 조회할 수 있지만 변경은 불가능하다.

### 권한 세분화

- [ ] US-4: ADMIN으로서, 팀을 관리하기 위해, 모든 CRUD 작업과 팀 설정, 멤버 관리를 수행할 수 있다.
- [ ] US-5: MEMBER로서, 콘텐츠를 편집하기 위해, 프로젝트/다이어그램/사전의 생성·수정·삭제를 수행할 수 있다.
- [ ] US-6: VIEWER로서, 콘텐츠를 조회하기 위해, 모든 데이터를 읽기 전용으로 볼 수 있지만 생성·수정·삭제는 불가능하다.
- [ ] US-7: VIEWER로서, 다이어그램을 볼 때, 편집 관련 UI(추가/삭제 버튼, 인라인 편집)가 숨겨진다.

### 프로젝트 설정

- [ ] US-8: ADMIN/MEMBER로서, 프로젝트 이름을 변경하기 위해, 프로젝트 카드에서 인라인 편집할 수 있다.
- [ ] US-9: ADMIN/MEMBER로서, 프로젝트 설명을 추가하기 위해, 프로젝트 설정 다이얼로그에서 설명을 입력할 수 있다.

### SQL DDL 내보내기

- [ ] US-10: 모든 역할의 사용자로서, 다이어그램을 DDL로 내보내기 위해, 툴바 내보내기 메뉴에서 SQL DDL을 선택할 수 있다.
- [ ] US-11: 사용자로서, DDL DBMS를 선택하기 위해, 내보내기 시 PostgreSQL/MySQL/Oracle/SQL Server 중 선택할 수 있다.

---

## 화면 흐름

```text
[TeamsPage]
  │
  ├─→ [팀 카드] 클릭 → [ProjectsPage]
  │     │
  │     ├─→ ⚙️ 팀 설정 버튼 (ADMIN만 표시) → [TeamSettingsDialog]
  │     │     ├─ 팀 이름 변경
  │     │     └─ 팀 삭제 (확인 다이얼로그)
  │     │
  │     ├─→ 프로젝트 카드 ···→ 인라인 이름 변경 (ADMIN/MEMBER만)
  │     ├─→ 프로젝트 카드 ⚙️ → [ProjectSettingsDialog] (ADMIN/MEMBER만)
  │     │     ├─ 프로젝트 이름 변경
  │     │     └─ 프로젝트 설명 수정
  │     │
  │     └─→ [DiagramPage] → 캔버스 툴바
  │           └─→ 내보내기 ▼ → PNG/JPG/SVG/PDF (기존)
  │                           → SQL DDL → DBMS 선택 다이얼로그
  │
  └─→ VIEWER: 생성/삭제 버튼 숨김, 편집 비활성
```

---

## 화면 상세

### 화면 1: TeamSettingsDialog (팀 설정 다이얼로그)

- **진입점**: `ProjectsPage` 헤더의 ⚙️ (Settings) 아이콘 버튼 (ADMIN만 표시)
- **레이아웃**:

```text
┌─────────────────────────────────────┐
│  팀 설정                        [X] │
│  ───────────────────────────────── │
│                                     │
│  팀 이름                            │
│  ┌─────────────────────┐ [저장]    │
│  │ My Team             │            │
│  └─────────────────────┘            │
│                                     │
│  ─────────────────────────────────  │
│  위험 구역                          │
│  이 팀과 모든 하위 리소스(프로젝트,  │
│  다이어그램, 사전)가 영구 삭제됩니다.│
│                                     │
│  [팀 삭제]  (destructive 버튼)      │
│                                     │
└─────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` (shadcn/ui) — 설정 다이얼로그 컨테이너
  - `Input` (shadcn/ui) — 팀 이름 입력
  - `Button` (variant: default) — 저장
  - `Button` (variant: destructive) — 팀 삭제
  - `ConfirmDialog` (기존) — 삭제 확인

- **인터랙션**:

| 액션 | 결과 | 비고 |
|------|------|------|
| 이름 입력 + 저장 클릭 | PUT API → 성공 toast → 팀 이름 갱신 | 빈 문자열 불가 |
| 팀 삭제 클릭 | ConfirmDialog 표시 (팀 이름 입력 확인) | 팀 이름 정확히 입력해야 삭제 |
| 삭제 확인 | DELETE API → 성공 toast → TeamsPage 이동 | 모든 하위 리소스 삭제 |

### 화면 2: ProjectSettingsDialog (프로젝트 설정 다이얼로그)

- **진입점**: 프로젝트 카드의 ⚙️ (Settings) 아이콘 (ADMIN/MEMBER만 표시, hover 시)
- **레이아웃**:

```text
┌─────────────────────────────────────┐
│  프로젝트 설정                  [X] │
│  ───────────────────────────────── │
│                                     │
│  프로젝트 이름                      │
│  ┌─────────────────────┐           │
│  │ My Project          │           │
│  └─────────────────────┘           │
│                                     │
│  설명                               │
│  ┌─────────────────────┐           │
│  │ 이 프로젝트는...    │           │
│  │                     │           │
│  └─────────────────────┘           │
│                                     │
│           [취소]  [저장]            │
└─────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` (shadcn/ui) — 다이얼로그 컨테이너
  - `Input` (shadcn/ui) — 프로젝트 이름
  - `Textarea` (shadcn/ui, 신규 추가 필요) — 설명 입력
  - `Button` (variant: outline) — 취소
  - `Button` (variant: default) — 저장

- **인터랙션**:

| 액션 | 결과 | 비고 |
|------|------|------|
| 이름/설명 수정 + 저장 | PUT API → 성공 toast → 목록 갱신 | 이름 필수, 설명 선택 |
| 취소 | 다이얼로그 닫기, 변경사항 폐기 | — |

### 화면 3: ProjectsPage 역할별 UI 차이

- **ADMIN**: 모든 버튼 표시 (팀 설정, 멤버 관리, 프로젝트 생성/삭제/설정, 사전)
- **MEMBER**: 팀 설정 버튼 숨김, 나머지 동일
- **VIEWER**: 생성/삭제/설정 버튼 숨김, 조회 전용

```text
ADMIN 뷰:
┌──────────────────────────────────────────────┐
│ My Team (3명)                                │
│                  [사전] [멤버] [⚙️] [+ 새 프로젝트] │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Project A│ │ Project B│ │ Project C│     │
│ │   [⚙️][🗑]│ │   [⚙️][🗑]│ │   [⚙️][🗑]│     │
│ └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘

VIEWER 뷰:
┌──────────────────────────────────────────────┐
│ My Team (3명)                                │
│                              [사전] [멤버]   │
│                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Project A│ │ Project B│ │ Project C│     │
│ │          │ │          │ │          │     │
│ └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘
```

### 화면 4: DiagramPage 역할별 UI 차이

- **ADMIN/MEMBER**: 현재와 동일 (전체 편집 기능)
- **VIEWER**: ERD 캔버스 읽기 전용 모드

```text
VIEWER 뷰:
┌─────────────────────────────────────────────┐
│ [Header — 저장 버튼 숨김]                    │
├──────┬──────────────────────────────────────┤
│ Side │  ERD Canvas (읽기 전용)               │
│ bar  │  ┌──────────────────────────────────┐ │
│      │  │ [툴바: FK연결/레이아웃 숨김,      │ │
│ 테이블│  │  내보내기만 표시]                 │ │
│ 목록  │  │                                  │ │
│      │  │  Table A ──── Table B             │ │
│ [추가 │  │                                  │ │
│ 버튼  │  └──────────────────────────────────┘ │
│ 숨김] │                                      │
└──────┴──────────────────────────────────────┘
```

### 화면 5: SQL DDL 내보내기 다이얼로그

- **진입점**: `CanvasToolbar` 내보내기 드롭다운 → "SQL DDL" 항목 클릭
- **레이아웃**:

```text
┌──────────────────────────────────────────┐
│  SQL DDL 내보내기                    [X] │
│  ──────────────────────────────────────  │
│                                          │
│  대상 DBMS                               │
│  ┌──────────────────────┐               │
│  │ PostgreSQL        ▼  │               │
│  └──────────────────────┘               │
│  (PostgreSQL / MySQL / Oracle /          │
│   SQL Server / 범용 SQL)                 │
│                                          │
│  미리보기                                │
│  ┌──────────────────────────────────┐   │
│  │ CREATE TABLE users (             │   │
│  │   id BIGINT NOT NULL,            │   │
│  │   name VARCHAR(255),             │   │
│  │   PRIMARY KEY (id)               │   │
│  │ );                               │   │
│  │                                  │   │
│  │ ALTER TABLE orders               │   │
│  │   ADD CONSTRAINT fk_orders_user  │   │
│  │   FOREIGN KEY (user_id)          │   │
│  │   REFERENCES users (id);         │   │
│  └──────────────────────────────────┘   │
│                                          │
│         [클립보드 복사]  [파일 다운로드]  │
└──────────────────────────────────────────┘
```

- **컴포넌트 목록**:
  - `Dialog` (shadcn/ui) — 다이얼로그 컨테이너
  - `Select` (shadcn/ui) — DBMS 선택
  - Monaco Editor (`@monaco-editor/react`, 기존 의존성) — DDL 미리보기 (읽기 전용, SQL 구문 강조)
  - `Button` (variant: outline) — 클립보드 복사
  - `Button` (variant: default) — 파일 다운로드

- **인터랙션**:

| 액션 | 결과 | 비고 |
|------|------|------|
| DBMS 선택 변경 | DDL 미리보기 즉시 갱신 | 프론트 전용 변환 |
| 클립보드 복사 | navigator.clipboard → 성공 toast | 별도 API 불필요 |
| 파일 다운로드 | .sql 파일 다운로드 | 파일명: `{diagramName}.sql` |
| 테이블 없음 | 내보내기 메뉴 비활성 + toast 안내 | 기존 이미지 내보내기와 동일 |

---

## 상태별 UI

| 상태 | 표시 내용 |
|------|-----------|
| 로딩 | `<Spinner />` 컴포넌트 |
| 빈 상태 | 아이콘 + 안내 텍스트 + 액션 버튼 (기존 패턴) |
| 에러 | `toast.error(getErrorMessage(err, t('key')))` |
| 권한 부족 (API) | 서버 403 → `toast.error()` |
| 권한 부족 (UI) | 버튼/메뉴 숨김 (렌더링하지 않음) |

---

## 엣지 케이스

### 팀 설정
- 팀 이름 빈 문자열: 클라이언트 + 서버 양쪽에서 유효성 검증
- 팀 삭제 시 하위 리소스: CASCADE 삭제 (프로젝트, 다이어그램, 사전, 멤버)
- 팀 삭제 시 현재 사용자의 활성 세션: 삭제 완료 후 `/teams` 로 리다이렉트
- 팀 이름 중복: 현재 팀 이름 중복 제약 없음 (기존 정책 유지)
- 팀 소유자 변경: 5단계 범위 외 (향후)

### 권한 세분화
- ADMIN이 자기 자신을 VIEWER로 변경: 허용하되 경고 표시
- 팀 소유자(owner) 역할 변경: 기존 `BusinessException`으로 차단 (유지)
- 마지막 ADMIN 제거: 소유자가 항상 ADMIN이므로 문제 없음 (소유자 제거 불가)
- 실시간 협업 중 VIEWER 제약: 다이어그램 페이지 진입 시 역할 확인하여 읽기 전용 모드 적용
- 역할 변경 직후 UI 반영: 다음 API 호출 시 403 반환, 프론트에서 역할 재조회

### 프로젝트 설정
- 프로젝트 설명 최대 길이: 500자
- 프로젝트 이름 빈 문자열: 유효성 검증으로 차단

### SQL DDL 내보내기
- 테이블 없음: 내보내기 불가 안내 toast
- 순환 FK 참조: DDL 생성 시 FK는 별도 ALTER TABLE로 분리하여 순서 문제 해결
- 예약어 충돌: 테이블명/컬럼명을 DBMS별 인용 부호로 감싸기 (PostgreSQL: `"`, MySQL: `` ` ``)
- NULL/NOT NULL: `nullable` 플래그 기반으로 명시
- 논리명 주석: 논리명이 있는 컬럼에 COMMENT 추가 (지원 DBMS만)

---

## 권한별 접근 제어 매트릭스

### API 권한 매트릭스

| API | ADMIN | MEMBER | VIEWER | 비고 |
|-----|-------|--------|--------|------|
| **팀** |
| `GET /api/teams` | O | O | O | 내 팀 목록 |
| `GET /api/teams/{id}` | O | O | O | 팀 상세 |
| `PUT /api/teams/{id}` | O | X | X | **신규** 팀 이름 변경 |
| `DELETE /api/teams/{id}` | O | X | X | **신규** 팀 삭제 |
| `GET /api/teams/{id}/members` | O | O | O | 멤버 목록 |
| `POST /api/teams/{id}/members` | O | X | X | 멤버 초대 |
| `DELETE /api/teams/{id}/members/{uid}` | O | X | X | 멤버 제거 |
| `PATCH /api/teams/{id}/members/{uid}` | O | X | X | 역할 변경 |
| **프로젝트** |
| `GET /api/teams/{tid}/projects` | O | O | O | 목록 조회 |
| `GET /api/teams/{tid}/projects/{id}` | O | O | O | 상세 조회 |
| `POST /api/teams/{tid}/projects` | O | O | X | 프로젝트 생성 |
| `PUT /api/teams/{tid}/projects/{id}` | O | O | X | **신규** 이름/설명 변경 |
| `DELETE /api/teams/{tid}/projects/{id}` | O | O | X | 프로젝트 삭제 |
| **다이어그램** |
| `GET .../diagrams` | O | O | O | 목록 조회 |
| `GET .../diagrams/{id}` | O | O | O | 상세 조회 |
| `POST .../diagrams` | O | O | X | 다이어그램 생성 |
| `PUT .../diagrams/{id}` | O | O | X | 저장 (콘텐츠) |
| `PATCH .../diagrams/{id}` | O | O | X | 이름 변경 |
| `DELETE .../diagrams/{id}` | O | O | X | 삭제 |
| **사전 (도메인/용어)** |
| `GET .../domains`, `GET .../terms` | O | O | O | 목록/상세 조회 |
| `POST`, `PUT`, `DELETE` (도메인/용어) | O | O | X | 생성/수정/삭제 |

### UI 권한 매트릭스

| UI 요소 | ADMIN | MEMBER | VIEWER |
|---------|-------|--------|--------|
| **ProjectsPage** |
| 팀 설정 버튼 (⚙️) | 표시 | 숨김 | 숨김 |
| 멤버 관리 버튼 | 표시 | 표시 (조회만) | 표시 (조회만) |
| 새 프로젝트 버튼 | 표시 | 표시 | 숨김 |
| 프로젝트 삭제 버튼 | 표시 | 표시 | 숨김 |
| 프로젝트 설정 버튼 (⚙️) | 표시 | 표시 | 숨김 |
| **DiagramsPage** |
| 새 다이어그램 버튼 | 표시 | 표시 | 숨김 |
| 다이어그램 이름 변경 | 활성 | 활성 | 비활성 |
| 다이어그램 삭제 버튼 | 표시 | 표시 | 숨김 |
| **DiagramPage (ERD 편집기)** |
| 사이드바 테이블 추가 | 표시 | 표시 | 숨김 |
| 사이드바 테이블 삭제/이름변경 | 활성 | 활성 | 비활성 |
| 헤더 저장/백업 버튼 | 표시 | 표시 | 숨김 |
| FK 연결 버튼 | 표시 | 표시 | 숨김 |
| 자동 정렬 버튼 | 표시 | 표시 | 숨김 |
| 유효성 검사 버튼 | 표시 | 표시 | 표시 |
| 내보내기 버튼 | 표시 | 표시 | 표시 |
| 테이블 노드 편집 (컬럼 추가/수정/삭제) | 활성 | 활성 | 비활성 |
| **DictionaryPage** |
| 도메인/용어 추가 버튼 | 표시 | 표시 | 숨김 |
| 도메인/용어 수정 버튼 | 표시 | 표시 | 숨김 |
| 도메인/용어 삭제 버튼 | 표시 | 표시 | 숨김 |
| 업로드 버튼 | 표시 | 표시 | 숨김 |
| **MembersDialog** |
| 멤버 초대 폼 | 표시 | 숨김 | 숨김 |
| 멤버 제거 버튼 | 표시 | 숨김 | 숨김 |
| 역할 변경 드롭다운 | 활성 | 숨김 | 숨김 |

---

## 페이지별 UI 컴포넌트 구성

### 신규 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|----------|------|------|
| `TeamSettingsDialog` | `components/team/` | 팀 설정 다이얼로그 (이름 변경 + 삭제) |
| `ProjectSettingsDialog` | `components/project/` | 프로젝트 설정 다이얼로그 (이름 + 설명) |
| `DdlExportDialog` | `components/erd/` | SQL DDL 내보내기 다이얼로그 |
| `Textarea` | `components/ui/` | shadcn/ui 텍스트 영역 (프로젝트 설명용) |

### 신규 훅

| 훅 | 위치 | 설명 |
|----|------|------|
| `useTeamRole` | `hooks/` | 현재 사용자의 팀 내 역할을 조회하는 훅 |

### 신규 유틸리티

| 유틸리티 | 위치 | 설명 |
|----------|------|------|
| `generateDdl` | `lib/ddl-generator.ts` | ERD 노드/엣지 → SQL DDL 변환 순수 함수 |

### 수정 컴포넌트

| 컴포넌트 | 수정 내용 |
|----------|-----------|
| `ProjectsPage` | 역할별 버튼 조건부 렌더링 + 팀 설정/프로젝트 설정 버튼 |
| `DiagramsPage` | 역할별 버튼 조건부 렌더링 |
| `DiagramPage` | 역할별 읽기 전용 모드 |
| `Header` | 저장 버튼 역할별 표시 |
| `Sidebar` | 추가/삭제/이름변경 역할별 표시 |
| `TableNode` | 역할별 편집 비활성 |
| `CanvasToolbar` | 역할별 버튼 표시 + DDL 내보내기 추가 |
| `MembersDialog` | 역할별 초대/제거/변경 기능 제한 |
| `DomainTab` / `TermTab` | 역할별 CRUD 버튼 표시 |
| `ERDCanvas` | VIEWER일 때 `nodesDraggable={false}` 등 읽기 전용 설정 |

---

## 신규 API 요구사항

### 팀 API (신규)

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `PUT` | `/api/teams/{id}` | 팀 이름 변경 | `{ name: string }` | `TeamResponse` |
| `DELETE` | `/api/teams/{id}` | 팀 삭제 | — | 204 No Content |

### 프로젝트 API (신규)

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `PUT` | `/api/teams/{tid}/projects/{id}` | 프로젝트 수정 | `{ name: string, description?: string }` | `ProjectResponse` |

### 멤버 역할 조회 API (신규)

| Method | Path | 설명 | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/api/teams/{id}/me` | 내 역할 조회 | — | `{ role: TeamMemberRole }` |

> 기존 `GET /api/teams/{id}/members` 응답에서 현재 사용자를 찾아도 되지만, 전체 멤버 목록을 매번 가져오는 것은 비효율적이므로 별도 경량 엔드포인트를 추가한다.

### 기존 API 권한 강화 (수정)

- `ProjectService`: `createProject`, `deleteProject` → `verifyEditable` (VIEWER 차단)
- `DiagramService`: 쓰기 작업 → `verifyEditable` (VIEWER 차단)
- `DomainService`, `TermService`: 쓰기 작업 → `verifyEditable` (VIEWER 차단)

---

## DDL 내보내기 스펙

### 지원 DBMS

| DBMS | 인용 부호 | 자동 증가 | COMMENT | 특이 사항 |
|------|-----------|-----------|---------|-----------|
| PostgreSQL | `"` | `BIGSERIAL` / `SERIAL` | `COMMENT ON` | 기본 선택 |
| MySQL | `` ` `` | `AUTO_INCREMENT` | `COMMENT '...'` (인라인) | `ENGINE=InnoDB` |
| Oracle | `"` | `IDENTITY` (12c+) | `COMMENT ON` | 세미콜론 + `/` |
| SQL Server | `[]` | `IDENTITY(1,1)` | `sp_addextendedproperty` | `GO` 구분자 |
| 범용 SQL (ANSI) | `"` | 미지원 | 미지원 | 최소 호환 |

### DDL 생성 규칙

1. **CREATE TABLE**: 테이블별로 독립 `CREATE TABLE` 문 생성
2. **컬럼 정의**: `{컬럼명} {타입} [NOT NULL] [PRIMARY KEY]`
3. **PK 제약조건**: 복합 PK인 경우 `CONSTRAINT pk_{테이블명} PRIMARY KEY ({cols})` 별도 선언
4. **FK 제약조건**: 별도 `ALTER TABLE ... ADD CONSTRAINT fk_{자식}_{부모} FOREIGN KEY ...` 문으로 분리
5. **논리명 주석**: 논리명이 있는 경우 DBMS별 COMMENT 문법으로 추가
6. **테이블 정렬**: FK 참조 순서를 고려한 위상 정렬 (부모 테이블 먼저)
7. **IF NOT EXISTS**: 선택적 옵션 (기본 OFF)

### DDL 생성 데이터 소스

DDL은 프론트엔드의 `useCanvasStore`에서 직접 읽어 변환한다 (서버 API 불필요):

```typescript
// nodes[].data → { label: 테이블명, columns: Column[] }
// edges[] → { source, target, sourceHandle, targetHandle } → FK 관계 추출
```

### DDL 출력 예시 (PostgreSQL)

```sql
-- Generated by Smart ERD
-- DBMS: PostgreSQL
-- Date: 2026-02-12

CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    CONSTRAINT "pk_users" PRIMARY KEY ("id")
);

COMMENT ON COLUMN "users"."name" IS '사용자명';

CREATE TABLE "orders" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "amount" DECIMAL(15,2),
    CONSTRAINT "pk_orders" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
    ADD CONSTRAINT "fk_orders_users"
    FOREIGN KEY ("user_id")
    REFERENCES "users" ("id");
```

---

## useTeamRole 훅 설계

```typescript
/**
 * 현재 사용자의 팀 내 역할을 조회한다.
 *
 * @param teamId 팀 ID
 * @returns { role, isAdmin, canEdit, isLoading }
 */
function useTeamRole(teamId: string) {
  // GET /api/teams/{id}/me → { role: 'ADMIN' | 'MEMBER' | 'VIEWER' }
  // isAdmin = role === 'ADMIN'
  // canEdit = role === 'ADMIN' || role === 'MEMBER'
}
```

- `isAdmin`: 팀 설정, 멤버 관리 버튼 표시 여부
- `canEdit`: 생성/수정/삭제 버튼 표시 여부, 편집 모드 활성화 여부
- 캐싱: `queryKeys.teams.myRole(teamId)` — `staleTime: 5분`

---

## 백엔드 변경 요약

### 엔티티 변경

| 엔티티 | 변경 내용 |
|--------|-----------|
| `Project` | `description` 필드 추가 (`@Column(length = 500)`, nullable) |

### 서비스 변경

| 서비스 | 변경 내용 |
|--------|-----------|
| `TeamService` | `updateTeam()`, `deleteTeam()` 메서드 추가 (ADMIN 전용) |
| `TeamService` | `getMyRole()` 메서드 추가 (현재 사용자 역할 반환) |
| `ProjectService` | `updateProject()` 메서드 추가 (MEMBER 이상) |
| `ProjectService` | `createProject()`, `deleteProject()` → `verifyEditable()` 추가 |
| `DiagramService` | 쓰기 메서드 → `verifyEditable()` 추가 |
| `DomainService` | 쓰기 메서드 → `verifyEditable()` 추가 |
| `TermService` | 쓰기 메서드 → `verifyEditable()` 추가 |

### TeamService 공통 메서드 추가

```java
/**
 * 사용자가 팀에서 편집 가능한 역할(ADMIN 또는 MEMBER)인지 확인한다.
 * VIEWER는 읽기 전용이므로 DomainAccessDeniedException을 발생시킨다.
 */
public void verifyEditable(Team team, User user) {
    var member = teamMemberRepository.findByTeamAndUser(team, user)
        .orElseThrow(() -> new DomainAccessDeniedException(...));
    if (member.getRole() == TeamMemberRole.VIEWER) {
        throw new DomainAccessDeniedException("error.access-denied.viewer-readonly");
    }
}
```

### 신규 DTO

| DTO | 설명 |
|-----|------|
| `UpdateTeamRequest` | `{ name: String }` — 팀 이름 변경 |
| `UpdateProjectRequest` | `{ name: String, description?: String }` — 프로젝트 수정 |
| `MyRoleResponse` | `{ role: TeamMemberRole }` — 내 역할 응답 |

### 신규 백엔드 i18n 메시지

| 코드 | 한글 | 영어 |
|------|------|------|
| `error.access-denied.viewer-readonly` | 조회자 역할은 수정할 수 없습니다 | Viewers cannot modify resources |
| `error.business.delete-team-confirm` | 팀 삭제를 확인합니다 | Confirm team deletion |
| `validation.size.description` | 설명은 최대 {max}자이어야 합니다 | Description must be at most {max} characters |

---

## i18n 키 목록

### 팀 설정 (신규)

| 키 | 한글 | 영어 |
|----|------|------|
| `team.settings.title` | 팀 설정 | Team Settings |
| `team.settings.nameLabel` | 팀 이름 | Team Name |
| `team.settings.save` | 저장 | Save |
| `team.settings.dangerZone` | 위험 구역 | Danger Zone |
| `team.settings.deleteWarning` | 이 팀과 모든 하위 리소스(프로젝트, 다이어그램, 사전)가 영구 삭제됩니다. | This team and all its resources (projects, diagrams, dictionaries) will be permanently deleted. |
| `team.settings.deleteButton` | 팀 삭제 | Delete Team |
| `team.settings.deleteConfirmTitle` | 팀 삭제 확인 | Confirm Team Deletion |
| `team.settings.deleteConfirmDescription` | 확인을 위해 팀 이름 "{{name}}"을 정확히 입력하세요. | Type the team name "{{name}}" to confirm. |
| `team.settings.deleteConfirmPlaceholder` | 팀 이름 입력 | Type team name |
| `team.toast.updated` | 팀 이름이 변경되었습니다 | Team name updated |
| `team.toast.updateFailed` | 팀 이름 변경에 실패했습니다 | Failed to update team name |
| `team.toast.deleted` | 팀이 삭제되었습니다 | Team deleted |
| `team.toast.deleteFailed` | 팀 삭제에 실패했습니다 | Failed to delete team |
| `team.aria.settings` | 팀 설정 | Team settings |

### 프로젝트 설정 (신규)

| 키 | 한글 | 영어 |
|----|------|------|
| `project.settings.title` | 프로젝트 설정 | Project Settings |
| `project.settings.nameLabel` | 프로젝트 이름 | Project Name |
| `project.settings.descriptionLabel` | 설명 | Description |
| `project.settings.descriptionPlaceholder` | 프로젝트 설명을 입력하세요 (선택) | Enter project description (optional) |
| `project.toast.updated` | 프로젝트가 수정되었습니다 | Project updated |
| `project.toast.updateFailed` | 프로젝트 수정에 실패했습니다 | Failed to update project |
| `project.aria.settingsProject` | 프로젝트 {{name}} 설정 | Settings for project {{name}} |

### DDL 내보내기 (신규)

| 키 | 한글 | 영어 |
|----|------|------|
| `erd.ddlExport.title` | SQL DDL 내보내기 | Export SQL DDL |
| `erd.ddlExport.dbmsLabel` | 대상 DBMS | Target DBMS |
| `erd.ddlExport.dbms.postgresql` | PostgreSQL | PostgreSQL |
| `erd.ddlExport.dbms.mysql` | MySQL | MySQL |
| `erd.ddlExport.dbms.oracle` | Oracle | Oracle |
| `erd.ddlExport.dbms.sqlserver` | SQL Server | SQL Server |
| `erd.ddlExport.dbms.ansi` | 범용 SQL (ANSI) | Generic SQL (ANSI) |
| `erd.ddlExport.preview` | 미리보기 | Preview |
| `erd.ddlExport.copy` | 클립보드 복사 | Copy to Clipboard |
| `erd.ddlExport.download` | 파일 다운로드 | Download File |
| `erd.ddlExport.copied` | 클립보드에 복사되었습니다 | Copied to clipboard |
| `erd.ddlExport.copyFailed` | 클립보드 복사에 실패했습니다 | Failed to copy to clipboard |
| `erd.ddlExport.noTables` | 내보낼 테이블이 없습니다 | No tables to export |
| `erd.toolbar.ddlExport` | SQL DDL | SQL DDL |

### 권한 관련 (신규)

| 키 | 한글 | 영어 |
|----|------|------|
| `permission.viewerReadonly` | 조회 권한만 있습니다 | You have view-only access |
| `team.members.inviteNotAllowed` | 관리자만 멤버를 초대할 수 있습니다 | Only admins can invite members |

### 프로젝트 카드 설명 표시

| 키 | 한글 | 영어 |
|----|------|------|
| `project.list.noDescription` | 설명 없음 | No description |

---

## 구현 우선순위

| 순서 | 기능 | 이유 |
|------|------|------|
| 1 | `useTeamRole` 훅 + `GET /api/teams/{id}/me` | 다른 모든 기능의 전제 조건 |
| 2 | 권한 세분화 (BE: `verifyEditable` + FE: 조건부 렌더링) | 핵심 보안 기능 |
| 3 | 팀 설정 (BE: PUT/DELETE + FE: TeamSettingsDialog) | ADMIN 기능 |
| 4 | 프로젝트 설정 (BE: PUT + 엔티티 변경 + FE: ProjectSettingsDialog) | 편집 기능 |
| 5 | SQL DDL 내보내기 (FE 전용: ddl-generator + DdlExportDialog) | 독립 기능 |
