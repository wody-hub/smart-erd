# ERD TableNode 렌더링 성능 최적화 계획 (v4 - Final Implementation Spec)

## 1. 개요
현재 ERD 캔버스는 초기 로딩과 줌/팬 동작 시 성능 저하가 발생하고 있습니다. 주 원인은 모든 테이블 노드가 비선택 상태에서도 `DndContext`, `Popover`, `Autocomplete` 등 무거운 인터랙티브 컴포넌트를 렌더링하고 있기 때문입니다.

본 계획은 **"Select-to-Edit" (선택 시 편집 모드 전환)** 전략을 통해, 비선택 노드는 가벼운 "Static View"로 렌더링하고, 선택된 노드만 "Interactive Edit View"로 렌더링하여 DOM 복잡도와 이벤트 리스너 부하를 최소화하는 것을 목표로 합니다.

## 2. 성능 병목 분석 (`TableNode.tsx`)

| 컴포넌트 / 기능 | 현재 상태 | 문제점 |
|---|---|---|
| `DndContext` | `canEdit`이면 항상 렌더링 | 테이블 N개 × 컬럼 M개에 대한 드래그 리스너 등록으로 초기 로딩 및 메모리 부하 급증 |
| `ColumnAutocomplete` | `canEdit`이면 항상 렌더링 | 각 컬럼마다 `Popover`, `Command` 등 복잡한 Radix UI 구조 생성 (DOM 깊이 증가) |
| `DomainSelectPopover` | `canEdit`이면 항상 렌더링 | 위와 동일. 수백 개의 팝업 트리거 생성 |
| `input` (물리명, 타입) | `canEdit`이면 항상 렌더링 | 단순 텍스트 표시에 비해 `input` 요소는 렌더링 비용이 높음 |

## 3. 핵심 아키텍처 결정: `activeEditNodeId` 도입

### 3.1. 문제점: `selected` prop의 한계
1.  **Yjs 상태 유실**: 협업 중 다른 사용자의 변경으로 Yjs 업데이트가 수신되면, `useCanvasStore`가 노드 배열을 재생성하면서 로컬의 `selected` 상태가 초기화되어 편집 모드가 강제 종료될 위험이 큼.
2.  **다중 선택 이슈**: React Flow의 드래그 선택으로 20개 노드를 선택하면 20개가 동시에 무거운 편집 모드로 전환되어 성능 악화.

### 3.2. 해결책: 별도 편집 상태 관리
React Flow의 시각적 선택(`selected`)과 논리적 편집 모드(`activeEditNodeId`)를 분리합니다.

- **Store**: `activeEditNodeId: string | null` 상태 추가.
- **Policy**: 오직 **하나의 노드만** 편집 모드 진입 가능.
- **UX 규칙**: `selected`는 시각적 선택(테두리 표시), `activeEditNodeId`는 편집 모드 진입. 드래그 다중 선택만으로는 편집 모드에 진입하지 않으며, 마지막으로 **직접 클릭한** 노드 1개만 편집 대상이 된다.
- **Persistence**: Yjs 업데이트와 무관하게 Zustand에서 독립적으로 관리되므로 편집 상태 유지됨.
- **Lifecycle**: 노드 삭제 시, 다이어그램 전환(`destroyYDoc`) 시 `null`로 초기화하여 stale ID 방지.

## 4. 상세 구현 가이드

### 4.1. `useCanvasStore.ts`
```typescript
interface CanvasState {
  // ...
  activeEditNodeId: string | null;
  setActiveEditNodeId: (id: string | null) => void;
}

// create() 내부
return {
  // ...
  activeEditNodeId: null,
  setActiveEditNodeId: (id) => set({ activeEditNodeId: id }),
  
  deleteTable: (nodeId) => {
    // ... 기존 로직 ...
    // 삭제된 노드가 편집 중이었다면 편집 모드 해제
    if (get().activeEditNodeId === nodeId) {
      set({ activeEditNodeId: null });
    }
  },
  
  destroyYDoc: () => {
    // ... 기존 로직 ...
    set({ ..., activeEditNodeId: null });
  }
};
```

### 4.2. `ERDCanvas.tsx` (이벤트 연동)
기존 핸들러에 로직을 통합합니다.

```typescript
// 기존 handleNodeClick에 통합
const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
  // ... 기존 하이라이트 로직 ...
  
  // [중요] FK 모드일 때는 편집 활성화 안 함 (관계 연결 우선)
  if (fkConnectMode) {
    onNodeClickForFk(event, node); // 기존 로직
    return;
  }
  
  // 편집 모드 진입
  setActiveEditNodeId(node.id);
}, [fkConnectMode, ...]);

// 기존 handlePaneClick에 통합
const handlePaneClick = useCallback(() => {
  // ... 기존 하이라이트/FK 해제 로직 ...
  
  // 편집 모드 해제
  setActiveEditNodeId(null);
}, []);
```

### 4.3. `TableNode.tsx` (구독 최적화 및 렌더링)

> **구현 주의사항 — Zustand selector 최적화**
>
> `activeEditNodeId`를 직접 구독하면 값이 바뀔 때마다 **전체 노드**가 리렌더링됩니다.
> 반드시 파생 boolean을 반환하는 selector를 사용하세요. Zustand 기본 비교(`Object.is`)가
> primitive boolean에 대해 정확히 동작하므로 `useShallow`는 불필요합니다.
> 이 패턴으로 편집 노드를 전환할 때 리렌더링되는 노드는 **최대 2개**(이전 편집 노드 + 새 편집 노드)입니다.
>
> ```tsx
> // Bad: activeEditNodeId 문자열이 바뀔 때마다 전체 노드 리렌더링
> const activeId = useCanvasStore(s => s.activeEditNodeId);
> const isEditing = activeId === id;
>
> // Good: boolean 결과가 변하는 노드(최대 2개)만 리렌더링
> const isEditing = useCanvasStore(s => s.activeEditNodeId === id);
> ```

```tsx
function TableNode({ id, data }: NodeProps<TableNodeData>) {
  // [최적화] 내 노드의 편집 상태가 바뀔 때만 리렌더링
  const isEditingState = useCanvasStore(s => s.activeEditNodeId === id);
  const { canEdit } = useErdPermission();
  
  // 편집 모드 조건: 권한 있음 AND 현재 노드가 활성 편집 대상임
  const isEditing = canEdit && isEditingState;

  return (
    <div className={cn("...", isEditing && "ring-2 ...")}>
      <TableHeader ... />
      
      {isEditing ? (
        <DndContext ...>
          <SortableContext ...>
            {columns.map(col => <EditableColumnRow key={col.id} col={col} ... />)}
          </SortableContext>
        </DndContext>
      ) : (
        <div className="divide-y">
          {columns.map(col => <StaticColumnRow key={col.id} col={col} ... />)}
        </div>
      )}
      
      {isEditing && <AddColumnButton ... />}
    </div>
  );
}
```

### 4.4. `StaticColumnRow` (신규 컴포넌트 - `memo` 적용)
- `input` 대신 `span` 사용.
- **Layout Shift 방지**: `h-8`, `px-2` 등 Tailwind 클래스를 `EditableColumnRow`와 동일하게 적용.
- `Button` 대신 `Badge` 사용 (PK/FK/AI/N).
- `Popover` 로직 제거.
- `Handle`은 항상 렌더링 (위치 고정 필수).

## 5. QA 및 검증 계획

### 5.1. 시나리오 검증
- [ ] **편집 진입**: 노드 클릭 시 즉시 입력창/버튼이 나타나는가?
- [ ] **FK 모드**: FK 연결 모드에서 노드 클릭 시 편집 모드로 진입하지 않고 관계가 연결되는가? (필수)
- [ ] **편집 유지**: 내가 편집 중일 때 다른 브라우저에서 컬럼을 추가해도 내 편집 모드가 유지되는가? (핵심 검증)
- [ ] **편집 종료**: 캔버스 빈 곳을 클릭하면 Static View로 돌아가는가?
- [ ] **다중 선택**: Shift+클릭으로 여러 개를 선택해도, 마지막 클릭한 1개만 편집 모드가 되는가?
- [ ] **뷰어 권한**: VIEWER 권한으로 접속 시 노드를 클릭해도 항상 Static View를 유지하는가?

### 5.2. UX 품질
- [ ] **Layout Shift**: 선택/해제 시 테이블 크기가 덜컥거리거나 컬럼 높이가 변하지 않는가?
- [ ] **입력 보존**: 편집 중 빈 곳을 클릭하여 편집 모드를 종료할 때, 입력 중이던 내용이 저장(commit)되는가? (`onBlur` 동작 확인)

### 5.3. 성능 측정 (최적화 전후 비교)

- [ ] **초기 렌더링**: 노드 50개 / 100개 로딩 시 Scripting 시간 비교 (React DevTools Profiler).
- [ ] **인터랙션**: 노드 100개 상태에서 줌/팬 시 프레임 드랍 발생 여부 (DevTools Performance 탭).
- [ ] **메모리**: 노드 100개 상태에서 힙 스냅샷 크기 비교 (DevTools Memory 탭).
