import { memo, useState } from 'react';
import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import { Plus, X, AlertTriangle, Palette, GripVertical } from 'lucide-react';
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
import useCanvasStore from '@/stores/useCanvasStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { useCompoundTermRegister } from '@/hooks/useCompoundTermRegister';
import { useErdDictionary } from './ErdDictionaryContext';
import { useErdPermission } from './ErdPermissionContext';
import { useErdFkMode } from './ErdFkModeContext';
import { getColumnWarning } from '@/hooks/useColumnValidation';
import { KEYS } from '@/constants/keybindings';
import { cn } from '@/lib/utils';
import { TABLE_COLORS } from '@/lib/table-colors';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ColumnAutocomplete, { type TermSelectResult } from './ColumnAutocomplete';
import DomainSelectPopover from './DomainSelectPopover';
import QuickTermDialog from './QuickTermDialog';
import TableColorPicker from './TableColorPicker';

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

  const { findTermById, findDomainById } = useErdDictionary();
  const { canEdit } = useErdPermission();
  const fkMode = useErdFkMode();
  const registerCompound = useCompoundTermRegister(id);

  /** 연결된 Handle ID 셋 (FK 연결이 있는 핸들만 표시용) */
  const connectedHandles = useStore(
    (s) => {
      const set = new Set<string>();
      for (const edge of s.edges) {
        if (edge.sourceHandle) set.add(edge.sourceHandle);
        if (edge.targetHandle) set.add(edge.targetHandle);
      }
      return set;
    },
    (a, b) => a.size === b.size && [...a].every((v) => b.has(v)),
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

  /** 테이블 물리명 변경 핸들러. @param value 새 테이블 이름 */
  const handleRename = (value: string) => renameTable(id, value);

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } =
    useInlineEdit(handleRename);

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

  /** 헤더 색상 설정 */
  const colorConfig = TABLE_COLORS[headerColor ?? 'default'];

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
    if (!over || active.id === over.id) return;

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

  /** 컬럼 행 렌더링 함수 */
  const renderColumnRow = (col: Column) => {
    const warning = getColumnWarning(col, findTermById, findDomainById);
    const domain = col.domainId != null ? findDomainById(col.domainId) : undefined;

    return (
      <div className="relative px-3 py-1 text-xs group/col">
        {/* Row 1: Handle + PK/FK + 논리명 + 경고 + N + X + Handle */}
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: canEdit ? '12px' : undefined }}
        >
          <Handle
            type="target"
            position={Position.Left}
            id={`${id}-${col.id}-target`}
            className={cn(
              '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
              !(isConnected(col.id) || fkMode) && '!opacity-0',
            )}
          />

          {/* PK toggle */}
          <button
            className={`nodrag w-5 text-center font-bold text-[10px] ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${col.pk ? 'text-erd-pk' : 'text-muted-foreground/40 hover:text-erd-pk/80'}`}
            onClick={
              canEdit
                ? () =>
                    updateColumn(
                      id,
                      col.id,
                      col.pk ? { pk: false, autoIncrement: undefined } : { pk: true },
                    )
                : undefined
            }
            title={t('erd.tableNode.title.togglePk')}
            aria-label={t('erd.tableNode.aria.togglePk', { name: col.name })}
          >
            PK
          </button>

          {/* FK toggle */}
          <button
            className={`nodrag w-5 text-center font-bold text-[10px] ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${col.fk ? 'text-erd-fk' : 'text-muted-foreground/40 hover:text-erd-fk/80'}`}
            onClick={canEdit ? () => updateColumn(id, col.id, { fk: !col.fk }) : undefined}
            title={t('erd.tableNode.title.toggleFk')}
            aria-label={t('erd.tableNode.aria.toggleFk', { name: col.name })}
          >
            FK
          </button>

          {/* AI (Auto Increment) toggle — PK 컬럼에서만 표시 */}
          {col.pk && (
            <button
              className={`nodrag w-5 text-center font-bold text-[10px] ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${col.autoIncrement ? 'text-erd-ai' : 'text-muted-foreground/40 hover:text-erd-ai/80'}`}
              onClick={
                canEdit
                  ? () =>
                      updateColumn(id, col.id, {
                        autoIncrement: col.autoIncrement ? undefined : true,
                      })
                  : undefined
              }
              title={t('erd.tableNode.title.toggleAutoIncrement')}
              aria-label={t('erd.tableNode.aria.toggleAutoIncrement', {
                name: col.name,
              })}
            >
              AI
            </button>
          )}

          {/* Logical name autocomplete */}
          {canEdit ? (
            <ColumnAutocomplete
              value={col.logicalName ?? ''}
              onChange={(newValue) => handleLogicalNameChange(col.id, newValue)}
              onSelectTerm={(result) => handleSelectTerm(col.id, result)}
              onSelectCompound={(resolution) => registerCompound(col.id, resolution)}
              onRegisterNew={(logicalName, partialOnly) =>
                setQuickTermTarget({ nodeId: id, colId: col.id, logicalName, partialOnly })
              }
              termLinked={!!col.termId}
            />
          ) : (
            <span className="flex-1 text-xs truncate">{col.logicalName || ''}</span>
          )}

          {/* Validation warning icon */}
          {warning.status && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle
                  className="h-3 w-3 text-erd-warning shrink-0"
                  aria-label={t('erd.tableNode.aria.validationWarning', {
                    name: col.name,
                  })}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t(
                  `erd.validation.status.${warning.status === 'name-mismatch' ? 'nameMismatch' : warning.status === 'type-mismatch' ? 'typeMismatch' : 'unregistered'}`,
                )}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Nullable toggle */}
          <button
            className={`nodrag text-[10px] ${canEdit ? 'cursor-pointer' : 'cursor-default'} w-4 text-center ${col.nullable ? 'text-erd-nullable' : 'text-muted-foreground/40 hover:text-erd-nullable/80'}`}
            onClick={
              canEdit ? () => updateColumn(id, col.id, { nullable: !col.nullable }) : undefined
            }
            title={t('erd.tableNode.title.toggleNullable')}
            aria-label={t('erd.tableNode.aria.toggleNullable', { name: col.name })}
          >
            N
          </button>

          {/* Delete column */}
          {canEdit && (
            <button
              className="nodrag opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={() => deleteColumn(id, col.id)}
              title={t('erd.tableNode.title.deleteColumn')}
              aria-label={t('erd.tableNode.aria.deleteColumn', { name: col.name })}
            >
              <X className="h-3 w-3" />
            </button>
          )}

          <Handle
            type="source"
            position={Position.Right}
            id={`${id}-${col.id}-source`}
            className={cn(
              '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
              !(isConnected(col.id) || fkMode) && '!opacity-0',
            )}
          />
        </div>

        {/* Row 2: 도메인 배지 + 물리명 + 타입 */}
        <div
          className="flex items-center gap-1 mt-0.5"
          style={{ paddingLeft: canEdit ? 'calc(12px + 3rem)' : '3rem' }}
        >
          {canEdit ? (
            <DomainSelectPopover
              open={domainPopoverColId === col.id}
              onOpenChange={(o) => setDomainPopoverColId(o ? col.id : null)}
              selectedDomainId={col.domainId}
              onSelect={(domainId, physicalType) =>
                handleDomainChange(col.id, domainId, physicalType)
              }
              align="start"
            >
              {domain ? (
                <button
                  className="nodrag text-[10px] px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground hover:bg-erd-domain/80 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  title={`${domain.logicalName} (${domain.physicalType})`}
                  aria-label={t('erd.tableNode.aria.domainBadge', {
                    colName: col.name,
                    domainName: domain.logicalName,
                  })}
                >
                  {domain.logicalName}
                </button>
              ) : (
                <button
                  className="nodrag text-[10px] w-4 h-4 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/40 opacity-0 group-hover/col:opacity-100 hover:!opacity-100 hover:border-muted-foreground hover:text-muted-foreground cursor-pointer shrink-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  title={t('erd.tableNode.selectDomain')}
                  aria-label={t('erd.tableNode.aria.selectDomain', {
                    colName: col.name,
                  })}
                >
                  D
                </button>
              )}
            </DomainSelectPopover>
          ) : (
            domain && (
              <span
                className="text-[10px] px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground shrink-0"
                title={`${domain.logicalName} (${domain.physicalType})`}
              >
                {domain.logicalName}
              </span>
            )
          )}
          <input
            className="nodrag flex-1 font-mono text-muted-foreground bg-transparent outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring px-1 rounded min-w-0"
            value={col.name}
            onChange={(e) => updateColumn(id, col.id, { name: e.target.value })}
            readOnly={!canEdit}
            aria-label={t('erd.tableNode.aria.columnName')}
          />
          <input
            className="nodrag w-24 font-mono text-muted-foreground bg-transparent outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring px-1 rounded text-right"
            value={col.type}
            onChange={(e) => updateColumn(id, col.id, { type: e.target.value })}
            readOnly={!canEdit}
            aria-label={t('erd.tableNode.aria.columnType')}
          />
        </div>
      </div>
    );
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
        <div
          className="px-3 py-2 rounded-t group"
          style={{
            backgroundColor: `hsl(${colorConfig.bg})`,
            color: `hsl(${colorConfig.fg})`,
          }}
        >
          <div className="flex items-start gap-1">
            {/* 색상 선택기 트리거 (hover/focus 시 표시, M-1: 터치 대응 추가) */}
            {canEdit && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="nodrag opacity-0 group-hover:opacity-100 focus-within:opacity-100 h-4 w-4 rounded-sm hover:bg-black/20 transition-opacity shrink-0 mt-0.5"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={t('erd.tableNode.aria.changeColor')}
                  >
                    <Palette className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-2">
                  <TableColorPicker
                    currentColor={headerColor ?? 'default'}
                    onSelect={(color) => updateTableMeta(id, { headerColor: color })}
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="flex-1 min-w-0">
              {/* 논리명 행 (있으면 표시, 없으면 더블클릭으로 추가) */}
              {canEdit ? (
                <ColumnAutocomplete
                  value={logicalTableName ?? ''}
                  onChange={handleTableLogicalNameChange}
                  onSelectTerm={handleTableSelectTerm}
                  onSelectCompound={handleTableSelectCompound}
                  onRegisterNew={(newLogicalName, partialOnly) => {
                    if (partialOnly) return;
                    setTableQuickTermLogicalName(newLogicalName);
                  }}
                  termLinked={!!tableTermId}
                  highlightOnHover={false}
                />
              ) : logicalTableName ? (
                <div className="text-[11px] opacity-80 truncate" title={logicalTableName}>
                  {logicalTableName}
                </div>
              ) : null}

              {/* 물리명 행 */}
              {editing && canEdit ? (
                <input
                  className="nodrag bg-transparent font-semibold text-sm w-full outline-none focus-visible:ring-1 focus-visible:ring-ring rounded placeholder-current/50"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={confirmEdit}
                  onKeyDown={(e) => {
                    if (e.key === KEYS.ENTER) confirmEdit();
                    if (e.key === KEYS.ESCAPE) cancelEdit();
                  }}
                  autoFocus
                  aria-label={t('erd.tableNode.aria.tableName')}
                />
              ) : (
                <div
                  className="font-semibold text-sm cursor-pointer select-none truncate"
                  onDoubleClick={canEdit ? () => startEdit(label) : undefined}
                >
                  {label}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columns — DnD 래핑 */}
        {canEdit ? (
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
                {columns.map((col) => (
                  <SortableColumnRow
                    key={col.id}
                    col={col}
                    nodeId={id}
                    canEdit={canEdit}
                    fkMode={fkMode}
                    isConnected={isConnected}
                  >
                    {renderColumnRow(col)}
                  </SortableColumnRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y divide-border">
            {columns.map((col) => (
              <div key={col.id}>{renderColumnRow(col)}</div>
            ))}
          </div>
        )}

        {/* Add column button */}
        {canEdit && (
          <div className="border-t border-border">
            <button
              className="nodrag w-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center gap-1 cursor-pointer"
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
