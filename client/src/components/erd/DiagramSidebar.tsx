import { memo, useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import DiagramSidebarView from '@/components/erd/DiagramSidebarView';
import GroupTableSelectDialog from '@/components/erd/GroupTableSelectDialog';
import { useDiagramErdCrudActions } from '@/collaboration/channel/diagram/use-diagram-erd-crud-actions';
import useCanvasStore from '@/stores/erd/useCanvasStore';

/** 사이드바 엔트리 문자열 분리자 */
const SIDEBAR_ENTRY_SEPARATOR = '\u001f';

/** DiagramSidebar props. */
interface DiagramSidebarProps {
  /** 편집 가능 여부 */
  canEdit?: boolean;
  /** 현재 활성 그룹 ID */
  activeGroupId?: string | null;
  /** 그룹 뷰 진입 핸들러 */
  onViewGroup?: (groupId: string) => void;
  /** 전체 보기 복귀 핸들러 */
  onBackToAll?: () => void;
}

/**
 * ERD 전용 사이드바 컨테이너.
 *
 * 캔버스 스토어와 React Flow 접근은 이 계층에만 두고,
 * DiagramSidebarView는 순수 뷰로 유지한다.
 */
function DiagramSidebar({
  canEdit = true,
  activeGroupId = null,
  onViewGroup,
  onBackToAll,
}: DiagramSidebarProps) {
  const tableEntries = useCanvasStore(
    useShallow((state) =>
      state.nodes.map(
        (node) =>
          `${node.id}${SIDEBAR_ENTRY_SEPARATOR}${node.data.label}${SIDEBAR_ENTRY_SEPARATOR}${node.data.logicalTableName ?? ''}`,
      ),
    ),
  );
  const groups = useCanvasStore((s) => s.groups);
  const reactFlowInstance = useReactFlow();
  const crudActions = useDiagramErdCrudActions();
  const [tableSelectGroupId, setTableSelectGroupId] = useState<string | null>(null);

  const activeGroup = activeGroupId
    ? (groups.find((group) => group.id === activeGroupId) ?? null)
    : null;

  const tableMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of tableEntries) {
      const [id, label] = entry.split(SIDEBAR_ENTRY_SEPARATOR);
      map.set(id, label);
    }
    return map;
  }, [tableEntries]);

  const visibleTableEntries = useMemo(() => {
    const entries = tableEntries.map((entry) => {
      const [id, label, logicalTableName] = entry.split(SIDEBAR_ENTRY_SEPARATOR);
      const logical = logicalTableName?.trim();
      return {
        id,
        label,
        displayLabel: logical ? `${logical} (${label})` : label,
      };
    });

    if (!activeGroup) {
      return entries;
    }

    const activeTableIds = new Set(activeGroup.tableIds);
    return entries.filter((entry) => activeTableIds.has(entry.id));
  }, [activeGroup, tableEntries]);

  const tableSelectGroup = tableSelectGroupId
    ? (groups.find((group) => group.id === tableSelectGroupId) ?? null)
    : null;

  const handleFocusNode = (nodeId: string) => {
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return;

    reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
      zoom: 1.2,
      duration: 300,
    });
  };

  const handleRenameTable = (tableId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    crudActions.renameTable(tableId, trimmed);
  };

  const handleAddTable = () => {
    crudActions.addTable();
  };

  const handleDeleteTable = (tableId: string) => {
    crudActions.deleteTable(tableId);
  };

  const handleAddGroup = () => {
    crudActions.addGroup();
  };

  const handleRenameGroup = (groupId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    crudActions.renameGroup(groupId, trimmed);
  };

  const handleDeleteGroup = (groupId: string) => {
    crudActions.deleteGroup(groupId);
  };

  const handleRemoveTableFromGroup = (groupId: string, tableId: string) => {
    crudActions.updateGroupTables(groupId, [], [tableId]);
  };

  return (
    <>
      <DiagramSidebarView
        canEdit={canEdit}
        activeGroupId={activeGroupId}
        tableEntries={visibleTableEntries}
        groups={groups}
        tableMap={tableMap}
        onAddTable={handleAddTable}
        onAddGroup={handleAddGroup}
        onFocusTable={handleFocusNode}
        onRenameTable={handleRenameTable}
        onDeleteTable={handleDeleteTable}
        onViewGroup={onViewGroup}
        onBackToAll={onBackToAll}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={(groupId) => {
          if (activeGroupId === groupId) {
            onBackToAll?.();
          }
          handleDeleteGroup(groupId);
        }}
        onRemoveTableFromGroup={handleRemoveTableFromGroup}
        onOpenGroupTableSelect={(groupId) => setTableSelectGroupId(groupId)}
      />

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
    </>
  );
}

export default memo(DiagramSidebar);
