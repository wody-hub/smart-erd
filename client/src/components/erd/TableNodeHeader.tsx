import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { KEYS } from '@/constants/keybindings';
import { TABLE_COLORS } from '@/lib/table-colors';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';
import type { TableHeaderColor } from '@/types/erd';
import type { TermSelectResult } from './ColumnAutocomplete';
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
  /** 테이블 물리명 변경 핸들러 */
  onRename: (value: string) => void;
  /** 헤더 색상 변경 핸들러 */
  onColorChange: (color: TableHeaderColor) => void;
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
  isEditing,
  duplicateLogicalNameColumnCount,
  lockInfo,
  onLogicalNameChange,
  onSelectTerm,
  onSelectDerived,
  onRegisterNew,
  onRename,
  onColorChange,
}: TableNodeHeaderProps) {
  const { t } = useTranslation();

  /** 헤더 색상 설정 */
  const colorConfig = TABLE_COLORS[headerColor ?? 'default'];

  const { editing, value, setValue, startEdit, confirmEdit, cancelEdit } = useInlineEdit(onRename);

  return (
    <div
      className="px-3 py-2 rounded-t group"
      style={{
        backgroundColor: `hsl(${colorConfig.bg})`,
        color: `hsl(${colorConfig.fg})`,
      }}
    >
      <div className="flex items-start gap-1">
        {/* 색상 선택기 트리거 (hover/focus 시 표시, M-1: 터치 대응 추가) */}
        {isEditing && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="nodrag opacity-0 group-hover:opacity-100 focus-within:opacity-100 h-4 w-4 rounded-sm hover:bg-foreground/20 transition-opacity shrink-0 mt-0.5"
                style={{ touchAction: 'manipulation' }}
                aria-label={t('erd.tableNode.aria.changeColor')}
              >
                <Palette className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-auto p-2">
              <TableColorPicker currentColor={headerColor ?? 'default'} onSelect={onColorChange} />
            </PopoverContent>
          </Popover>
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
          {/* 논리명 행 (있으면 표시, 없으면 더블클릭으로 추가) */}
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
            <div className="text-2xs opacity-80 truncate" title={logicalTableName}>
              {logicalTableName}
            </div>
          ) : null}

          {/* 물리명 행 */}
          {editing && isEditing ? (
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
              onDoubleClick={isEditing ? () => startEdit(label) : undefined}
            >
              {label}
            </div>
          )}

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
