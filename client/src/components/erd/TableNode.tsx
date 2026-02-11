import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TableNode as TableNodeType, Column } from '@/types/erd';
import useCanvasStore from '@/stores/useCanvasStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { useCompoundTermRegister } from '@/hooks/useCompoundTermRegister';
import { useErdDictionary } from './ErdDictionaryContext';
import { getColumnWarning } from '@/hooks/useColumnValidation';
import { KEYS } from '@/constants/keybindings';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import ColumnAutocomplete, { type TermSelectResult } from './ColumnAutocomplete';
import DomainSelectPopover from './DomainSelectPopover';
import QuickTermDialog from './QuickTermDialog';

/** 빠른 용어 등록 대상 정보 */
interface QuickTermTarget {
  /** 노드 ID */
  nodeId: string;
  /** 컬럼 ID */
  colId: string;
  /** 초기 논리명 */
  logicalName: string;
}

/**
 * ERD 테이블 커스텀 노드 컴포넌트.
 *
 * 테이블 헤더(이름)와 컬럼 목록을 2행 레이아웃으로 렌더링한다.
 * 1행: 논리명 자동완성, 2행: 물리명/타입 입력.
 * 각 컬럼에 PK/FK 뱃지와 좌우 Handle(source/target)을 배치하여
 * 컬럼 레벨의 관계 연결을 지원한다.
 *
 * @param props.id   React Flow 노드 ID
 * @param props.data 테이블 데이터 (label, columns)
 */
function TableNode({ id, data }: NodeProps<TableNodeType>) {
  const { t } = useTranslation();
  const { label, columns } = data;
  const renameTable = useCanvasStore((s) => s.renameTable);
  const addColumn = useCanvasStore((s) => s.addColumn);
  const deleteColumn = useCanvasStore((s) => s.deleteColumn);
  const updateColumn = useCanvasStore((s) => s.updateColumn);
  const isHighlighted = useCanvasStore((s) => s.highlightedNodeIds.includes(id));

  const { findTermById, findDomainById } = useErdDictionary();
  const registerCompound = useCompoundTermRegister(id);

  /** 빠른 용어 등록 대상 */
  const [quickTermTarget, setQuickTermTarget] = useState<QuickTermTarget | null>(null);
  /** 도메인 Popover가 열린 컬럼 ID */
  const [domainPopoverColId, setDomainPopoverColId] = useState<string | null>(null);

  /** 테이블 이름 변경 핸들러. @param value 새 테이블 이름 */
  const handleRename = (value: string) => renameTable(id, value);

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } =
    useInlineEdit(handleRename);

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
   * @param colId    컬럼 ID
   * @param domainId 선택된 도메인 ID (null = 해제)
   */
  const handleDomainChange = (colId: string, domainId: number | null) => {
    const updates: Partial<Column> = { domainId: domainId ?? undefined };
    if (domainId) {
      const domain = findDomainById(domainId);
      if (domain) updates.type = domain.physicalType;
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
      updateColumn(quickTermTarget.nodeId, quickTermTarget.colId, updates);
      setQuickTermTarget(null);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'bg-card border border-border rounded shadow-md min-w-[200px]',
          isHighlighted && 'ring-2 ring-primary shadow-lg',
        )}
      >
        {/* Table header */}
        {editing ? (
          <div className="bg-erd-table-header px-3 py-2 rounded-t">
            <input
              className="nodrag bg-transparent text-erd-table-header-foreground font-semibold text-sm w-full outline-none focus-visible:ring-1 focus-visible:ring-ring rounded placeholder-erd-table-header-foreground/50"
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
          </div>
        ) : (
          <div
            className="bg-erd-table-header text-erd-table-header-foreground px-3 py-2 rounded-t font-semibold text-sm cursor-pointer select-none"
            onDoubleClick={() => startEdit(label)}
          >
            {label}
          </div>
        )}

        {/* Columns */}
        <div className="divide-y divide-border">
          {columns.map((col) => {
            const warning = getColumnWarning(col, findTermById, findDomainById);
            const domain = col.domainId != null ? findDomainById(col.domainId) : undefined;

            return (
              <div key={col.id} className="relative px-3 py-1 text-xs group/col">
                {/* Row 1: Handle + PK/FK + 논리명 + 경고 + N + X + Handle */}
                <div className="flex items-center gap-1">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`${id}-${col.id}-target`}
                    className="!w-2 !h-2 !bg-erd-handle !border-erd-handle-border"
                  />

                  {/* PK toggle */}
                  <button
                    className={`nodrag w-5 text-center font-bold text-[10px] cursor-pointer ${col.pk ? 'text-erd-pk' : 'text-muted-foreground/40 hover:text-erd-pk/80'}`}
                    onClick={() => updateColumn(id, col.id, { pk: !col.pk })}
                    title={t('erd.tableNode.title.togglePk')}
                    aria-label={t('erd.tableNode.aria.togglePk', { name: col.name })}
                  >
                    PK
                  </button>

                  {/* FK toggle */}
                  <button
                    className={`nodrag w-5 text-center font-bold text-[10px] cursor-pointer ${col.fk ? 'text-erd-fk' : 'text-muted-foreground/40 hover:text-erd-fk/80'}`}
                    onClick={() => updateColumn(id, col.id, { fk: !col.fk })}
                    title={t('erd.tableNode.title.toggleFk')}
                    aria-label={t('erd.tableNode.aria.toggleFk', { name: col.name })}
                  >
                    FK
                  </button>

                  {/* Logical name autocomplete */}
                  <ColumnAutocomplete
                    value={col.logicalName ?? ''}
                    onChange={(newValue) => handleLogicalNameChange(col.id, newValue)}
                    onSelectTerm={(result) => handleSelectTerm(col.id, result)}
                    onSelectCompound={(resolution) => registerCompound(col.id, resolution)}
                    onRegisterNew={(logicalName) =>
                      setQuickTermTarget({ nodeId: id, colId: col.id, logicalName })
                    }
                  />

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
                    className={`nodrag text-[10px] cursor-pointer w-4 text-center ${col.nullable ? 'text-erd-nullable' : 'text-muted-foreground/40 hover:text-erd-nullable/80'}`}
                    onClick={() => updateColumn(id, col.id, { nullable: !col.nullable })}
                    title={t('erd.tableNode.title.toggleNullable')}
                    aria-label={t('erd.tableNode.aria.toggleNullable', { name: col.name })}
                  >
                    N
                  </button>

                  {/* Delete column */}
                  <button
                    className="nodrag opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => deleteColumn(id, col.id)}
                    title={t('erd.tableNode.title.deleteColumn')}
                    aria-label={t('erd.tableNode.aria.deleteColumn', { name: col.name })}
                  >
                    <X className="h-3 w-3" />
                  </button>

                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`${id}-${col.id}-source`}
                    className="!w-2 !h-2 !bg-erd-handle !border-erd-handle-border"
                  />
                </div>

                {/* Row 2: 도메인 배지 + 물리명 + 타입 */}
                <div className="flex items-center gap-1 pl-12 mt-0.5">
                  {domain && (
                    <DomainSelectPopover
                      open={domainPopoverColId === col.id}
                      onOpenChange={(o) => setDomainPopoverColId(o ? col.id : null)}
                      selectedDomainId={col.domainId!}
                      onSelect={(domainId) => handleDomainChange(col.id, domainId)}
                      align="start"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="nodrag text-[10px] px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground hover:bg-erd-domain/80 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label={t('erd.tableNode.aria.domainBadge', {
                              colName: col.name,
                              domainName: domain.logicalName,
                            })}
                          >
                            {domain.logicalName}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {domain.logicalName} ({domain.physicalType})
                        </TooltipContent>
                      </Tooltip>
                    </DomainSelectPopover>
                  )}
                  <input
                    className="nodrag flex-1 font-mono text-muted-foreground bg-transparent outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring px-1 rounded min-w-0"
                    value={col.name}
                    onChange={(e) => updateColumn(id, col.id, { name: e.target.value })}
                    aria-label={t('erd.tableNode.aria.columnName')}
                  />
                  <input
                    className="nodrag w-24 font-mono text-muted-foreground bg-transparent outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring px-1 rounded text-right"
                    value={col.type}
                    onChange={(e) => updateColumn(id, col.id, { type: e.target.value })}
                    aria-label={t('erd.tableNode.aria.columnType')}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add column button */}
        <div className="border-t border-border">
          <button
            className="nodrag w-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center gap-1 cursor-pointer"
            onClick={() => addColumn(id)}
          >
            <Plus className="h-3 w-3" />
            {t('erd.tableNode.addColumn')}
          </button>
        </div>
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
    </TooltipProvider>
  );
}

export default memo(TableNode);
