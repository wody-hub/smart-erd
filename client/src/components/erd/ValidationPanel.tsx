import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useColumnValidation,
  type ValidationStatus,
  type ColumnValidationResult,
} from '@/hooks/useColumnValidation';
import { cn } from '@/lib/utils';

/** ValidationPanel 컴포넌트 props */
interface ValidationPanelProps {
  /** 패널 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 유효성 검사 상태에 대응하는 아이콘을 반환한다.
 *
 * @param status 검사 상태
 * @returns 아이콘 JSX
 */
function StatusIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case 'matched':
      return <CheckCircle2 className="h-3.5 w-3.5 text-erd-validation-matched shrink-0" />;
    case 'name-mismatch':
    case 'type-mismatch':
      return <AlertTriangle className="h-3.5 w-3.5 text-erd-validation-mismatch shrink-0" />;
    case 'unregistered':
      return <XCircle className="h-3.5 w-3.5 text-erd-validation-unregistered shrink-0" />;
    case 'unchecked':
      return <HelpCircle className="h-3.5 w-3.5 text-erd-validation-unchecked shrink-0" />;
  }
}

/**
 * 개별 컬럼의 유효성 결과를 표시하는 행 컴포넌트.
 *
 * @param props.result 컬럼 유효성 검사 결과
 */
function ColumnRow({ result }: { result: ColumnValidationResult }) {
  const { t } = useTranslation();

  /** i18n 상태 키 매핑 */
  const statusKey =
    result.status === 'name-mismatch'
      ? 'nameMismatch'
      : result.status === 'type-mismatch'
        ? 'typeMismatch'
        : result.status;

  return (
    <div className="flex items-start gap-2 py-1 px-2">
      <StatusIcon status={result.status} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{result.logicalName || result.name}</div>
        {result.status !== 'matched' && result.status !== 'unchecked' && (
          <div className="text-2xs text-muted-foreground">
            {t(`erd.validation.status.${statusKey}`)}
            {result.expectedName && (
              <span className="block">
                {t('erd.validation.expected', { value: result.expectedName })}
              </span>
            )}
            {result.expectedType && (
              <>
                <span className="block">
                  {t('erd.validation.expected', { value: result.expectedType })}
                </span>
                <span className="block">
                  {t('erd.validation.actual', { value: result.actualType })}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 사전 유효성 검사 결과를 표시하는 우측 사이드 패널.
 *
 * 전체 요약(진행률)과 테이블별 접기/펼치기 목록으로 구성된다.
 *
 * @param props.onClose 패널 닫기 핸들러
 */
export default function ValidationPanel({ onClose }: ValidationPanelProps) {
  const { t } = useTranslation();
  const { tableValidations, matchedCount, totalCount, hasDictionary } = useColumnValidation();

  /** 테이블별 펼침 상태 */
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());

  /**
   * 테이블 펼침/접기 토글.
   *
   * @param nodeId 노드 ID
   */
  const toggleTable = (nodeId: string) => {
    setOpenTables((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const progressPercent = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border/75 bg-card/95 max-md:h-[18rem] max-md:w-full max-md:border-l-0 max-md:border-t">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-secondary">
          {t('erd.validation.panelTitle')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label={t('common.button.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary */}
      <div className="border-b border-border/70 px-4 py-4">
        <div className="mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {t('erd.validation.summary', { matched: matchedCount, total: totalCount })}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/70">
          <div
            className="h-full rounded-full bg-erd-validation-matched transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!hasDictionary ? (
          <div className="p-5 text-center text-xs text-muted-foreground">
            {t('erd.validation.emptyDictionary')}
          </div>
        ) : totalCount > 0 && matchedCount === totalCount ? (
          <div className="p-5 text-center text-xs font-medium text-erd-validation-matched">
            {t('erd.validation.allMatched')}
          </div>
        ) : (
          tableValidations.map((table) => {
            const isOpen = openTables.has(table.nodeId);
            const tableMatchCount = table.columns.filter((c) => c.status === 'matched').length;
            const hasIssues = tableMatchCount < table.columns.length;

            return (
              <Collapsible
                key={table.nodeId}
                open={isOpen}
                onOpenChange={() => toggleTable(table.nodeId)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 border-b border-border/50 px-4 py-2.5 text-left text-xs transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30',
                      hasIssues && 'font-medium text-foreground',
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{table.tableName}</span>
                    <span className="text-muted-foreground">
                      {tableMatchCount}/{table.columns.length}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mb-2 ml-5 border-l border-border/70 pl-3">
                    {table.columns.map((col) => (
                      <ColumnRow key={col.colId} result={col} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </div>
    </aside>
  );
}
