# ERD TableNode 렌더링 성능 최적화 계획

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

## 3. 수정 전략: 조건부 렌더링 (`selected` prop 활용)

React Flow에서 제공하는 `selected` prop을 활용하여 렌더링 모드를 분기합니다.

- **Static View (`!selected`)**: 가벼운 HTML 요소(`div`, `span`) 위주로 렌더링. 정보 확인에 필요한 필수 요소만 표시.
- **Interactive View (`selected`)**: 현재의 편집 가능한 UI 렌더링.

### 3.1. 필수 표시 항목 (Static View에서도 유지)
사용자 요청에 따라 다음 항목은 항상 표시되어야 합니다.
- 테이블 헤더 (논리명, 물리명)
- 컬럼 리스트 (논리명, 물리명, 타입)
- 상태 아이콘/뱃지 (PK, FK, AI, NotNull)
- 매칭 오류 아이콘 (`AlertTriangle`)
- 관계선 (`Handle`)

### 3.2. 최적화 대상 (Interactive View로 지연)

1.  **컬럼 드래그 앤 드롭 (DnD)**
    - **변경 전**: `canEdit`이면 항상 `DndContext` > `SortableContext` 렌더링
    - **변경 후**: `canEdit && selected`일 때만 `DndContext` 렌더링. 아닐 경우 단순 `div` 리스트 렌더링.

2.  **논리명 입력 (`ColumnAutocomplete`)**
    - **변경 전**: `ColumnAutocomplete` 컴포넌트 렌더링
    - **변경 후**:
        - `!selected`: 단순 `<span>{col.logicalName}</span>` 렌더링. (긴 텍스트 `truncate` 처리)
        - `selected`: 기존 `ColumnAutocomplete` 렌더링.

3.  **도메인 선택 (`DomainSelectPopover`)**
    - **변경 전**: `DomainSelectPopover` 렌더링
    - **변경 후**:
        - `!selected`: 도메인 이름이 담긴 단순 `<span>` 뱃지 렌더링.
        - `selected`: 기존 `DomainSelectPopover` 렌더링.

4.  **물리명 / 타입 입력 (`input`)**
    - **변경 전**: `<input>` 요소 렌더링
    - **변경 후**:
        - `!selected`: `<span>{col.name}</span>`, `<span>{col.type}</span>` 렌더링.
        - `selected`: 기존 `<input>` 렌더링.

5.  **테이블 헤더 편집**
    - **변경 전**: 논리명 `ColumnAutocomplete` + 물리명 `useInlineEdit` 항상 활성
    - **변경 후**:
        - `!selected`: 단순 텍스트 표시.
        - `selected`: 편집 컴포넌트 활성화.

## 4. 상세 구현 가이드

### 4.1. `TableNode` 컴포넌트 구조 변경

```tsx
function TableNode({ id, selected, data }: NodeProps<TableNodeData>) {
  // ... hook 호출 ...

  // 편집 모드 조건: 권한이 있고(canEdit) AND 노드가 선택되었을 때(selected)
  const isEditing = canEdit && selected; 

  // ... 렌더링 로직 ...

  return (
    // ...
        {/* Columns 섹션 분기 */}
        {isEditing ? (
          <DndContext ...>
            <SortableContext ...>
              {columns.map(col => (
                <SortableColumnRow ...>
                  {renderColumnRow(col, true)} {/* isEditing=true 전달 */}
                </SortableColumnRow>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y divide-border">
            {columns.map(col => (
              <div key={col.id}>
                {renderColumnRow(col, false)} {/* isEditing=false 전달 */}
              </div>
            ))}
          </div>
        )}
    // ...
  );
}
```

### 4.2. `renderColumnRow` 함수 수정

```tsx
const renderColumnRow = (col: Column, isEditing: boolean) => {
  // ...
  return (
    <div className="...">
      {/* ... Handle, PK, FK 등 버튼은 유지하되 onClick은 isEditing일 때만 동작하도록 가드하거나 
          View 모드에서도 토글을 허용할지는 선택 사항 (일관성을 위해 isEditing에서만 허용 권장) */}
      
      {/* 논리명 영역 */}
      {isEditing ? (
        <ColumnAutocomplete ... />
      ) : (
        <span className="flex-1 text-xs truncate" title={col.logicalName}>
          {col.logicalName || ''}
        </span>
      )}

      {/* 도메인 영역 */}
      {isEditing ? (
        <DomainSelectPopover ...>...</DomainSelectPopover>
      ) : (
        domain && (
          <span className="text-2xs px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground shrink-0">
            {domain.logicalName}
          </span>
        )
      )}

      {/* 물리명/타입 영역 */}
      {isEditing ? (
        <>
          <input value={col.name} ... />
          <input value={col.type} ... />
        </>
      ) : (
        <>
          <span className="flex-1 font-mono text-muted-foreground px-1 truncate">{col.name}</span>
          <span className="w-24 font-mono text-muted-foreground px-1 text-right truncate">{col.type}</span>
        </>
      )}
    </div>
  );
}
```

## 5. 기대 효과

1.  **초기 로딩 속도 향상**: 수백 개의 Popover, Input, DnD 리스너가 제거되어 초기 렌더링 시간이 단축됩니다.
2.  **줌/팬 프레임드랍 감소**: DOM 노드 수가 줄어들어 브라우저 리플로우/리페인트 비용이 감소합니다.
3.  **메모리 사용량 감소**: 이벤트 리스너와 컴포넌트 인스턴스 수가 줄어듭니다.
4.  **사용성 유지**: 정보를 확인하는 데 필요한 모든 시각적 요소(텍스트, 색상, 아이콘, 연결선)는 그대로 유지되므로 "보는" 경험은 동일합니다.

## 6. 검토 사항
- `Handle` (연결점)은 React Flow의 엣지 연결을 위해 View/Edit 모드 상관없이 항상 렌더링되어야 합니다. (계획에 포함됨)
- `selected` 상태 변경 시 리렌더링이 발생하지만, 이는 단일 노드에 국한되므로 성능에 큰 영향을 주지 않습니다.
