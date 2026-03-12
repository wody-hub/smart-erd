import { memo } from 'react';
import { Layers, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import DiagramSidebarGroupItem from './DiagramSidebarGroupItem';
import DiagramSidebarTableItem from './DiagramSidebarTableItem';

/** 사이드바 테이블 행 view model. */
export interface SidebarTableEntry {
  /** 테이블 ID */
  id: string;
  /** 물리 테이블명 */
  label: string;
  /** 표시 라벨 */
  displayLabel: string;
}

/** 사이드바 그룹 view model. */
export interface SidebarGroupEntry {
  /** 그룹 ID */
  id: string;
  /** 그룹명 */
  label: string;
  /** 포함 테이블 ID 목록 */
  tableIds: string[];
}

/** DiagramSidebarView 컴포넌트의 props. */
interface DiagramSidebarViewProps {
  /** 편집 가능 여부 */
  canEdit?: boolean;
  /** 현재 활성 그룹 ID */
  activeGroupId?: string | null;
  /** 전체 테이블 목록 */
  tableEntries: SidebarTableEntry[];
  /** 표시할 그룹 목록 */
  groups: SidebarGroupEntry[];
  /** 그룹별 테이블 표시용 맵 */
  tableMap: Map<string, string>;
  /** 테이블 추가 핸들러 */
  onAddTable?: () => void;
  /** 그룹 추가 핸들러 */
  onAddGroup?: () => void;
  /** 테이블 포커스 핸들러 */
  onFocusTable: (tableId: string) => void;
  /** 테이블 이름 변경 핸들러 */
  onRenameTable: (tableId: string, newName: string) => void;
  /** 테이블 삭제 핸들러 */
  onDeleteTable: (tableId: string) => void;
  /** 그룹 뷰 진입 핸들러 */
  onViewGroup?: (groupId: string) => void;
  /** 전체 보기 복귀 핸들러 */
  onBackToAll?: () => void;
  /** 그룹 이름 변경 핸들러 */
  onRenameGroup: (groupId: string, newName: string) => void;
  /** 그룹 삭제 핸들러 */
  onDeleteGroup: (groupId: string) => void;
  /** 그룹에서 테이블 제거 핸들러 */
  onRemoveTableFromGroup: (groupId: string, tableId: string) => void;
  /** 그룹 테이블 선택 다이얼로그 열기 핸들러 */
  onOpenGroupTableSelect: (groupId: string) => void;
}

/**
 * 공용 레이아웃 사이드바 뷰.
 *
 * 도메인 상태 접근 없이, 전달받은 항목과 이벤트만 렌더링한다.
 */
function DiagramSidebarView({
  canEdit = true,
  activeGroupId = null,
  tableEntries,
  groups,
  tableMap,
  onAddTable,
  onAddGroup,
  onFocusTable,
  onRenameTable,
  onDeleteTable,
  onViewGroup,
  onBackToAll,
  onRenameGroup,
  onDeleteGroup,
  onRemoveTableFromGroup,
  onOpenGroupTableSelect,
}: DiagramSidebarViewProps) {
  const { t } = useTranslation();

  const activeGroup = activeGroupId
    ? (groups.find((group) => group.id === activeGroupId) ?? null)
    : null;

  return (
    <aside
      id="diagram-sidebar"
      className="h-full w-full bg-muted border-r border-border p-4 shrink-0 flex flex-col"
    >
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('erd.sidebar.tables')}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onAddTable}
              title={t('erd.sidebar.addTable')}
              aria-label={t('erd.sidebar.aria.addTable')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-0.5">
          {tableEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {activeGroup ? t('erd.group.noTables') : t('erd.sidebar.noTables')}
            </p>
          ) : (
            tableEntries.map((entry) => (
              <DiagramSidebarTableItem
                key={entry.id}
                nodeId={entry.id}
                label={entry.label}
                displayLabel={entry.displayLabel}
                renameAriaLabel={t('erd.sidebar.aria.renameTable', { name: entry.label })}
                deleteAriaLabel={t('erd.sidebar.aria.deleteTable', { name: entry.label })}
                onClick={() => onFocusTable(entry.id)}
                onRename={(newName) => onRenameTable(entry.id, newName)}
                onDelete={() => onDeleteTable(entry.id)}
                canEdit={canEdit}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between mb-3 mt-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('erd.sidebar.groups')}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onAddGroup}
              title={t('erd.sidebar.addGroup')}
              aria-label={t('erd.sidebar.aria.addGroup')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {activeGroupId && activeGroup && (
          <div className="mb-3 px-3 py-2 rounded-md bg-muted flex items-center gap-2" role="status">
            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activeGroup.label}</p>
              <p className="text-xs text-muted-foreground">{t('erd.group.readonly')}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onBackToAll}
              aria-label={t('erd.group.aria.backToAll')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-0.5">
          {groups.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('erd.sidebar.noGroups')}</p>
          ) : (
            groups.map((group) => (
              <DiagramSidebarGroupItem
                key={group.id}
                group={group}
                tableMap={tableMap}
                canEdit={canEdit}
                onViewGroup={onViewGroup}
                onRename={(newName) => onRenameGroup(group.id, newName)}
                onDelete={() => onDeleteGroup(group.id)}
                onRemoveTable={(tableId) => onRemoveTableFromGroup(group.id, tableId)}
                onOpenTableSelect={() => onOpenGroupTableSelect(group.id)}
                isActive={activeGroupId === group.id}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

export default memo(DiagramSidebarView);
