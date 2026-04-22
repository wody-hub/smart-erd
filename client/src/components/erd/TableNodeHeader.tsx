import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, FileCode2, Palette } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { KEYS } from '@/constants/keybindings';
import { TABLE_COLORS, normalizeTableHeaderColor } from '@/lib/table-colors';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { TableHandleLayout, TableHeaderColor } from '@/types/erd';
import type { TermSelectResult } from './ColumnAutocomplete';
import { cn } from '@/lib/utils';
import ColumnAutocomplete from './ColumnAutocomplete';
import TableColorPicker from './TableColorPicker';

/** TableNodeHeader 컴포넌트 props */
export interface TableNodeHeaderProps {
  /** 테이블 물리명 */
  label: string;
  /** 테이블 논리명 */
  logicalTableName?: string;
  /** 연결된 Term ID */
  tableTermId?: number;
  /** 헤더 색상 프리셋 */
  headerColor?: TableHeaderColor;
  /** 핸들 레이아웃 */
  handleLayout?: TableHandleLayout;
  /** 편집 모드 활성 여부 */
  isEditing: boolean;
  /** 중복 논리명 컬럼 개수 */
  duplicateLogicalNameColumnCount: number;
  /** 원격 락 정보 (없으면 null) */
  lockInfo: { name: string } | undefined;
  /** 테이블 논리명 변경 핸들러 */
  onLogicalNameChange: (value: string) => void;
  /** 용어 선택 핸들러 */
  onSelectTerm: (result: TermSelectResult) => void;
  /** 단어사전 기반 해석 결과 적용 핸들러 */
  onSelectDerived: (resolution: LogicalNameResolution) => void;
  /** 빠른 등록 흐름 요청 핸들러 */
  onRegisterNew: (logicalName: string) => void;
  /** 코드 에디터 해당 테이블로 이동 핸들러 */
  onNavigateToCode?: () => void;
  /** 테이블 물리명 변경 핸들러 */
  onRename: (value: string) => void;
  /** 헤더 색상 변경 핸들러 */
  onColorChange: (color: TableHeaderColor) => void;
  /** 핸들 레이아웃 변경 핸들러 */
  onHandleLayoutChange: (layout: TableHandleLayout) => void;
}

/**
 * 테이블 노드 헤더 컴포넌트.
 *
 * 논리명/물리명 표시, 색상 선택기, 락 아이콘, 중복 경고 배지를 렌더링한다.
 * 편집 모드에서는 인라인 편집 입력과 자동완성을 제공한다.
 *
 * @param props TableNodeHeaderProps
 */
export default function TableNodeHeader({
  label,
  logicalTableName,
  tableTermId,
  headerColor,
  handleLayout,
  isEditing,
  duplicateLogicalNameColumnCount,
  lockInfo,
  onLogicalNameChange,
  onSelectTerm,
  onSelectDerived,
  onRegisterNew,
  onNavigateToCode,
  onRename,
  onColorChange,
  onHandleLayoutChange,
}: TableNodeHeaderProps) {
  const { t } = useTranslation();

  /** 헤더 색상 설정 */
  const normalizedHeaderColor = normalizeTableHeaderColor(headerColor);
  const colorConfig = TABLE_COLORS[normalizedHeaderColor];

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } = useInlineEdit(onRename);

  const showHeaderControls = !!onNavigateToCode || isEditing;

  return (
    <div
      className="px-3 py-2 rounded-t group"
      style={{
        backgroundColor: `hsl(${colorConfig.bg})`,
        color: `hsl(${colorConfig.fg})`,
      }}
    >
      <div className="flex items-start gap-2">
        {/* 색상 선택기 트리거 (hover/focus 시 표시, M-1: 터치 대응 추가) */}
        {showHeaderControls && (
          <div className="mt-0.5 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {onNavigateToCode && (
              <button
                className="nodrag h-4 w-4 rounded-sm hover:bg-foreground/20"
                style={{ touchAction: 'manipulation' }}
                aria-label={t('erd.tableNode.aria.navigateToCode')}
                onClick={onNavigateToCode}
              >
                <FileCode2 className="h-3 w-3" />
              </button>
            )}

            {isEditing && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="nodrag h-4 w-4 rounded-sm hover:bg-foreground/20"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={t('erd.tableNode.aria.changeColor')}
                  >
                    <Palette className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-2">
                  <TableColorPicker currentColor={normalizedHeaderColor} onSelect={onColorChange} />
                </PopoverContent>
              </Popover>
            )}

            {isEditing && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="nodrag h-4 w-4 rounded-sm hover:bg-foreground/20"
                    style={{ touchAction: 'manipulation' }}
                    aria-label={t('erd.tableNode.aria.changeHandleLayout')}
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-2">
                  <div className="mb-2 text-2xs font-medium text-muted-foreground">
                    {t('erd.tableNode.handleLayout.label')}
                  </div>
                  <div className="flex items-center gap-1">
                    {(['split', 'left', 'right'] as const).map((layout) => (
                      <button
                        key={layout}
                        className={cn(
                          'nodrag rounded px-2 py-1 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          (handleLayout ?? 'split') === layout
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                        )}
                        onClick={() => onHandleLayoutChange(layout)}
                      >
                        {t(`erd.tableNode.handleLayout.${layout}`)}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {lockInfo && (
            <div
              className="text-2xs opacity-80 truncate"
              title={t('erd.lock.lockedBy', { name: lockInfo.name })}
              aria-label={t('erd.lock.badgeAria', { name: lockInfo.name })}
            >
              {t('erd.lock.lockedBy', { name: lockInfo.name })}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div
              className="flex-1 whitespace-nowrap"
              style={{
                minWidth: `${Math.max((logicalTableName?.length ?? 0) + 2, 12)}ch`,
              }}
            >
              {isEditing ? (
                <ColumnAutocomplete
                  value={logicalTableName ?? ''}
                  onChange={onLogicalNameChange}
                  onSelectTerm={onSelectTerm}
                  onSelectDerived={onSelectDerived}
                  onRegisterNew={onRegisterNew}
                  termLinked={!!tableTermId}
                  highlightOnHover={false}
                />
              ) : logicalTableName ? (
                <div
                  className="opacity-85 whitespace-nowrap"
                  style={{
                    fontSize: 'var(--erd-table-header-logical-font-size, 12px)',
                    lineHeight: 'var(--erd-table-header-logical-line-height, 14px)',
                  }}
                  title={logicalTableName}
                >
                  {logicalTableName}
                </div>
              ) : (
                <div
                  className="opacity-0 whitespace-nowrap"
                  style={{
                    fontSize: 'var(--erd-table-header-logical-font-size, 12px)',
                    lineHeight: 'var(--erd-table-header-logical-line-height, 14px)',
                  }}
                >
                  &nbsp;
                </div>
              )}
            </div>

            <div
              className="flex-1 text-right whitespace-nowrap"
              style={{ minWidth: `${Math.max(label.length + 2, 12)}ch` }}
            >
              {editing && isEditing ? (
                <input
                  className="nodrag bg-transparent font-semibold w-full text-right whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-ring rounded placeholder-current/50"
                  style={{
                    fontSize: 'var(--erd-table-header-physical-font-size, 16px)',
                    lineHeight: 'var(--erd-table-header-physical-line-height, 20px)',
                  }}
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
                  className="font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{
                    fontSize: 'var(--erd-table-header-physical-font-size, 16px)',
                    lineHeight: 'var(--erd-table-header-physical-line-height, 20px)',
                  }}
                  onDoubleClick={isEditing ? () => startEdit(label) : undefined}
                  title={label}
                >
                  {label}
                </div>
              )}
            </div>
          </div>

          {duplicateLogicalNameColumnCount > 0 && (
            <div
              className="mt-1 inline-flex items-center rounded-full bg-destructive/20 px-1.5 py-0.5 text-2xs"
              title={t('erd.tableNode.duplicateLogicalNameCount', {
                count: duplicateLogicalNameColumnCount,
              })}
            >
              {t('erd.tableNode.duplicateLogicalNameCount', {
                count: duplicateLogicalNameColumnCount,
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
