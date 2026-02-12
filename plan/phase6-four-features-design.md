# Smart ERD 4대 기능 설계서

## Context

ERD 편집기의 사용성과 완성도를 높이기 위해 4가지 기능을 추가한다:
1. **테이블명 용어사전 적용** — 컬럼과 동일하게 테이블명도 논리명/물리명 체계 적용
2. **컬럼 위치 변경** — 드래그로 컬럼 순서 조정
3. **DDL Import** — SQL DDL 문을 파싱하여 ERD 자동 생성
4. **테이블 색상 변경 + 서브영역** — 시각적 그룹핑 지원

---

## Feature 1: 테이블명 용어사전 적용

### 목표
테이블 헤더에 논리명(한글)과 물리명(영문)을 2줄로 표시하고, 컬럼의 `ColumnAutocomplete`와 동일한 용어사전 연동을 제공한다.

### 1-1. 타입 확장 — `types/erd.ts`

`TableNodeData` 인터페이스에 필드 추가:

```typescript
interface TableNodeData extends Record<string, unknown> {
  label: string;                // 물리 테이블명 (기존)
  logicalTableName?: string;    // 논리 테이블명
  tableTermId?: number;         // 연결된 Term ID
  columns: Column[];
}
```

### 1-2. Y.Doc 동기화 — `collaboration/yjsBridge.ts`

- `createTableYMap()`: `logicalTableName`, `tableTermId` 필드 저장
- `yTablesMapToNodes()`: 해당 필드 복원

```typescript
// createTableYMap 확장
if (logicalTableName) tableYMap.set('logicalTableName', logicalTableName);
if (tableTermId != null) tableYMap.set('tableTermId', tableTermId);

// yTablesMapToNodes 확장
logicalTableName: (tableYMap.get('logicalTableName') as string) ?? undefined,
tableTermId: (tableYMap.get('tableTermId') as number) ?? undefined,
```

### 1-3. 스토어 확장 — `stores/useCanvasStore.ts`

`updateTableMeta(nodeId, updates)` 액션 추가:

```typescript
updateTableMeta: (nodeId: string, updates: Partial<Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId'>>) => void
```

- Y.Doc의 tableYMap에서 해당 필드를 업데이트
- 기존 `renameTable`은 `label`만 변경 → `updateTableMeta`는 논리명/termId도 처리

### 1-4. TableNode 헤더 2줄 레이아웃 — `components/erd/TableNode.tsx`

기존 헤더(단일 라인 물리명)를 2줄 레이아웃으로 교체:

```
┌──────────────────────────────┐
│ 논리명 (ColumnAutocomplete)  │  ← 1줄: 논리명 입력/선택
│ 물리명 (input)               │  ← 2줄: 물리명 편집
└──────────────────────────────┘
```

- **1줄 (논리명)**: 기존 컬럼용 `ColumnAutocomplete`를 재활용하여 Term 검색/선택
- **2줄 (물리명)**: `<input>` 요소 (기존 헤더 편집과 유사)
- Term 선택 시: `logicalTableName` = Term.logicalName, `label` = Term.physicalName, `tableTermId` = Term.id
- 논리명이 없으면 물리명만 1줄로 표시 (하위 호환)

### 1-5. DDL 테이블 COMMENT — `lib/ddl-generator.ts`

테이블 논리명이 있을 때 `COMMENT ON TABLE` 문 생성:

```sql
-- PostgreSQL/Oracle
COMMENT ON TABLE "users" IS '사용자';

-- MySQL (CREATE TABLE 뒤)
CREATE TABLE `users` (...) ENGINE=InnoDB COMMENT='사용자';
```

### 1-6. i18n 키

```json
// erd.tableNode
"tableLogicalName": "테이블 논리명" / "Table logical name"
"tablePhysicalName": "테이블 물리명" / "Table physical name"
```

### 수정 파일 (7개)

| 파일 | 작업 |
|------|------|
| `types/erd.ts` | `TableNodeData`에 `logicalTableName`, `tableTermId` 추가 |
| `collaboration/yjsBridge.ts` | 테이블 Y.Map에 새 필드 저장/복원 |
| `stores/useCanvasStore.ts` | `updateTableMeta()` 액션 추가 |
| `components/erd/TableNode.tsx` | 헤더 2줄 레이아웃 + `ColumnAutocomplete` 재활용 |
| `lib/ddl-generator.ts` | 테이블 COMMENT 문 생성 |
| `i18n/locales/ko/translation.json` | 번역 키 추가 |
| `i18n/locales/en/translation.json` | 번역 키 추가 |

---

## Feature 2: 컬럼 위치 변경 (드래그)

### 목표
테이블 노드 내에서 컬럼을 드래그하여 순서를 변경할 수 있게 한다.

### 2-1. 의존성 추가

```bash
cd client && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --cache /tmp/npm-cache-smarterd
```

- `@dnd-kit/core`: 드래그 앤 드롭 엔진
- `@dnd-kit/sortable`: 정렬 가능 리스트
- `@dnd-kit/utilities`: CSS 유틸리티

### 2-2. Y.Doc 컬럼 이동 — `collaboration/yjsBridge.ts`

Y.Array는 `move()` 메서드가 없으므로 `delete` + `insert` 패턴 사용:

```typescript
/**
 * Y.Array 내 컬럼 위치를 이동한다.
 * Y.Map은 한 번 detach된 후 다시 attach할 수 없으므로 새 Y.Map을 복제하여 삽입한다.
 */
export function moveColumnInYArray(
  colsYArray: Y.Array<Y.Map<unknown>>,
  fromIndex: number,
  toIndex: number,
): void {
  const sourceMap = colsYArray.get(fromIndex);
  const cloned = cloneYMap(sourceMap);
  colsYArray.delete(fromIndex, 1);
  colsYArray.insert(toIndex > fromIndex ? toIndex - 1 : toIndex, [cloned]);
}
```

`cloneYMap` 헬퍼:
```typescript
function cloneYMap(source: Y.Map<unknown>): Y.Map<unknown> {
  const clone = new Y.Map<unknown>();
  source.forEach((value, key) => clone.set(key, value));
  return clone;
}
```

### 2-3. 스토어 확장 — `stores/useCanvasStore.ts`

```typescript
moveColumn: (nodeId: string, fromIndex: number, toIndex: number) => void
```

- `ydoc.transact()` 내에서 `moveColumnInYArray()` 호출
- observer가 자동으로 Zustand 상태 갱신

### 2-4. TableNode DnD 통합 — `components/erd/TableNode.tsx`

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

**구현 전략:**

1. **SortableColumnRow 래퍼**: 기존 컬럼 행 JSX를 감싸는 sortable 컴포넌트

```tsx
function SortableColumnRow({ col, ...props }: { col: Column; /* 기존 props */ }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="nodrag cursor-grab" {...attributes} {...listeners}>
        <GripVertical size={12} />
      </div>
      {/* 기존 컬럼 행 내용 */}
    </div>
  );
}
```

2. **DndContext 래핑**: 컬럼 목록을 `DndContext` + `SortableContext`로 감쌈

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
);

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
    {columns.map((col, index) => (
      <SortableColumnRow key={col.id} col={col} index={index} ... />
    ))}
  </SortableContext>
</DndContext>
```

3. **React Flow 충돌 방지**:
   - 드래그 핸들에 `nodrag` CSS 클래스 적용 (React Flow가 노드 드래그로 인식하지 않도록)
   - `PointerSensor`에 `distance: 5` 제약 (클릭과 드래그 구분)

4. **읽기 전용**: `canEdit === false`이면 드래그 핸들 숨김, DndContext 미적용

### 수정 파일 (4개)

| 파일 | 작업 |
|------|------|
| `package.json` | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 추가 |
| `collaboration/yjsBridge.ts` | `moveColumnInYArray()`, `cloneYMap()` 추가 |
| `stores/useCanvasStore.ts` | `moveColumn()` 액션 추가 |
| `components/erd/TableNode.tsx` | DndContext + SortableColumnRow 통합 |

---

## Feature 3: DDL Import

### 목표
SQL DDL 문자열을 파싱하여 테이블/컬럼/FK 관계를 자동으로 ERD에 추가한다.

### 3-1. 의존성 추가

```bash
cd client && npm install node-sql-parser --cache /tmp/npm-cache-smarterd
```

`node-sql-parser`: MySQL/PostgreSQL/기타 DBMS의 DDL을 AST로 파싱하는 라이브러리.

### 3-2. DDL 파서 모듈 — `lib/ddl-parser.ts` (신규)

```typescript
import { Parser } from 'node-sql-parser';

/** DDL 파싱 결과 */
interface DdlParseResult {
  tables: ParsedTable[];
  relations: ParsedRelation[];
  errors: string[];
}

interface ParsedTable {
  name: string;
  comment?: string;        // 테이블 COMMENT → logicalTableName
  columns: ParsedColumn[];
}

interface ParsedColumn {
  name: string;
  type: string;
  pk: boolean;
  nullable: boolean;
  autoIncrement: boolean;
  comment?: string;        // 컬럼 COMMENT → logicalName
}

interface ParsedRelation {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

/**
 * DDL 문자열을 파싱하여 테이블/관계 정보를 추출한다.
 *
 * @param ddl  SQL DDL 문자열
 * @param dbms 대상 DBMS ('postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'ansi')
 * @returns 파싱 결과
 */
export function parseDdl(ddl: string, dbms: DbmsType): DdlParseResult {
  const parser = new Parser();
  const opt = { database: mapDbmsToParserDb(dbms) };

  // 1. AST 파싱
  // 2. CREATE TABLE → ParsedTable[]
  // 3. ALTER TABLE ... ADD CONSTRAINT ... FK → ParsedRelation[]
  // 4. 인라인 FK 정의 → ParsedRelation[]
  // 5. COMMENT ON TABLE/COLUMN → logicalName 매핑
  // 6. 에러 수집
}
```

### 3-3. 스토어 확장 — `stores/useCanvasStore.ts`

```typescript
importDdl: (result: DdlParseResult) => void
```

- 기존 테이블과 이름 충돌 시 자동으로 접미사 추가 (`_1`, `_2`)
- dagre 자동 배치로 노드 위치 결정
- FK 관계를 `connectWithRelationType()`으로 엣지 생성

구현 흐름:
1. `result.tables` 순회 → `addTable()` (또는 직접 Y.Map 생성)
2. `result.relations` 순회 → 엣지 생성
3. 자동 배치 적용

### 3-4. DDL Import 다이얼로그 — `components/erd/DdlImportDialog.tsx` (신규)

기존 `DdlExportDialog` 패턴을 참고하여 역방향 구현:

```
┌─ DDL Import ──────────────────────┐
│                                    │
│ Target DBMS:  [PostgreSQL ▼]      │
│                                    │
│ ┌──────────────────────────────┐  │
│ │ Monaco Editor                │  │  ← DDL 입력 (붙여넣기/직접 입력)
│ │ (language="sql")             │  │
│ │                              │  │
│ └──────────────────────────────┘  │
│                                    │
│ Preview: 3 tables, 2 FK relations │  ← 파싱 결과 요약
│ Errors: 1 statement skipped       │  ← 에러 표시
│                                    │
│            [Cancel]  [Import]     │
└────────────────────────────────────┘
```

- Monaco Editor: 읽기/쓰기 모드 (붙여넣기 가능)
- 하단에 실시간 파싱 결과 프리뷰 (테이블 수, FK 수, 에러 수)
- Import 버튼: `importDdl()` 호출 → 다이얼로그 닫기

### 3-5. 툴바 통합 — `components/erd/CanvasToolbar.tsx`

DDL Export 버튼 옆에 DDL Import 버튼 추가:

```tsx
{canEdit && (
  <Button onClick={onImportDdl} variant="ghost" size="sm">
    <Upload className="mr-1 h-4 w-4" />
    {t('erd.toolbar.ddlImport')}
  </Button>
)}
```

### 3-6. ERDCanvas 통합 — `components/erd/ERDCanvas.tsx`

- `DdlImportDialog` 상태 관리 (`ddlImportOpen`)
- lazy import: `const DdlImportDialog = lazy(() => import('./DdlImportDialog'))`

### 수정 파일 (7개)

| 파일 | 작업 |
|------|------|
| `package.json` | `node-sql-parser` 추가 |
| `lib/ddl-parser.ts` | **신규** — DDL 파싱 모듈 |
| `stores/useCanvasStore.ts` | `importDdl()` 액션 추가 |
| `components/erd/DdlImportDialog.tsx` | **신규** — Import 다이얼로그 |
| `components/erd/CanvasToolbar.tsx` | Import 버튼 추가 |
| `components/erd/ERDCanvas.tsx` | Import 다이얼로그 상태/연결 |
| `i18n/locales/{en,ko}/translation.json` | 번역 키 추가 |

---

## Feature 4a: 테이블 색상 변경

### 목표
테이블 헤더 색상을 10가지 프리셋 중 선택하여 시각적 구분을 돕는다.

### 4a-1. 타입 — `types/erd.ts`

```typescript
/** 테이블 헤더 색상 프리셋 */
type TableHeaderColor =
  | 'default' | 'red' | 'orange' | 'amber' | 'green'
  | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink';

interface TableNodeData extends Record<string, unknown> {
  label: string;
  logicalTableName?: string;
  tableTermId?: number;
  headerColor?: TableHeaderColor;   // 추가
  columns: Column[];
}
```

### 4a-2. 색상 토큰 — `index.css` + `tailwind.config.js`

각 프리셋에 대해 `:root`와 `.dark`에 CSS Variable 정의:

```css
/* :root */
--erd-color-red: 0 72% 51%;
--erd-color-red-foreground: 0 0% 100%;
--erd-color-orange: 25 95% 53%;
--erd-color-orange-foreground: 0 0% 100%;
/* ... 8개 더 */

/* .dark */
--erd-color-red: 0 62% 40%;
/* ... */
```

### 4a-3. 색상 상수 — `lib/table-colors.ts` (신규)

```typescript
export const TABLE_COLORS: Record<TableHeaderColor, {
  label: string;           // i18n 키
  bg: string;              // CSS Variable (hsl)
  fg: string;              // 텍스트 CSS Variable
}> = {
  default: { label: 'erd.color.default', bg: 'var(--erd-table-header)', fg: 'var(--erd-table-header-foreground)' },
  red:     { label: 'erd.color.red',     bg: 'var(--erd-color-red)',    fg: 'var(--erd-color-red-foreground)' },
  // ...
};
```

### 4a-4. Y.Doc — `collaboration/yjsBridge.ts`

- `createTableYMap()`: `headerColor` 저장
- `yTablesMapToNodes()`: `headerColor` 복원

### 4a-5. TableNode 헤더 — `components/erd/TableNode.tsx`

헤더 `<div>`에 인라인 스타일로 색상 적용:

```tsx
const colorConfig = TABLE_COLORS[data.headerColor ?? 'default'];

<div
  className="..."
  style={{
    backgroundColor: `hsl(${colorConfig.bg})`,
    color: `hsl(${colorConfig.fg})`,
  }}
>
```

### 4a-6. 색상 선택 UI — `components/erd/TableColorPicker.tsx` (신규)

테이블 헤더 우클릭 또는 전용 버튼으로 Popover 표시:

```
┌─ 색상 선택 ────────────────────┐
│ ● ● ● ● ● ● ● ● ● ●         │  ← 10개 원형 프리셋
└────────────────────────────────┘
```

- 10개 색상 원형 버튼 (가로 나열)
- 클릭 시 `updateTableMeta(nodeId, { headerColor: color })` 호출

### 4a-7. 스토어 — `stores/useCanvasStore.ts`

`updateTableMeta`에 `headerColor` 포함 (Feature 1에서 추가한 함수 재활용):

```typescript
updateTableMeta: (nodeId, updates: Partial<Pick<TableNodeData, 'label' | 'logicalTableName' | 'tableTermId' | 'headerColor'>>) => void
```

### 수정 파일 (8개)

| 파일 | 작업 |
|------|------|
| `types/erd.ts` | `TableHeaderColor` 타입, `TableNodeData.headerColor` 추가 |
| `index.css` | 10개 색상 CSS Variable (light/dark) |
| `tailwind.config.js` | 시맨틱 매핑 (선택 — 인라인 스타일 사용 시 불필요) |
| `lib/table-colors.ts` | **신규** — 색상 프리셋 상수 |
| `collaboration/yjsBridge.ts` | `headerColor` 저장/복원 |
| `stores/useCanvasStore.ts` | `updateTableMeta` 확장 |
| `components/erd/TableNode.tsx` | 헤더 색상 적용 + 색상 버튼 |
| `components/erd/TableColorPicker.tsx` | **신규** — 색상 선택 Popover |

---

## Feature 4b: 서브영역 (그룹 노드)

### 목표
여러 테이블을 시각적으로 묶는 그룹 영역을 생성하고, 이름을 지정할 수 있게 한다.

### 4b-1. 타입 — `types/erd.ts`

```typescript
/** 그룹 노드 데이터 */
interface GroupNodeData extends Record<string, unknown> {
  label: string;
  color?: TableHeaderColor;  // 그룹 영역 색상
}

/** 그룹 노드 타입 */
type GroupNode = Node<GroupNodeData>;
```

### 4b-2. Y.Doc 구조 확장

기존 `tables` Y.Map과 별도로 `groups` Y.Map 추가:

```
Y.Doc
├── tables: Y.Map  (기존)
├── edges: Y.Map   (기존)
└── groups: Y.Map<groupId, Y.Map>  (신규)
    └── groupId
        ├── label: string
        ├── position: Y.Map { x, y }
        ├── width: number
        ├── height: number
        └── color?: TableHeaderColor
```

`yjsBridge.ts`에 `getGroupsMap()`, `createGroupYMap()`, `yGroupsMapToNodes()` 추가.

### 4b-3. GroupNode 컴포넌트 — `components/erd/GroupNode.tsx` (신규)

React Flow의 `parentId` 기반이 아닌 **독립 노드 + NodeResizer** 방식:

```tsx
import { NodeResizer } from '@xyflow/react';

export default function GroupNode({ id, data, selected }: NodeProps<GroupNodeData>) {
  return (
    <div className="relative rounded-lg border-2 border-dashed bg-muted/30 min-w-[200px] min-h-[150px]">
      <NodeResizer isVisible={selected} minWidth={200} minHeight={150} />
      <div className="absolute top-0 left-2 -translate-y-1/2 px-2 bg-background text-xs font-medium">
        {data.label}
      </div>
    </div>
  );
}
```

- `z-index: -1`로 테이블 노드 아래에 렌더링
- `NodeResizer`로 크기 조절 가능
- 점선 테두리 + 반투명 배경
- 라벨은 상단 테두리에 겹치는 형태

### 4b-4. ERDCanvas 등록 — `components/erd/ERDCanvas.tsx`

```typescript
const nodeTypes: NodeTypes = {
  table: TableNode,
  group: GroupNode,    // 추가
};
```

### 4b-5. 스토어 — `stores/useCanvasStore.ts`

```typescript
addGroup: (label?: string) => void      // 그룹 노드 추가
deleteGroup: (groupId: string) => void  // 그룹 노드 삭제
renameGroup: (groupId: string, newName: string) => void
resizeGroup: (groupId: string, width: number, height: number) => void
```

- 그룹은 `type: 'group'`으로 nodes 배열에 포함
- Y.Doc observer에서 groups 맵도 감시하여 Zustand 갱신

### 4b-6. 사이드바 확장 — `components/layout/Sidebar.tsx`

테이블 목록 아래에 그룹 섹션 추가:

```
┌── Tables ──────────── [+] ──┐
│ users                        │
│ orders                       │
│ products                     │
├── Groups ──────────── [+] ──┤
│ Core Domain                  │
│ Payment Module               │
└──────────────────────────────┘
```

### 4b-7. 자동 배치 — `lib/auto-layout.ts`

그룹 노드는 자동 배치 대상에서 제외 (위치/크기가 사용자 설정):

```typescript
// 자동 배치 시 type === 'group'인 노드는 필터링
const layoutTargets = nodes.filter(n => n.type !== 'group');
```

### 수정 파일 (8개)

| 파일 | 작업 |
|------|------|
| `types/erd.ts` | `GroupNodeData` 인터페이스 |
| `collaboration/yjsBridge.ts` | `groups` Y.Map 관리 함수 |
| `stores/useCanvasStore.ts` | 그룹 CRUD 액션 |
| `components/erd/GroupNode.tsx` | **신규** — 그룹 노드 컴포넌트 |
| `components/erd/ERDCanvas.tsx` | GroupNode 등록, 그룹 관련 이벤트 |
| `components/layout/Sidebar.tsx` | 그룹 섹션 추가 |
| `lib/auto-layout.ts` | 그룹 노드 제외 처리 |
| `i18n/locales/{en,ko}/translation.json` | 번역 키 추가 |

---

## 구현 순서

| Phase | 기능 | 이유 |
|-------|------|------|
| Phase 0 | `types/erd.ts` 타입 일괄 확장 | Feature 1 + 4a + 4b 필드를 한 번에 정의하여 Phase 1 병렬 작업 시 타입 충돌 방지 |
| Phase 1 | Feature 1 (테이블명 사전) + Feature 4a (색상) | 동시에 `TableNodeData` 확장. 병렬 작업 가능 |
| Phase 2 | Feature 2 (컬럼 드래그) | TableNode 내부 수정. Phase 1 완료 후 안정적 기반 위에 작업 |
| Phase 3 | Feature 3 (DDL Import) | 외부 라이브러리 의존. 독립적으로 구현 가능 |
| Phase 4 | Feature 4b (그룹 노드) | 새 노드 타입 + Y.Doc 구조 확장. 가장 영향 범위 넓음 |

### Phase 0 상세 — 타입 일괄 확장

Phase 1에서 Feature 1과 4a를 병렬 작업할 때 `TableNodeData` 타입 충돌을 방지하기 위해, 모든 기능에 필요한 타입을 한 번에 정의한다.

```typescript
// types/erd.ts — Phase 0에서 일괄 추가

/** 테이블 헤더 색상 프리셋 */
export type TableHeaderColor =
  | 'default' | 'red' | 'orange' | 'amber' | 'green'
  | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink';

export interface TableNodeData extends Record<string, unknown> {
  label: string;
  logicalTableName?: string;       // Feature 1
  tableTermId?: number;            // Feature 1
  headerColor?: TableHeaderColor;  // Feature 4a
  columns: Column[];
}

/** 그룹 노드 데이터 (Feature 4b) */
export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  color?: TableHeaderColor;
}

/** 그룹 노드 타입 (Feature 4b) */
export type GroupNode = Node<GroupNodeData, 'group'>;

/** 캔버스에 표시되는 모든 노드의 유니온 타입 (Feature 4b) */
export type CanvasNode = TableNode | GroupNode;
```

---

## 보강 사항

### 보강 1: DDL 테이블 COMMENT — `DbmsDialect` 시그니처 확장

현재 `DbmsDialect.comment(table, column, text)`는 **컬럼 COMMENT 전용**이다. 테이블 COMMENT를 위해 별도 메서드를 추가한다.

#### `lib/ddl-generator.ts` 변경

**1) `DbmsDialect` 인터페이스에 `tableComment` 추가:**

```typescript
interface DbmsDialect {
  quote(name: string): string;
  statementSeparator: string;
  comment?(table: string, column: string, text: string): string;          // 기존 (컬럼용)
  tableComment?(table: string, text: string): string;                     // 신규 (테이블용)
  tableOptions?: string;
  inlineComment?(text: string): string;
  inlineTableComment?(text: string): string;                              // 신규 (MySQL 테이블용)
  autoIncrement?: { token: string; afterNotNull?: boolean };
}
```

**2) 방언 레지스트리 확장:**

```typescript
const dialects: Record<DbmsType, DbmsDialect> = {
  postgresql: {
    // ... 기존 유지
    tableComment: (table, text) =>
      `COMMENT ON TABLE "${escapeDoubleQuote(table)}" IS '${escapeQuote(text)}'`,
  },
  mysql: {
    // ... 기존 유지
    inlineTableComment: (text) => ` COMMENT='${escapeQuote(text)}'`,
    // MySQL은 CREATE TABLE 뒤에 인라인: CREATE TABLE ... ENGINE=InnoDB COMMENT='사용자'
  },
  oracle: {
    // ... 기존 유지
    tableComment: (table, text) =>
      `COMMENT ON TABLE "${escapeDoubleQuote(table)}" IS '${escapeQuote(text)}'`,
  },
  sqlserver: {
    // ... 기존 유지
    // SQL Server는 sp_addextendedproperty 프로시저 — 복잡도 대비 효용 낮아 미지원
  },
  ansi: {
    // ... 기존 유지 (COMMENT 미지원)
  },
};
```

**3) `generateDdl()` 함수 — CREATE TABLE 생성부 수정:**

```typescript
// MySQL 인라인 테이블 COMMENT
const tableOptions = dialect.tableOptions ?? '';
const tableInlineComment =
  dialect.inlineTableComment && node.data.logicalTableName
    ? dialect.inlineTableComment(node.data.logicalTableName)
    : '';
statements.push(
  `CREATE TABLE ${dialect.quote(label)} (\n${tableBody}\n)${tableOptions}${tableInlineComment}${dialect.statementSeparator}`,
);
```

**4) COMMENT ON TABLE 문 생성부 추가:**

```typescript
// 기존 COMMENT ON COLUMN 코드 위에 추가
if (dialect.tableComment) {
  for (const node of sortedNodes) {
    if (node.data.logicalTableName) {
      commentStatements.push(
        `${dialect.tableComment(node.data.label, node.data.logicalTableName)}${dialect.statementSeparator}`,
      );
    }
  }
}
```

---

### 보강 2: 그룹 직렬화 — `yDocToJson`, `migrateJsonToYDoc`, `prepareBackup`

Feature 4b에서 `groups` Y.Map이 추가되면, 기존 직렬화 함수들도 groups를 처리해야 한다. 누락 시 저장/로드에서 그룹 정보가 유실된다.

#### `collaboration/yjsBridge.ts` 변경

**1) `getGroupsMap()` 함수 추가:**

```typescript
/**
 * Y.Doc에서 그룹 Y.Map을 반환한다.
 *
 * @param doc Y.Doc
 * @returns groups Y.Map
 */
export function getGroupsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap('groups') as Y.Map<Y.Map<unknown>>;
}
```

**2) `createGroupYMap()` 함수 추가:**

```typescript
/**
 * 그룹 데이터를 Y.Map으로 변환한다.
 *
 * @param label    그룹 이름
 * @param position 위치 좌표
 * @param width    너비
 * @param height   높이
 * @param color    색상 (옵션)
 * @returns Y.Map 인스턴스
 */
export function createGroupYMap(
  label: string,
  position: { x: number; y: number },
  width: number,
  height: number,
  color?: TableHeaderColor,
): Y.Map<unknown> {
  const groupYMap = new Y.Map<unknown>();
  groupYMap.set('label', label);

  const posYMap = new Y.Map<number>();
  posYMap.set('x', position.x);
  posYMap.set('y', position.y);
  groupYMap.set('position', posYMap);

  groupYMap.set('width', width);
  groupYMap.set('height', height);
  if (color) groupYMap.set('color', color);

  return groupYMap;
}
```

**3) `yGroupsMapToNodes()` 함수 추가:**

```typescript
/**
 * Y.Map으로 표현된 그룹들을 React Flow Node 배열로 변환한다.
 *
 * @param groupsMap Y.Map<groupId, Y.Map>
 * @returns React Flow 그룹 노드 배열
 */
export function yGroupsMapToNodes(groupsMap: Y.Map<Y.Map<unknown>>): Node<GroupNodeData>[] {
  const nodes: Node<GroupNodeData>[] = [];

  groupsMap.forEach((groupYMap, groupId) => {
    const positionYMap = groupYMap.get('position') as Y.Map<number> | undefined;

    nodes.push({
      id: groupId,
      type: 'group',
      position: {
        x: positionYMap?.get('x') ?? 100,
        y: positionYMap?.get('y') ?? 100,
      },
      style: {
        width: (groupYMap.get('width') as number) ?? 400,
        height: (groupYMap.get('height') as number) ?? 300,
      },
      data: {
        label: (groupYMap.get('label') as string) ?? 'Group',
        color: (groupYMap.get('color') as TableHeaderColor) ?? undefined,
      },
    });
  });

  return nodes;
}
```

**4) `yDocToJson()` 수정 — groups 포함:**

```typescript
export function yDocToJson(doc: Y.Doc): string {
  const tablesMap = getTablesMap(doc);
  const edgesMap = getEdgesMap(doc);
  const groupsMap = getGroupsMap(doc);

  const nodes = yTablesMapToNodes(tablesMap);
  const edges = yEdgesMapToEdges(edgesMap);
  const groups = yGroupsMapToNodes(groupsMap);

  return JSON.stringify({ nodes, edges, groups });
}
```

**5) `migrateJsonToYDoc()` 수정 — groups 복원:**

```typescript
export function migrateJsonToYDoc(doc: Y.Doc, json: string): void {
  try {
    const parsed = JSON.parse(json) as {
      nodes?: Node<TableNodeData>[];
      edges?: Edge[];
      groups?: Node<GroupNodeData>[];    // 신규
    };

    const nodesArray = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const edgesArray = Array.isArray(parsed.edges) ? parsed.edges : [];
    const groupsArray = Array.isArray(parsed.groups) ? parsed.groups : [];  // 기존 데이터에 없으면 빈 배열

    doc.transact(() => {
      const tablesMap = getTablesMap(doc);
      const edgesMap = getEdgesMap(doc);
      const groupsMap = getGroupsMap(doc);

      // 기존 테이블/엣지 복원 (변경 없음)
      for (const node of nodesArray) { /* ... */ }
      for (const edge of edgesArray) { /* ... */ }

      // 그룹 복원
      for (const group of groupsArray) {
        const groupYMap = createGroupYMap(
          group.data?.label ?? 'Group',
          { x: group.position?.x ?? 100, y: group.position?.y ?? 100 },
          (group.style?.width as number) ?? 400,
          (group.style?.height as number) ?? 300,
          group.data?.color,
        );
        groupsMap.set(group.id, groupYMap);
      }
    });
  } catch (err) {
    console.warn('[yjsBridge] migrateJsonToYDoc failed, starting with empty Y.Doc:', err);
  }
}
```

**6) `prepareBackup()` 변경 불필요:**

`prepareBackup()`은 `yDocToJson(ydoc)`을 호출하여 JSON 문자열을 생성하므로, `yDocToJson()`이 groups를 포함하면 자동으로 반영된다. 추가 수정 불필요.

---

### 보강 3: 타입 유니온 — 그룹 노드 혼재 처리 전략

Feature 4b에서 `nodes` 배열에 `type: 'table'`과 `type: 'group'`이 혼재한다. 타입 안전성을 유지하기 위한 전략:

#### 전략: 분리된 상태 관리 (권장)

`CanvasState`에서 테이블 노드와 그룹 노드를 **별도 배열**로 관리한다. React Flow에 전달할 때만 합친다.

```typescript
// stores/useCanvasStore.ts
interface CanvasState {
  nodes: Node<TableNodeData>[];     // 기존 (테이블 전용)
  groupNodes: Node<GroupNodeData>[]; // 신규 (그룹 전용)
  edges: Edge[];
  // ...
}
```

**React Flow 전달 시 합치기 (ERDCanvas.tsx):**

```typescript
const nodes = useCanvasStore((s) => s.nodes);
const groupNodes = useCanvasStore((s) => s.groupNodes);

// 그룹 노드를 테이블 아래에 렌더링 (z-index)
const allNodes = useMemo(
  () => [...groupNodes, ...nodes],  // 그룹이 먼저 → 뒤에 렌더링됨 → z-index 아래
  [groupNodes, nodes],
);

<ReactFlow nodes={allNodes} ... />
```

**이 전략의 이점:**
- 기존 `nodes: Node<TableNodeData>[]` 타입 **변경 불필요** — 모든 기존 코드 호환
- `applyDagreLayout()`의 시그니처 **변경 불필요** — `nodes`만 전달하면 됨
- `Sidebar`에서 별도 필터링 **불필요** — `nodes`가 이미 테이블 전용
- `generateDdl()`에 영향 없음 — `nodes as TableNode[]` 캐스팅 유지

#### `initYDoc()` 확장:

```typescript
initYDoc: (ydoc) => {
  const tablesMap = getTablesMap(ydoc);
  const edgesMap = getEdgesMap(ydoc);
  const groupsMap = getGroupsMap(ydoc);  // 신규

  set({
    nodes: yTablesMapToNodes(tablesMap),
    edges: yEdgesMapToEdges(edgesMap),
    groupNodes: yGroupsMapToNodes(groupsMap),  // 신규
    ydoc,
    lastBackupHash: djb2(yDocToJson(ydoc)),
  });

  // 기존 tables/edges observer (변경 없음)

  // 신규: groups observer
  groupsObserver = () => {
    set({ groupNodes: yGroupsMapToNodes(groupsMap) });
  };
  groupsMap.observeDeep(groupsObserver);
},
```

---

### 보강 4: 다크 모드 색상값 — 10개 프리셋 HSL 구체화

#### `index.css` 추가 내용

```css
/* :root (Light) */
--erd-color-red: 0 72% 51%;
--erd-color-red-foreground: 0 0% 100%;
--erd-color-orange: 25 95% 53%;
--erd-color-orange-foreground: 0 0% 100%;
--erd-color-amber: 45 93% 47%;
--erd-color-amber-foreground: 0 0% 10%;
--erd-color-green: 142 76% 36%;
--erd-color-green-foreground: 0 0% 100%;
--erd-color-teal: 173 80% 40%;
--erd-color-teal-foreground: 0 0% 100%;
--erd-color-blue: 221 83% 53%;
--erd-color-blue-foreground: 0 0% 100%;
--erd-color-indigo: 239 84% 67%;
--erd-color-indigo-foreground: 0 0% 100%;
--erd-color-purple: 270 60% 55%;
--erd-color-purple-foreground: 0 0% 100%;
--erd-color-pink: 330 81% 60%;
--erd-color-pink-foreground: 0 0% 100%;

/* .dark */
--erd-color-red: 0 62% 40%;
--erd-color-red-foreground: 0 0% 100%;
--erd-color-orange: 25 80% 42%;
--erd-color-orange-foreground: 0 0% 100%;
--erd-color-amber: 45 80% 38%;
--erd-color-amber-foreground: 0 0% 100%;
--erd-color-green: 142 60% 32%;
--erd-color-green-foreground: 0 0% 100%;
--erd-color-teal: 173 65% 35%;
--erd-color-teal-foreground: 0 0% 100%;
--erd-color-blue: 221 70% 48%;
--erd-color-blue-foreground: 0 0% 100%;
--erd-color-indigo: 239 65% 55%;
--erd-color-indigo-foreground: 0 0% 100%;
--erd-color-purple: 270 50% 48%;
--erd-color-purple-foreground: 0 0% 100%;
--erd-color-pink: 330 65% 50%;
--erd-color-pink-foreground: 0 0% 100%;
```

**설계 원칙:**
- 다크 모드에서는 채도(S)를 10~20% 낮추고, 밝기(L)를 8~12% 낮춰 눈부심을 방지한다
- `amber`(Light)만 전경색이 `10%`(어두운) — 밝은 배경에서 흰색 텍스트가 읽기 어려우므로
- 다크 모드의 `amber`는 밝기가 낮아져 흰색 전경(`100%`)이 적합

---

### 보강 5: 접근성 — 신규 UI 요소 `aria-label`

#### Feature 2 — 드래그 핸들

```tsx
<div className="nodrag cursor-grab" {...attributes} {...listeners}>
  <GripVertical size={12} aria-hidden="true" />
  <span className="sr-only">{t('erd.tableNode.aria.reorderColumn', { name: col.name })}</span>
</div>
```

#### Feature 4a — 색상 선택기

```tsx
{TABLE_COLOR_ENTRIES.map(([key, config]) => (
  <button
    key={key}
    className="..."
    style={{ backgroundColor: `hsl(${config.bg})` }}
    onClick={() => updateTableMeta(id, { headerColor: key })}
    aria-label={t('erd.colorPicker.aria.selectColor', { color: t(config.label) })}
    aria-pressed={currentColor === key}
  />
))}
```

#### Feature 4b — 그룹 노드

```tsx
<div
  className="..."
  role="group"
  aria-label={t('erd.groupNode.aria.group', { name: data.label })}
>
  <NodeResizer isVisible={selected} minWidth={200} minHeight={150} />
  <input
    className="..."
    value={data.label}
    aria-label={t('erd.groupNode.aria.groupName')}
  />
</div>
```

#### i18n 키 추가

```json
// ko
"erd.tableNode.aria.reorderColumn": "{{name}} 컬럼 순서 변경",
"erd.colorPicker.aria.selectColor": "테이블 색상을 {{color}}으로 변경",
"erd.groupNode.aria.group": "{{name}} 그룹 영역",
"erd.groupNode.aria.groupName": "그룹 이름"

// en
"erd.tableNode.aria.reorderColumn": "Reorder column {{name}}",
"erd.colorPicker.aria.selectColor": "Change table color to {{color}}",
"erd.groupNode.aria.group": "{{name}} group area",
"erd.groupNode.aria.groupName": "Group name"
```

---

### 보강 6: 번들 사이즈 — `node-sql-parser` 코드 스플리팅 전략

`node-sql-parser`는 **300~500KB gzipped**로 프로젝트 번들에서 가장 큰 단일 의존성이다.

#### 전략: Dynamic Import (lazy 미사용)

기존 코드베이스에서 `React.lazy()` / `Suspense`를 사용하지 않으므로, **dynamic import** 패턴으로 처리한다. DdlImportDialog 컴포넌트 자체는 일반 import하되, 파서 모듈만 동적 로드한다.

```typescript
// lib/ddl-parser.ts
let parserModule: typeof import('node-sql-parser') | null = null;

/**
 * DDL 파서 모듈을 동적으로 로드한다 (최초 1회만).
 *
 * @returns node-sql-parser 모듈
 */
async function getParser(): Promise<typeof import('node-sql-parser')> {
  if (!parserModule) {
    parserModule = await import('node-sql-parser');
  }
  return parserModule;
}

/**
 * DDL 문자열을 파싱하여 테이블/관계 정보를 추출한다.
 *
 * @param ddl  SQL DDL 문자열
 * @param dbms 대상 DBMS
 * @returns 파싱 결과
 */
export async function parseDdl(ddl: string, dbms: DbmsType): Promise<DdlParseResult> {
  const { Parser } = await getParser();
  const parser = new Parser();
  // ... 파싱 로직
}
```

**DdlImportDialog에서 사용:**

```typescript
// components/erd/DdlImportDialog.tsx

/** 파싱 결과 상태 */
const [parseResult, setParseResult] = useState<DdlParseResult | null>(null);
/** 파싱 중 여부 */
const [parsing, setParsing] = useState(false);

/** DDL 텍스트 변경 시 디바운스 파싱 */
const handleDdlChange = useDebouncedCallback(async (ddlText: string) => {
  if (!ddlText.trim()) {
    setParseResult(null);
    return;
  }
  setParsing(true);
  try {
    const result = await parseDdl(ddlText, dbms);
    setParseResult(result);
  } catch {
    setParseResult({ tables: [], relations: [], errors: ['Failed to parse DDL'] });
  } finally {
    setParsing(false);
  }
}, 500);
```

**이점:**
- `node-sql-parser`가 Vite의 코드 스플리팅으로 별도 청크로 분리됨
- 초기 로드에 영향 없음, DDL Import 다이얼로그 열 때만 로드
- `React.lazy()` / `Suspense` 인프라 도입 불필요

**추가 수정 파일:** `parseDdl()` 함수 시그니처가 `Promise<DdlParseResult>` (비동기)로 변경됨에 따라, `importDdl()` 스토어 액션 호출부에서 `await`를 사용하거나 DdlImportDialog에서 파싱 결과를 state로 관리해야 함 (위 코드 참조).

---

### 보강 7: Sidebar 그룹 필터링

**보강 3에서 `nodes`와 `groupNodes`를 분리 관리하므로, Sidebar는 별도 필터링이 불필요하다.**

`Sidebar`는 기존 그대로 `nodes`(테이블 전용)만 사용하며, 그룹 섹션을 별도로 추가한다:

```tsx
// components/layout/Sidebar.tsx

const groupNodes = useCanvasStore((s) => s.groupNodes);
const addGroup = useCanvasStore((s) => s.addGroup);
const deleteGroup = useCanvasStore((s) => s.deleteGroup);
const renameGroup = useCanvasStore((s) => s.renameGroup);

return (
  <aside className="w-56 bg-muted border-r border-border p-4 shrink-0 flex flex-col">
    {/* 기존 Tables 섹션 (변경 없음) */}
    <div className="flex items-center justify-between mb-3">
      <h2 className="...">{t('erd.sidebar.tables')}</h2>
      {canEdit && <Button ... onClick={() => addTable()} ... />}
    </div>
    <div className="flex-1 overflow-auto space-y-0.5">
      {nodes.map((node) => <SidebarTableItem ... />)}
    </div>

    {/* 신규 Groups 섹션 */}
    <div className="flex items-center justify-between mt-4 mb-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {t('erd.sidebar.groups')}
      </h2>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => addGroup()}
          title={t('erd.sidebar.addGroup')}
          aria-label={t('erd.sidebar.aria.addGroup')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
    <div className="overflow-auto space-y-0.5">
      {groupNodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('erd.sidebar.noGroups')}</p>
      ) : (
        groupNodes.map((group) => (
          <SidebarTableItem
            key={group.id}
            nodeId={group.id}
            label={group.data.label}
            onClick={() => handleFocusNode(group.id)}
            onRename={(newName) => renameGroup(group.id, newName)}
            onDelete={() => deleteGroup(group.id)}
            canEdit={canEdit}
          />
        ))
      )}
    </div>
  </aside>
);
```

---

### 보강 8: `createTableYMap` 시그니처 확장

Feature 1에서 `logicalTableName`, `tableTermId`를, Feature 4a에서 `headerColor`를 추가하므로 함수 시그니처를 변경한다.

#### 변경 전 (현재)

```typescript
export function createTableYMap(
  label: string,
  position: { x: number; y: number },
  columns: Column[],
): Y.Map<unknown>
```

#### 변경 후

```typescript
/** 테이블 Y.Map 생성 옵션 */
interface CreateTableOptions {
  /** 테이블 논리명 */
  logicalTableName?: string;
  /** 연결된 Term ID */
  tableTermId?: number;
  /** 헤더 색상 프리셋 */
  headerColor?: TableHeaderColor;
}

/**
 * 테이블 데이터를 Y.Map으로 변환한다.
 *
 * @param label    테이블 이름 (물리명)
 * @param position 위치 좌표
 * @param columns  컬럼 배열
 * @param options  추가 옵션 (논리명, termId, 색상)
 * @returns Y.Map 인스턴스
 */
export function createTableYMap(
  label: string,
  position: { x: number; y: number },
  columns: Column[],
  options?: CreateTableOptions,
): Y.Map<unknown> {
  const tableYMap = new Y.Map<unknown>();
  tableYMap.set('label', label);

  const posYMap = new Y.Map<number>();
  posYMap.set('x', position.x);
  posYMap.set('y', position.y);
  tableYMap.set('position', posYMap);

  const colsYArray = new Y.Array<Y.Map<unknown>>();
  for (const col of columns) {
    colsYArray.push([createColumnYMap(col)]);
  }
  tableYMap.set('columns', colsYArray);

  // 추가 옵션
  if (options?.logicalTableName) tableYMap.set('logicalTableName', options.logicalTableName);
  if (options?.tableTermId != null) tableYMap.set('tableTermId', options.tableTermId);
  if (options?.headerColor && options.headerColor !== 'default') {
    tableYMap.set('headerColor', options.headerColor);
  }

  return tableYMap;
}
```

기존 호출부(`addTable()`, `migrateJsonToYDoc()`)는 4번째 인자가 `optional`이므로 **변경 없이 호환된다.**

---

### 추가 보강: 에러 처리 전략

#### DDL Import 에러 처리

```
┌─ DDL Import ────────────────────────────┐
│                                          │
│ Target DBMS:  [PostgreSQL ▼]            │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Monaco Editor (writable, sql)       │ │
│ │                                      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ✅ Preview: 3 tables, 2 FK relations    │  ← 성공: 초록 체크
│ ⚠️  1 statement skipped (line 24)       │  ← 경고: 주황 삼각형 (무시 가능)
│                                          │
│ ❌ Parse error at line 5: ...           │  ← 실패: 빨간 X (전체 실패일 때)
│                                          │
│              [Cancel]  [Import]          │  ← Import 비활성: tables === 0
└──────────────────────────────────────────┘
```

- **부분 성공**: 일부 문장만 실패 → 성공한 테이블은 표시, 실패 문장은 경고로 표시
- **전체 실패**: 파싱 자체 불가 → 에러 메시지 표시, Import 버튼 비활성화
- **빈 입력**: Preview 영역 숨김, Import 버튼 비활성화
- **Import 완료 후**: `toast.success(t('erd.ddlImport.success', { count: tables.length }))`
- **Import 에러**: `toast.error(getErrorMessage(err, t('erd.ddlImport.failed')))`

#### DdlImportDialog 파싱 결과 상태 표시

```tsx
{parseResult && (
  <div className="flex items-center gap-2 text-sm">
    {parseResult.tables.length > 0 && (
      <span className="text-success">
        ✓ {t('erd.ddlImport.preview', {
          tables: parseResult.tables.length,
          relations: parseResult.relations.length,
        })}
      </span>
    )}
    {parseResult.errors.length > 0 && (
      <span className="text-erd-warning">
        ⚠ {t('erd.ddlImport.warnings', { count: parseResult.errors.length })}
      </span>
    )}
    {parseResult.tables.length === 0 && parseResult.errors.length > 0 && (
      <span className="text-destructive">
        ✗ {t('erd.ddlImport.parseError')}
      </span>
    )}
  </div>
)}
```

---

### 추가 보강: Monaco Editor 다크 모드

현재 DdlExportDialog에서 `theme="vs-dark"` 하드코딩됨. DdlImportDialog에서는 시스템 테마에 맞추도록 처리한다.

```tsx
// 다크 모드 감지
const isDark = document.documentElement.classList.contains('dark');

<Editor
  height="300px"
  language="sql"
  value={ddlText}
  onChange={(value) => handleDdlChange(value ?? '')}
  options={{
    readOnly: false,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineNumbers: 'on',
    wordWrap: 'on',
  }}
  theme={isDark ? 'vs-dark' : 'vs'}
/>
```

> 기존 DdlExportDialog도 동일 패턴으로 수정 권장.

---

### 추가 보강: 색상 선택기 트리거 확정

**전용 아이콘 버튼 방식** 채택 (우클릭 X):

- 우클릭은 향후 테이블 컨텍스트 메뉴 확장에 예약
- 테이블 헤더 좌측에 작은 `Palette` 아이콘 버튼 추가 (hover 시 표시)

```tsx
// TableNode.tsx — 헤더 영역
<div className="bg-erd-table-header ... flex items-center gap-2">
  {canEdit && (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="nodrag opacity-0 group-hover:opacity-100 h-4 w-4 rounded-sm hover:bg-black/20 transition-opacity"
          aria-label={t('erd.tableNode.aria.changeColor')}
        >
          <Palette className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-auto p-2">
        <TableColorPicker
          currentColor={data.headerColor ?? 'default'}
          onSelect={(color) => updateTableMeta(id, { headerColor: color })}
        />
      </PopoverContent>
    </Popover>
  )}
  <span className="flex-1 ...">{label}</span>
</div>
```

---

### 수정 파일 총합 (전체 기능)

| 파일 | Feature | 작업 |
|------|---------|------|
| `types/erd.ts` | 0, 1, 4a, 4b | 타입 일괄 확장 |
| `collaboration/yjsBridge.ts` | 1, 2, 4a, 4b | 테이블/그룹 Y.Map 확장, `moveColumn`, 직렬화 |
| `stores/useCanvasStore.ts` | 1, 2, 3, 4a, 4b | `updateTableMeta`, `moveColumn`, `importDdl`, 그룹 CRUD |
| `components/erd/TableNode.tsx` | 1, 2, 4a | 헤더 레이아웃, DnD, 색상 적용/선택기 트리거 |
| `components/erd/ERDCanvas.tsx` | 3, 4b | Import 다이얼로그, GroupNode 등록 |
| `components/erd/CanvasToolbar.tsx` | 3 | Import 버튼 추가 |
| `components/layout/Sidebar.tsx` | 4b | 그룹 섹션 추가 |
| `lib/ddl-generator.ts` | 1 | 테이블 COMMENT (`tableComment`, `inlineTableComment`) |
| `lib/ddl-parser.ts` | 3 | **신규** — DDL 파서 (dynamic import) |
| `lib/auto-layout.ts` | 4b | 그룹 노드 제외 (분리 관리 시 변경 불필요) |
| `lib/table-colors.ts` | 4a | **신규** — 색상 프리셋 상수 |
| `components/erd/DdlImportDialog.tsx` | 3 | **신규** — Import 다이얼로그 |
| `components/erd/TableColorPicker.tsx` | 4a | **신규** — 색상 선택 Popover |
| `components/erd/GroupNode.tsx` | 4b | **신규** — 그룹 노드 컴포넌트 |
| `components/erd/DdlExportDialog.tsx` | — | 다크 모드 테마 대응 (부수 수정) |
| `index.css` | 4a | 10개 색상 CSS Variable (light + dark) |
| `tailwind.config.js` | 4a | 인라인 스타일 사용 시 변경 불필요 |
| `package.json` | 2, 3 | `@dnd-kit/*`, `node-sql-parser` 추가 |
| `i18n/locales/ko/translation.json` | 1, 3, 4a, 4b | 번역 키 추가 |
| `i18n/locales/en/translation.json` | 1, 3, 4a, 4b | 번역 키 추가 |

---

## 검증

1. **빌드**: `cd client && npm run build` — 타입 에러 없이 빌드 성공
2. **린트**: `npm run lint` — ESLint 통과
3. **포맷**: `npm run format` — Prettier 적용
4. **수동 테스트**:
   - Feature 1: 테이블 헤더에서 논리명 입력 → Term 선택 → 물리명 자동 매핑 확인
   - Feature 1: DDL Export 시 `COMMENT ON TABLE` 문 생성 확인 (PostgreSQL/Oracle)
   - Feature 1: MySQL DDL Export 시 인라인 `COMMENT='...'` 확인
   - Feature 2: 컬럼 드래그로 순서 변경 → DDL Export에서 순서 반영 확인
   - Feature 2: 드래그 중 노드 이동이 발생하지 않음 확인 (`nodrag`)
   - Feature 3: PostgreSQL/MySQL DDL 붙여넣기 → 테이블/FK 자동 생성 확인
   - Feature 3: 잘못된 DDL 입력 시 에러 표시 + Import 버튼 비활성화 확인
   - Feature 3: DDL Import 다이얼로그 열기 전까지 `node-sql-parser` 미로드 확인 (Network 탭)
   - Feature 4a: 테이블 헤더 색상 변경 → 다크 모드에서도 정상 표시 확인
   - Feature 4a: Palette 아이콘이 hover 시에만 표시됨 확인
   - Feature 4b: 그룹 생성 → 크기 조절 → 이름 변경 → 삭제 확인
   - Feature 4b: 그룹 노드가 자동 배치 대상에서 제외됨 확인
   - Feature 4b: 그룹 노드가 테이블 노드 아래(z-index)에 렌더링됨 확인
   - 기존 다이어그램 열기 — 새 필드 없는 데이터 정상 동작 (하위 호환)
   - 기존 다이어그램 열기 — `groups` 없는 JSON도 정상 로드 확인
   - 협업 모드에서 변경 사항 실시간 동기화 확인
   - 접근성: 색상 선택기, 드래그 핸들, 그룹 노드에 스크린 리더 지원 확인
