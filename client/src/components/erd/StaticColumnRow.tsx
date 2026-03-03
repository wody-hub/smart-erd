import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Column } from '@/types/erd';
import type { ColumnWarning } from '@/hooks/useColumnValidation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useErdFkMode } from './ErdFkModeContext';

/** StaticColumnRow 컴포넌트 props */
interface StaticColumnRowProps {
  /** 컬럼 데이터 */
  col: Column;
  /** 노드 ID */
  nodeId: string;
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
  connected,
  warning,
  hasDuplicateLogicalName = false,
  domainLogicalName,
  domainPhysicalType,
}: StaticColumnRowProps) {
  const { t } = useTranslation();
  const fkMode = useErdFkMode();

  return (
    <div
      className={cn(
        'relative px-3 py-1 text-xs group/col',
        hasDuplicateLogicalName && 'bg-destructive/5',
      )}
    >
      {/* Row 1: Handle + PK/FK + 논리명 + 경고 + N + Handle */}
      <div className="flex items-center gap-1" style={{ paddingLeft: '12px' }}>
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeId}-${col.id}-target`}
          className={cn(
            '!w-2 !h-2 !bg-erd-handle !border-erd-handle-border',
            !(connected || fkMode) && '!opacity-0',
          )}
        />

        {/* PK badge */}
        <span
          className={`w-5 text-center font-bold text-2xs ${col.pk ? 'text-erd-pk' : 'text-muted-foreground/40'}`}
        >
          PK
        </span>

        {/* FK badge */}
        <span
          className={`w-5 text-center font-bold text-2xs ${col.fk ? 'text-erd-fk' : 'text-muted-foreground/40'}`}
        >
          FK
        </span>

        {/* AI badge — PK 컬럼에서만 표시 */}
        {col.pk && (
          <span
            className={`w-5 text-center font-bold text-2xs ${col.autoIncrement ? 'text-erd-ai' : 'text-muted-foreground/40'}`}
          >
            AI
          </span>
        )}

        {/* Logical name (읽기 전용) */}
        <span className="flex-1 text-xs truncate">{col.logicalName || ''}</span>

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

        {/* NN (NOT NULL) badge */}
        <span
          className={`w-5 text-center font-bold text-2xs ${!col.nullable ? 'text-erd-nn' : 'text-muted-foreground/40'}`}
        >
          NN
        </span>

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

      {/* Row 2: 도메인 배지 + 물리명 + 타입 */}
      <div className="flex items-center gap-1 mt-0.5" style={{ paddingLeft: 'calc(12px + 3rem)' }}>
        {domainLogicalName && (
          <span
            className="text-2xs px-1.5 rounded-full bg-erd-domain text-erd-domain-foreground shrink-0"
            title={`${domainLogicalName} (${domainPhysicalType ?? ''})`}
          >
            {domainLogicalName}
          </span>
        )}
        <span className="flex-1 font-mono text-muted-foreground px-1 truncate min-w-0">
          {col.name}
        </span>
        <span className="w-24 font-mono text-muted-foreground px-1 text-right shrink-0">
          {col.type}
        </span>
      </div>
    </div>
  );
}

export default memo(StaticColumnRow);
