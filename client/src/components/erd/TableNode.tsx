import { memo, useMemo, useState } from 'react';
import { useStore, type NodeProps } from '@xyflow/react';
import { Plus, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TableNode as TableNodeType, Column } from '@/types/erd';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import { useCompoundTermRegister } from '@/hooks/useCompoundTermRegister';
import { useErdDictionary } from './ErdDictionaryContext';
import { useErdPermission } from './ErdPermissionContext';
import { useErdFkMode } from './ErdFkModeContext';
import { useRemoteEditLocksContext } from './RemoteEditLocksContext';
import { getColumnWarning } from '@/hooks/useColumnValidation';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { TermSelectResult } from './ColumnAutocomplete';
import QuickTermDialog from './QuickTermDialog';
import StaticColumnRow from './StaticColumnRow';
import TableNodeHeader from './TableNodeHeader';
import EditableColumnRow from './EditableColumnRow';

/** 빠른 용어 등록 대상 정보 */
interface QuickTermTarget {
  /** 노드 ID */
  nodeId: string;
  /** 컬럼 ID */
  colId: string;
  /** 초기 논리명 */
  logicalName: string;
  /** true이면 등록만 하고 컬럼에 적용하지 않음 (부분 세그먼트 등록용) */
  partialOnly?: boolean;
}

/** SortableColumnRow 컴포넌트 props */
interface SortableColumnRowProps {
  /** 컬럼 데이터 */
  col: Column;
  /** 노드 ID */
  nodeId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** FK 모드 활성 여부 */
  fkMode: boolean;
  /** 엣지 연결 여부 확인 함수 */
  isConnected: (colId: string) => boolean;
  /** 자식 렌더링 함수 */
  children: React.ReactNode;
}

/**
 * 정렬 가능한 컬럼 행 래퍼 컴포넌트.
 *
 * @dnd-kit의 useSortable 훅을 사용하여 드래그 앤 드롭을 지원한다.
 * 드래그 핸들(GripVertical)은 편집 모드에서만 표시된다.
 */
function SortableColumnRow({ col, canEdit, children }: SortableColumnRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {canEdit && (
        <div
          className="nodrag absolute left-0 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover/col:opacity-100 hover:!opacity-100 transition-opacity z-10 pl-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">
            {t('erd.tableNode.aria.reorderColumn', { name: col.name })}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * ERD 테이블 커스텀 노드 컴포넌트.
 *
 * 테이블 헤더(논리명 + 물리명)와 컬럼 목록을 렌더링한다.
 * 헤더는 논리명이 있으면 2줄(논리명 + 물리명), 없으면 1줄(물리명만) 레이아웃.
 * 각 컬럼에 PK/FK 뱃지와 좌우 Handle(source/target)을 배치하여
 * 컬럼 레벨의 관계 연결을 지원한다.
 * @dnd-kit으로 컬럼 드래그 앤 드롭 순서 변경을 지원한다.
 *
 * @param props.id   React Flow 노드 ID
 * @param props.data 테이블 데이터 (label, columns, logicalTableName, headerColor)
 * @param props.selected 선택 상태
 */
function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const { t } = useTranslation();
  const { label, columns, logicalTableName, tableTermId, headerColor } = data;
  const renameTable = useCanvasStore((s) => s.renameTable);
  const updateTableMeta = useCanvasStore((s) => s.updateTableMeta);
  const addColumn = useCanvasStore((s) => s.addColumn);
  const deleteColumn = useCanvasStore((s) => s.deleteColumn);
  const updateColumn = useCanvasStore((s) => s.updateColumn);
  const moveColumn = useCanvasStore((s) => s.moveColumn);
  const isHighlighted = useCanvasStore((s) => s.highlightedNodeIds.includes(id));

  const { findTermById, findDomainById, resolveCompound } = useErdDictionary();
  const { canEdit: permissionCanEdit } = useErdPermission();
  const { locksByNodeId } = useRemoteEditLocksContext();
  const lockInfo = locksByNodeId.get(id);
  const canEdit = permissionCanEdit && !lockInfo;
  /** 이 노드가 현재 편집 모드인지 여부 (파생 boolean으로 전환 시 최대 2개 노드만 리렌더링) */
  const isEditingState = useCanvasStore((s) => s.activeEditNodeId === id);
  /** 편집 권한이 있고, 이 노드가 편집 모드로 활성화된 상태 */
  const isEditing = canEdit && isEditingState;
  const fkMode = useErdFkMode();
  const registerCompound = useCompoundTermRegister(id);

  /** 연결된 Handle ID 셋 (이 노드에 연결된 핸들만 수집) */
  const connectedHandles = useStore(
    (s) => {
      const set = new Set<string>();
      const prefix = `${id}-`;
      for (const edge of s.edges) {
        if (edge.sourceHandle?.startsWith(prefix)) set.add(edge.sourceHandle);
        if (edge.targetHandle?.startsWith(prefix)) set.add(edge.targetHandle);
      }
      return set;
    },
    (a, b) => {
      if (a.size !== b.size) {
        return false;
      }
      for (const v of a) {
        if (!b.has(v)) {
          return false;
        }
      }
      return true;
    },
  );

  /** 해당 컬럼이 엣지에 연결되어 있는지 확인한다. */
  const isConnected = (colId: string) =>
    connectedHandles.has(`${id}-${colId}-source`) || connectedHandles.has(`${id}-${colId}-target`);

  /** 빠른 용어 등록 대상 */
  const [quickTermTarget, setQuickTermTarget] = useState<QuickTermTarget | null>(null);
  /** 도메인 Popover가 열린 컬럼 ID */
  const [domainPopoverColId, setDomainPopoverColId] = useState<string | null>(null);
  /** 테이블 빠른 용어 등록 대상 논리명 */
  const [tableQuickTermLogicalName, setTableQuickTermLogicalName] = useState<string | null>(null);

  /** 테이블 내부 중복 컬럼 논리명 집합 */
  const duplicatedLogicalNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of columns) {
      const key = col.logicalName?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );
  }, [columns]);

  /** 중복 논리명을 가진 컬럼 개수 */
  const duplicateLogicalNameColumnCount = useMemo(
    () =>
      columns.filter((col) => {
        const key = col.logicalName?.trim();
        return !!key && duplicatedLogicalNames.has(key);
      }).length,
    [columns, duplicatedLogicalNames],
  );

  /** 테이블 물리명 변경 핸들러. @param value 새 테이블 이름 */
  const handleRename = (value: string) => renameTable(id, value);

  /**
   * 테이블 논리명 변경 핸들러.
   *
   * 용어를 수동 입력하면 기존 용어 연결(tableTermId)은 해제한다.
   *
   * @param newValue 새 논리명 값
   */
  const handleTableLogicalNameChange = (newValue: string) => {
    updateTableMeta(id, {
      logicalTableName: newValue || undefined,
      tableTermId: undefined,
    });
  };

  /**
   * 테이블 용어 선택 핸들러.
   *
   * @param result 선택된 Term 결과
   */
  const handleTableSelectTerm = (result: TermSelectResult) => {
    updateTableMeta(id, {
      logicalTableName: result.logicalName,
      label: result.name,
      tableTermId: result.termId,
    });
  };

  /**
   * 테이블 복합 용어 선택 핸들러.
   *
   * 복합 해석 결과를 즉시 테이블 논리명/물리명에 반영하고, tableTermId는 해제한다.
   *
   * @param resolution 복합 용어 해석 결과
   */
  const handleTableSelectCompound = (resolution: { query: string; physicalName: string }) => {
    updateTableMeta(id, {
      logicalTableName: resolution.query,
      label: resolution.physicalName,
      tableTermId: undefined,
    });
  };

  /** @dnd-kit 센서 설정 (distance:5로 클릭과 드래그 구분) */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * 드래그 종료 핸들러 — 컬럼 순서 변경.
   *
   * @param event DnD 드래그 종료 이벤트
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const fromIndex = columns.findIndex((c) => c.id === active.id);
    const toIndex = columns.findIndex((c) => c.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      moveColumn(id, fromIndex, toIndex);
    }
  };

  /**
   * 논리명 변경 핸들러 — termId/domainId 초기화.
   *
   * @param colId     컬럼 ID
   * @param newValue  새 논리명 값
   */
  const handleLogicalNameChange = (colId: string, newValue: string) => {
    updateColumn(id, colId, {
      logicalName: newValue || undefined,
      termId: undefined,
      domainId: undefined,
    });
  };

  /**
   * Term 선택 핸들러 — 물리명/타입/termId/domainId 자동매핑.
   *
   * @param colId  컬럼 ID
   * @param result 선택된 Term 결과
   */
  const handleSelectTerm = (colId: string, result: TermSelectResult) => {
    const updates: Partial<Column> = {
      logicalName: result.logicalName,
      name: result.name,
      termId: result.termId,
      domainId: result.domainId,
    };
    if (result.type) {
      updates.type = result.type;
    }
    updateColumn(id, colId, updates);
  };

  /**
   * 도메인 변경 핸들러 — 배지 클릭으로 도메인을 변경한다.
   *
   * @param colId        컬럼 ID
   * @param domainId     선택된 도메인 ID (null = 해제)
   * @param physicalType 물리 타입 (신규 생성 시 캐시 갱신 전 즉시 전달)
   */
  const handleDomainChange = (colId: string, domainId: number | null, physicalType?: string) => {
    const updates: Partial<Column> = { domainId: domainId ?? undefined };
    if (domainId) {
      const resolvedType = physicalType ?? findDomainById(domainId)?.physicalType;
      if (resolvedType) updates.type = resolvedType;
    }
    updateColumn(id, colId, updates);
  };

  /**
   * 빠른 용어 등록 적용 핸들러.
   *
   * @param updates 컬럼 업데이트 데이터
   */
  const handleQuickTermApply = (updates: Partial<Column>) => {
    if (quickTermTarget) {
      if (!quickTermTarget.partialOnly) {
        updateColumn(quickTermTarget.nodeId, quickTermTarget.colId, updates);
      }
      setQuickTermTarget(null);
    }
  };

  /**
   * 테이블 빠른 용어 등록 적용 핸들러.
   *
   * @param updates 등록된 용어 기반 업데이트 데이터
   */
  const handleTableQuickTermApply = (updates: Partial<Column>) => {
    updateTableMeta(id, {
      logicalTableName: updates.logicalName || undefined,
      label: updates.name || label,
      tableTermId: updates.termId,
    });
    setTableQuickTermLogicalName(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'bg-card border border-border rounded shadow-md min-w-[200px]',
          isHighlighted && 'ring-2 ring-primary shadow-lg',
        )}
      >
        {/* Table header — 색상 적용 + 2줄 레이아웃 */}
        <TableNodeHeader
          label={label}
          logicalTableName={logicalTableName}
          tableTermId={tableTermId}
          headerColor={headerColor}
          isEditing={isEditing}
          duplicateLogicalNameColumnCount={duplicateLogicalNameColumnCount}
          lockInfo={lockInfo}
          onLogicalNameChange={handleTableLogicalNameChange}
          onSelectTerm={handleTableSelectTerm}
          onSelectCompound={handleTableSelectCompound}
          onRegisterNew={(newLogicalName, partialOnly) => {
            if (partialOnly) {
              return;
            }
            setTableQuickTermLogicalName(newLogicalName);
          }}
          onRename={handleRename}
          onColorChange={(color) => updateTableMeta(id, { headerColor: color })}
        />

        {/* Columns — 편집 모드: DnD 래핑, 정적 모드: StaticColumnRow */}
        {isEditing ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border">
                {columns.map((col) => {
                  const warning = getColumnWarning(
                    col,
                    findTermById,
                    findDomainById,
                    resolveCompound,
                  );
                  const domain = col.domainId != null ? findDomainById(col.domainId) : undefined;
                  const normalizedLogicalName = col.logicalName?.trim() ?? '';
                  const hasDuplicateLogicalName =
                    normalizedLogicalName.length > 0 &&
                    duplicatedLogicalNames.has(normalizedLogicalName);

                  return (
                    <SortableColumnRow
                      key={col.id}
                      col={col}
                      nodeId={id}
                      canEdit={canEdit}
                      fkMode={fkMode}
                      isConnected={isConnected}
                    >
                      <EditableColumnRow
                        col={col}
                        nodeId={id}
                        canEdit={canEdit}
                        fkMode={fkMode}
                        connected={isConnected(col.id)}
                        warning={warning}
                        hasDuplicateLogicalName={hasDuplicateLogicalName}
                        normalizedLogicalName={normalizedLogicalName}
                        domain={domain}
                        domainPopoverOpen={domainPopoverColId === col.id}
                        onDomainPopoverOpenChange={(o) => setDomainPopoverColId(o ? col.id : null)}
                        onUpdateColumn={(colId, updates) => updateColumn(id, colId, updates)}
                        onDeleteColumn={(colId) => deleteColumn(id, colId)}
                        onLogicalNameChange={handleLogicalNameChange}
                        onSelectTerm={handleSelectTerm}
                        onSelectCompound={(colId, resolution) =>
                          registerCompound(colId, resolution)
                        }
                        onRegisterNew={(colId, logicalName, partialOnly) =>
                          setQuickTermTarget({
                            nodeId: id,
                            colId,
                            logicalName,
                            partialOnly,
                          })
                        }
                        onDomainChange={handleDomainChange}
                      />
                    </SortableColumnRow>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y divide-border">
            {columns.map((col) => {
              const domain = col.domainId != null ? findDomainById(col.domainId) : undefined;
              return (
                <StaticColumnRow
                  key={col.id}
                  col={col}
                  nodeId={id}
                  connected={isConnected(col.id)}
                  warning={getColumnWarning(col, findTermById, findDomainById, resolveCompound)}
                  hasDuplicateLogicalName={
                    !!col.logicalName?.trim() && duplicatedLogicalNames.has(col.logicalName.trim())
                  }
                  domainLogicalName={domain?.logicalName}
                  domainPhysicalType={domain?.physicalType}
                />
              );
            })}
          </div>
        )}

        {/* Add column button */}
        {isEditing && (
          <div className="border-t border-border">
            <button
              className="nodrag flex w-full items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => addColumn(id)}
            >
              <Plus className="h-3 w-3" />
              {t('erd.tableNode.addColumn')}
            </button>
          </div>
        )}
      </div>

      {/* Quick Term Dialog */}
      <QuickTermDialog
        open={!!quickTermTarget}
        onOpenChange={(open) => {
          if (!open) setQuickTermTarget(null);
        }}
        initialLogicalName={quickTermTarget?.logicalName ?? ''}
        onApply={handleQuickTermApply}
      />
      <QuickTermDialog
        open={!!tableQuickTermLogicalName}
        onOpenChange={(open) => {
          if (!open) setTableQuickTermLogicalName(null);
        }}
        initialLogicalName={tableQuickTermLogicalName ?? ''}
        onApply={handleTableQuickTermApply}
      />
    </TooltipProvider>
  );
}

export default memo(TableNode);
