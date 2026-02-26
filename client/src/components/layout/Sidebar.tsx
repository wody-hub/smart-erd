import { memo, useMemo, useState } from 'react';
import { Layers, Plus, X } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import GroupTableSelectDialog from '@/components/erd/GroupTableSelectDialog';
import { Button } from '@/components/ui/button';
import useCanvasStore from '@/stores/useCanvasStore';
import SidebarGroupItem from './SidebarGroupItem';
import SidebarTableItem from './SidebarTableItem';

/** Sidebar 컴포넌트의 props. */
interface SidebarProps {
  /** 편집 가능 여부 (VIEWER일 때 false — 테이블 추가/삭제/이름변경 숨김) */
  canEdit?: boolean;
  /** 현재 활성 그룹 ID */
  activeGroupId?: string | null;
  /** 그룹 뷰 진입 핸들러 */
  onViewGroup?: (groupId: string) => void;
  /** 전체 보기 복귀 핸들러 */
  onBackToAll?: () => void;
}

/** 사이드바 엔트리 문자열 분리자 */
const SIDEBAR_ENTRY_SEPARATOR = '\u001f';

/**
 * 좌측 사이드바 컴포넌트.
 *
 * @returns 사이드바 JSX
 */
function Sidebar({ canEdit = true, activeGroupId = null, onViewGroup, onBackToAll }: SidebarProps) {
  const { t } = useTranslation();
  const tableEntries = useCanvasStore(
    useShallow((state) =>
      state.nodes.map(
        (node) =>
          `${node.id}${SIDEBAR_ENTRY_SEPARATOR}${node.data.label}${SIDEBAR_ENTRY_SEPARATOR}${node.data.logicalTableName ?? ''}`,
      ),
    ),
  );
  const groups = useCanvasStore((s) => s.groups);
  const addTable = useCanvasStore((s) => s.addTable);
  const deleteTable = useCanvasStore((s) => s.deleteTable);
  const renameTable = useCanvasStore((s) => s.renameTable);
  const addGroup = useCanvasStore((s) => s.addGroup);
  const deleteGroup = useCanvasStore((s) => s.deleteGroup);
  const renameGroup = useCanvasStore((s) => s.renameGroup);
  const removeTableFromGroup = useCanvasStore((s) => s.removeTableFromGroup);
  const reactFlowInstance = useReactFlow();

  /** 테이블 선택 다이얼로그 대상 그룹 ID (null이면 닫힘) */
  const [tableSelectGroupId, setTableSelectGroupId] = useState<string | null>(null);

  /** 현재 활성 그룹 객체 */
  const activeGroup = activeGroupId
    ? (groups.find((group) => group.id === activeGroupId) ?? null)
    : null;

  /** 테이블 ID -> label 매핑 */
  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of tableEntries) {
      const [id, label] = entry.split(SIDEBAR_ENTRY_SEPARATOR);
      map.set(id, label);
    }
    return map;
  }, [tableEntries]);

  /** 테이블 선택 다이얼로그 대상 그룹 */
  const tableSelectGroup = tableSelectGroupId
    ? (groups.find((group) => group.id === tableSelectGroupId) ?? null)
    : null;

  /**
   * 테이블 클릭 시 캔버스에서 해당 노드로 포커스한다.
   *
   * @param nodeId 포커스할 테이블 노드 ID
   * @returns 없음
   */
  const handleFocusNode = (nodeId: string) => {
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return;

    reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
      zoom: 1.2,
      duration: 300,
    });
  };

  return (
    <aside
      id="diagram-sidebar"
      className="h-full w-full bg-muted border-r border-border p-4 shrink-0 flex flex-col"
    >
      <div className="flex-1 overflow-auto">
        {/* 테이블 섹션 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('erd.sidebar.tables')}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => addTable()}
              title={t('erd.sidebar.addTable')}
              aria-label={t('erd.sidebar.aria.addTable')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-0.5">
          {tableEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('erd.sidebar.noTables')}</p>
          ) : (
            tableEntries.map((entry) => {
              const [tableId, label, logicalTableName] = entry.split(SIDEBAR_ENTRY_SEPARATOR);
              const logical = logicalTableName?.trim();
              const displayLabel = logical ? `${logical} (${label})` : label;
              return (
                <SidebarTableItem
                  key={tableId}
                  nodeId={tableId}
                  label={label}
                  displayLabel={displayLabel}
                  renameAriaLabel={t('erd.sidebar.aria.renameTable', { name: label })}
                  deleteAriaLabel={t('erd.sidebar.aria.deleteTable', { name: label })}
                  onClick={() => handleFocusNode(tableId)}
                  onRename={(newName) => renameTable(tableId, newName)}
                  onDelete={() => deleteTable(tableId)}
                  canEdit={canEdit}
                />
              );
            })
          )}
        </div>

        {/* 그룹 섹션 */}
        <div className="flex items-center justify-between mb-3 mt-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('erd.sidebar.groups')}
          </h2>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => addGroup()}
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
              <SidebarGroupItem
                key={group.id}
                group={group}
                tableMap={tableMap}
                canEdit={canEdit}
                onViewGroup={onViewGroup}
                onRename={(newName) => renameGroup(group.id, newName)}
                onDelete={() => {
                  if (activeGroupId === group.id) {
                    onBackToAll?.();
                  }
                  deleteGroup(group.id);
                }}
                onRemoveTable={(tableId) => removeTableFromGroup(group.id, tableId)}
                onOpenTableSelect={() => setTableSelectGroupId(group.id)}
                isActive={activeGroupId === group.id}
              />
            ))
          )}
        </div>
      </div>

      <GroupTableSelectDialog
        open={!!tableSelectGroupId}
        onOpenChange={(open) => {
          if (!open) {
            setTableSelectGroupId(null);
          }
        }}
        groupId={tableSelectGroupId ?? ''}
        groupName={tableSelectGroup?.label ?? ''}
        existingTableIds={tableSelectGroup?.tableIds ?? []}
      />
    </aside>
  );
}

export default memo(Sidebar);
