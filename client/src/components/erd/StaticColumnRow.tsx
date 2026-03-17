import { memo } from 'react';
import { Handle } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Column, TableHandleLayout } from '@/types/erd';
import {
  getValidationStatusI18nKey,
  type ColumnWarning,
  type WarningValidationStatus,
} from '@/hooks/useColumnValidation';
import { cn } from '@/lib/utils';
import { buildColumnHandleId } from '@/lib/handle-id';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useErdFkMode } from './ErdFkModeContext';
import { getColumnHandlePlacements } from './columnHandleLayout';

/** StaticColumnRow 컴포넌트 props */
interface StaticColumnRowProps {
  /** 컬럼 데이터 */
  col: Column;
  /** 노드 ID */
  nodeId: string;
  /** 핸들 레이아웃 */
  handleLayout: TableHandleLayout;
  /** 엣지 연결 여부 (미리 계산된 값) */
  connected: boolean;
  /** 컬럼 유효성 경고 */
  warning: ColumnWarning;
  /** 컬럼 논리명 중복 여부 */
  hasDuplicateLogicalName?: boolean;
  /** 도메인 논리명 */
  domainLogicalName?: string;
  /** 도메인 물리 타입 */
  domainPhysicalType?: string;
}

/**
 * 정적 컬럼 행 컴포넌트.
 *
 * 편집 불가 상태의 컬럼을 가볍게 렌더링한다.
 * DndContext, SortableContext, ColumnAutocomplete, DomainSelectPopover 없이
 * 순수 span/div만 사용하여 렌더링 비용을 최소화한다.
 * Handle은 항상 렌더링하여 엣지 위치 계산을 보장한다.
 *
 * @param props.col                 컬럼 데이터
 * @param props.nodeId              노드 ID
 * @param props.connected           엣지 연결 여부
 * @param props.warning             유효성 경고
 * @param props.domainLogicalName   도메인 논리명
 * @param props.domainPhysicalType  도메인 물리 타입
 */
function StaticColumnRow({
  col,
  nodeId,
  handleLayout,
  connected,
  warning,
  hasDuplicateLogicalName = false,
  domainLogicalName,
  domainPhysicalType,
}: StaticColumnRowProps) {
  const { t } = useTranslation();
  const fkMode = useErdFkMode();
  const targetHandlePlacements = getColumnHandlePlacements(handleLayout, 'target');
  const sourceHandlePlacements = getColumnHandlePlacements(handleLayout, 'source');

  return (
    <div
      className={cn(
        'relative px-3 py-1 text-xs group/col',
        hasDuplicateLogicalName && 'bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-1.5" style={{ paddingLeft: '12px' }}>
        {targetHandlePlacements.map((placement) => (
          <Handle
            key={buildColumnHandleId(nodeId, col.id, 'target', placement.side)}
            type="target"
            position={placement.position}
            id={buildColumnHandleId(nodeId, col.id, 'target', placement.side)}
            className={cn(
              '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
              !(connected || fkMode) && '!opacity-0 !pointer-events-none',
            )}
            style={placement.style}
          />
        ))}

        {/* PK badge */}
        <span
          className={cn(
            'w-5 text-center font-bold text-2xs',
            col.pk ? 'text-erd-pk' : 'text-muted-foreground/40',
          )}
        >
          PK
        </span>

        {/* FK badge */}
        <span
          className={cn(
            'w-5 text-center font-bold text-2xs',
            col.fk ? 'text-erd-fk' : 'text-muted-foreground/40',
          )}
        >
          FK
        </span>

        {/* AI badge — PK 컬럼에서만 표시 */}
        {col.pk && (
          <span
            className={cn(
              'w-5 text-center font-bold text-2xs',
              col.autoIncrement ? 'text-erd-ai' : 'text-muted-foreground/40',
            )}
          >
            AI
          </span>
        )}

        <span
          className="flex-[1.2] whitespace-nowrap text-xs"
          style={{ minWidth: `${Math.max((col.logicalName?.length ?? 0) + 2, 10)}ch` }}
        >
          {col.logicalName || ''}
        </span>

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
                  name: col.logicalName ?? col.name,
                })}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t('erd.tableNode.duplicateLogicalNameWarning', {
                name: col.logicalName ?? col.name,
              })}
            </TooltipContent>
          </Tooltip>
        )}

        <span
          className="flex-1 min-w-0 whitespace-nowrap px-1 font-mono text-left text-muted-foreground"
          style={{ minWidth: `${Math.max(col.name.length + 2, 10)}ch` }}
        >
          {col.name}
        </span>

        <div className="w-28 shrink-0 px-1 text-right">
          {domainLogicalName && (
            <span
              className="inline-flex max-w-full truncate rounded-full bg-erd-domain px-1.5 text-2xs text-erd-domain-foreground align-middle"
              title={`${domainLogicalName} (${domainPhysicalType ?? ''})`}
            >
              {domainLogicalName}
            </span>
          )}
        </div>

        <span className="w-24 shrink-0 px-1 text-left font-mono text-muted-foreground">
          {col.type}
        </span>

        {/* NN (NOT NULL) badge */}
        <span
          className={cn(
            'w-5 text-center font-bold text-2xs',
            !col.nullable ? 'text-erd-nn' : 'text-muted-foreground/40',
          )}
        >
          NN
        </span>

        {sourceHandlePlacements.map((placement) => (
          <Handle
            key={buildColumnHandleId(nodeId, col.id, 'source', placement.side)}
            type="source"
            position={placement.position}
            id={buildColumnHandleId(nodeId, col.id, 'source', placement.side)}
            className={cn(
              '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
              !(connected || fkMode) && '!opacity-0 !pointer-events-none',
            )}
            style={placement.style}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(StaticColumnRow);
