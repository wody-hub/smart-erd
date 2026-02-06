# 2단계: ERD 기본 구현 계획

## Context

1단계(로그인, 팀/프로젝트 CRUD)가 완료되었다. 2단계는 Smart ERD의 핵심 기능인 다이어그램 CRUD와 ERD 편집기(테이블/컬럼 CRUD, 관계 매핑, 캔버스 저장/로드)를 구현한다.

---

## 구현 순서 (6 Step)

### Step 1: 백엔드 — Diagram CRUD API

**수정 파일:**
- `domain/diagram/entity/Diagram.java` — `rename(String)` 메서드 추가
- `domain/diagram/repository/DiagramRepository.java` — `findByProject()`, `findByProjectAndId()` 추가

**신규 파일:**
- `api/diagram/DiagramController.java` — 6 엔드포인트 (POST/GET list/GET detail/PUT/DELETE/PATCH)
- `api/diagram/dto/CreateDiagramRequest.java` — `record(name)`
- `api/diagram/dto/SaveDiagramRequest.java` — `record(content)`
- `api/diagram/dto/RenameDiagramRequest.java` — `record(name)`
- `api/diagram/dto/DiagramResponse.java` — `record(id, name, projectId, createdAt, updatedAt)` + `from()`
- `api/diagram/dto/DiagramDetailResponse.java` — `record(id, name, projectId, content, createdAt, updatedAt)` + `from()`
- `domain/diagram/service/DiagramService.java` — ProjectService 패턴 그대로 따름

**패턴 참조:** `ProjectController`, `ProjectService`, `ProjectResponse`의 구조를 그대로 복제
**검증:** `./gradlew build` 통과

---

### Step 2: 프론트엔드 — DiagramsPage + 네비게이션

**신규 파일:**
- `client/src/pages/DiagramsPage.tsx` — 다이어그램 목록/생성/삭제/이름변경 (ProjectsPage 패턴 참조)
- `client/src/api/diagramApi.ts` — Diagram API 호출 모듈

**수정 파일:**
- `client/src/App.tsx` — `/teams/:teamId/projects/:projectId/diagrams` 라우트 추가
- `client/src/pages/ProjectsPage.tsx` — 프로젝트 클릭 시 `/diagrams/new` → `/diagrams` 로 변경

**검증:** 프로젝트 → 다이어그램 목록 → 생성/삭제 흐름 동작 확인

---

### Step 3: 프론트엔드 — 캔버스 로드/저장 연동

**수정 파일:**
- `client/src/stores/useCanvasStore.ts` — `isDirty`, `markClean` 추가
- `client/src/pages/DiagramPage.tsx` — API 로드(mount) + 저장(PUT) + Ctrl+S 단축키
- `client/src/components/layout/Header.tsx` — 다이어그램명 표시 + Save 버튼 + 저장 상태 표시 (props로 선택적 전달)

**검증:** 다이어그램 열기 → 저장 → 새로고침 → 상태 복원 확인

---

### Step 4: 프론트엔드 — Sidebar 테이블 목록 + 추가

**수정 파일:**
- `client/src/stores/useCanvasStore.ts` — `addTable`, `deleteTable`, `renameTable` 추가
- `client/src/components/layout/Sidebar.tsx` — 테이블 목록 표시, Add 버튼, 삭제/이름변경 액션
- `client/src/components/erd/ERDCanvas.tsx` — `useReactFlow` 인스턴스 연동 (노드 포커스용)

**신규 파일:**
- `client/src/components/layout/SidebarTableItem.tsx` — 테이블 항목 컴포넌트 (이름, 삭제, 이름변경, 클릭 포커스)

**검증:** Sidebar에서 테이블 추가 → 캔버스에 표시 → 삭제 → 이름변경

---

### Step 5: 프론트엔드 — 컬럼 편집 + 관계 연결

**수정 파일:**
- `client/src/stores/useCanvasStore.ts` — `addColumn`, `deleteColumn`, `updateColumn` 추가
- `client/src/components/erd/TableNode.tsx` — 인라인 편집 UI:
  - 테이블 헤더 더블클릭 → 이름 수정
  - 컬럼명/타입 클릭 → 인라인 Input
  - PK/FK/nullable 토글 (클릭)
  - "+" 버튼으로 컬럼 추가
  - hover 시 "x" 버튼으로 컬럼 삭제
  - `className="nodrag"` 으로 Input 요소의 드래그 방지

**검증:** 테이블 생성 → 컬럼 추가/수정/삭제 → 핸들 드래그로 FK 관계 연결 → 저장 → 복원

---

### Step 6: 포맷팅 + 최종 검증

- `npm run format` (Java + TypeScript)
- `./gradlew build` 통과
- `npm run build` 통과
- E2E 흐름: 로그인 → 팀 → 프로젝트 → 다이어그램 생성 → 테이블 2개 추가 → 컬럼 추가 → FK 연결 → 저장 → 새로고침 → 복원 확인

---

## 핵심 기술 결정

| 항목 | 결정 |
|------|------|
| 테이블/컬럼 편집 | TableNode 내 인라인 편집 (Input + `nodrag` class) |
| 다이어그램 목록 | 별도 DiagramsPage (Teams → Projects → Diagrams 계층 유지) |
| 저장 방식 | 수동 저장 (Save 버튼 + Ctrl+S) |
| Response 분리 | DiagramResponse (목록용, content 없음) / DiagramDetailResponse (상세용, content 포함) |
| 노드 ID | `table-${crypto.randomUUID()}` |
| 컬럼 ID | `col-${crypto.randomUUID()}` |
| 새 테이블 위치 | 기존 노드 바운딩 박스 우측 오프셋 |
