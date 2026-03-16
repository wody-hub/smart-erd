import { Handle, Position } from '@xyflow/react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { Column } from '@/types/erd';
import {
  getValidationStatusI18nKey,
  type ColumnWarning,
  type WarningValidationStatus,
} from '@/hooks/useColumnValidation';
import type { Domain } from '@/types/dictionary';
import type { TermSelectResult } from './ColumnAutocomplete';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import ColumnAutocomplete from './ColumnAutocomplete';
import DomainSelectPopover from './DomainSelectPopover';

/** EditableColumnRow 컴포넌트 props */
export interface EditableColumnRowProps {
  /** 컬럼 데이터 */
  col: Column;
  /** 노드 ID */
  nodeId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** FK 모드 활성 여부 */
  fkMode: boolean;
  /** 엣지 연결 여부 */
  connected: boolean;
  /** 컬럼 유효성 경고 */
  warning: ColumnWarning;
  /** 중복 논리명 여부 */
  hasDuplicateLogicalName: boolean;
  /** 정규화된 논리명 (중복 경고 표시용) */
  normalizedLogicalName: string;
  /** 연결된 도메인 정보 */
  domain: Domain | undefined;
  /** 도메인 Popover가 열린 상태인지 여부 */
  domainPopoverOpen: boolean;
  /** 도메인 Popover 열림/닫힘 콜백 */
  onDomainPopoverOpenChange: (open: boolean) => void;
  /** 컬럼 업데이트 핸들러 */
  onUpdateColumn: (colId: string, updates: Partial<Column>) => void;
  /** 컬럼 삭제 핸들러 */
  onDeleteColumn: (colId: string) => void;
  /** 논리명 변경 핸들러 */
  onLogicalNameChange: (colId: string, value: string) => void;
  /** 용어 선택 핸들러 */
  onSelectTerm: (colId: string, result: TermSelectResult) => void;
  /** 단어사전 기반 해석 결과 적용 핸들러 */
  onSelectDerived: (colId: string, resolution: LogicalNameResolution) => void;
  /** 빠른 등록 흐름 요청 핸들러 */
  onRegisterNew: (colId: string, logicalName: string) => void;
  /** 도메인 변경 핸들러 */
  onDomainChange: (colId: string, domainId: number | null, physicalType?: string) => void;
}

/**
 * 편집 가능한 컬럼 행 컴포넌트.
 *
 * PK/FK/AI/NN 토글, 논리명 자동완성, 경고 아이콘, 삭제 버튼,
 * 도메인 배지, 물리명/타입 입력 필드를 포함한다.
 * Handle(source/target)을 배치하여 컬럼 레벨의 관계 연결을 지원한다.
 *
 * @param props EditableColumnRowProps
 */
export default function EditableColumnRow({
  col,
  nodeId,
  canEdit,
  fkMode,
  connected,
  warning,
  hasDuplicateLogicalName,
  normalizedLogicalName,
  domain,
  domainPopoverOpen,
  onDomainPopoverOpenChange,
  onUpdateColumn,
  onDeleteColumn,
  onLogicalNameChange,
  onSelectTerm,
  onSelectDerived,
  onRegisterNew,
  onDomainChange,
}: EditableColumnRowProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'relative px-3 py-1 text-xs group/col',
        hasDuplicateLogicalName && 'bg-destructive/5',
      )}
    >
      <div
        className="flex items-center gap-1.5"
        style={{ paddingLeft: canEdit ? '12px' : undefined }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeId}-${col.id}-target`}
          className={cn(
            '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
            !(connected || fkMode) && '!opacity-0',
          )}
        />

        {/* PK toggle */}
        <button
          className={cn(
            'nodrag w-5 text-center font-bold text-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            canEdit ? 'cursor-pointer' : 'cursor-default',
            col.pk ? 'text-erd-pk' : 'text-muted-foreground/40 hover:text-erd-pk/80',
          )}
          onClick={
            canEdit
              ? () =>
                  onUpdateColumn(
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
          className={cn(
            'nodrag w-5 text-center font-bold text-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            canEdit ? 'cursor-pointer' : 'cursor-default',
            col.fk ? 'text-erd-fk' : 'text-muted-foreground/40 hover:text-erd-fk/80',
          )}
          onClick={canEdit ? () => onUpdateColumn(col.id, { fk: !col.fk }) : undefined}
          title={t('erd.tableNode.title.toggleFk')}
          aria-label={t('erd.tableNode.aria.toggleFk', { name: col.name })}
        >
          FK
        </button>

        {/* AI (Auto Increment) toggle — PK 컬럼에서만 표시 */}
        {col.pk && (
          <button
            className={cn(
              'nodrag w-5 text-center font-bold text-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              canEdit ? 'cursor-pointer' : 'cursor-default',
              col.autoIncrement ? 'text-erd-ai' : 'text-muted-foreground/40 hover:text-erd-ai/80',
            )}
            onClick={
              canEdit
                ? () =>
                    onUpdateColumn(col.id, {
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

        <div
          className="flex-[1.2] whitespace-nowrap"
          style={{ minWidth: `${Math.max((col.logicalName?.length ?? 0) + 2, 10)}ch` }}
        >
          {canEdit ? (
            <ColumnAutocomplete
              value={col.logicalName ?? ''}
              onChange={(newValue) => onLogicalNameChange(col.id, newValue)}
              onSelectTerm={(result) => onSelectTerm(col.id, result)}
              onSelectDerived={(resolution) => onSelectDerived(col.id, resolution)}
              onRegisterNew={(logicalName) => onRegisterNew(col.id, logicalName)}
              termLinked={!!col.termId}
            />
          ) : (
            <span className="block whitespace-nowrap text-xs">{col.logicalName || ''}</span>
          )}
        </div>

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
              {t(getValidationStatusI18nKey(warning.status as WarningValidationStatus))}
            </TooltipContent>
          </Tooltip>
        )}

        {hasDuplicateLogicalName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                className="h-3 w-3 text-destructive shrink-0"
                aria-label={t('erd.tableNode.aria.duplicateLogicalNameWarning', {
                  name: normalizedLogicalName,
                })}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('erd.tableNode.duplicateLogicalNameWarning', {
                name: normalizedLogicalName,
              })}
            </TooltipContent>
          </Tooltip>
        )}

        {canEdit ? (
          <DomainSelectPopover
            open={domainPopoverOpen}
            onOpenChange={onDomainPopoverOpenChange}
            selectedDomainId={col.domainId}
            onSelect={(domainId, physicalType) => onDomainChange(col.id, domainId, physicalType)}
            align="start"
          >
            {domain ? (
              <button
                className="nodrag text-2xs px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground hover:bg-erd-domain/80 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                className="nodrag text-2xs w-4 h-4 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/40 opacity-0 group-hover/col:opacity-100 hover:!opacity-100 hover:border-muted-foreground hover:text-muted-foreground cursor-pointer shrink-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              className="text-2xs px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground shrink-0"
              title={`${domain.logicalName} (${domain.physicalType})`}
            >
              {domain.logicalName}
            </span>
          )
        )}

        <input
          className="nodrag flex-1 rounded bg-transparent px-1 font-mono text-muted-foreground outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          value={col.name}
          onChange={(e) => onUpdateColumn(col.id, { name: e.target.value })}
          readOnly={!canEdit}
          aria-label={t('erd.tableNode.aria.columnName')}
          style={{ minWidth: `${Math.max(col.name.length + 2, 10)}ch` }}
        />
        <input
          className="nodrag w-24 shrink-0 rounded bg-transparent px-1 text-right font-mono text-muted-foreground outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          value={col.type}
          onChange={(e) => onUpdateColumn(col.id, { type: e.target.value })}
          readOnly={!canEdit}
          aria-label={t('erd.tableNode.aria.columnType')}
        />

        <button
          className={cn(
            'nodrag w-5 text-center font-bold text-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            canEdit ? 'cursor-pointer' : 'cursor-default',
            !col.nullable ? 'text-erd-nn' : 'text-muted-foreground/40 hover:text-erd-nn/80',
          )}
          onClick={canEdit ? () => onUpdateColumn(col.id, { nullable: !col.nullable }) : undefined}
          title={t('erd.tableNode.title.toggleNotNull')}
          aria-label={t('erd.tableNode.aria.toggleNotNull', { name: col.name })}
        >
          NN
        </button>

        {canEdit && (
          <button
            className="nodrag opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-destructive cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => onDeleteColumn(col.id)}
            title={t('erd.tableNode.title.deleteColumn')}
            aria-label={t('erd.tableNode.aria.deleteColumn', { name: col.name })}
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeId}-${col.id}-source`}
          className={cn(
            '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
            !(connected || fkMode) && '!opacity-0',
          )}
        />
      </div>
    </div>
  );
}
