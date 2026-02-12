import { Plus } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import useCanvasStore from '@/stores/useCanvasStore';
import SidebarTableItem from './SidebarTableItem';

/** Sidebar 컴포넌트의 props. */
interface SidebarProps {
  /** 편집 가능 여부 (VIEWER일 때 false — 테이블 추가/삭제/이름변경 숨김) */
  canEdit?: boolean;
  /** 사이드바 너비(px) */
  width?: number;
}

/**
 * 좌측 사이드바 컴포넌트.
 *
 * 고정 너비(224px)의 테이블/그룹 목록 패널을 표시한다.
 * 테이블·그룹 추가, 삭제, 이름 변경, 클릭 시 캔버스 포커스 기능을 제공한다.
 *
 * @param props.canEdit 편집 가능 여부
 */
export default function Sidebar({ canEdit = true, width = 224 }: SidebarProps) {
  const { t } = useTranslation();
  const nodes = useCanvasStore((s) => s.nodes);
  const groupNodes = useCanvasStore((s) => s.groupNodes);
  const addTable = useCanvasStore((s) => s.addTable);
  const deleteTable = useCanvasStore((s) => s.deleteTable);
  const renameTable = useCanvasStore((s) => s.renameTable);
  const addGroup = useCanvasStore((s) => s.addGroup);
  const deleteGroup = useCanvasStore((s) => s.deleteGroup);
  const renameGroup = useCanvasStore((s) => s.renameGroup);
  const reactFlowInstance = useReactFlow();

  const getNodeSize = (value: unknown, fallback: number): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  };

  /** 테이블 클릭 시 캔버스에서 해당 노드로 포커스한다. @param nodeId 포커스할 테이블 노드 ID */
  const handleFocusNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
      zoom: 1.2,
      duration: 300,
    });
  };

  /** 그룹 클릭 시 캔버스에서 해당 그룹으로 포커스한다. @param groupId 포커스할 그룹 노드 ID */
  const handleFocusGroup = (groupId: string) => {
    const group = groupNodes.find((g) => g.id === groupId);
    if (!group) return;
    const width = getNodeSize(group.style?.width, 400);
    const height = getNodeSize(group.style?.height, 300);

    reactFlowInstance.setCenter(group.position.x + width / 2, group.position.y + height / 2, {
      zoom: 1.0,
      duration: 300,
    });
  };

  return (
    <aside
      id="diagram-sidebar"
      className="bg-muted border-r border-border p-4 shrink-0 flex flex-col"
      style={{ width }}
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
          {nodes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('erd.sidebar.noTables')}</p>
          ) : (
            nodes.map((node) => {
              const logical = node.data.logicalTableName?.trim();
              const displayLabel = logical ? `${logical} (${node.data.label})` : node.data.label;
              return (
                <SidebarTableItem
                  key={node.id}
                  nodeId={node.id}
                  label={node.data.label}
                  displayLabel={displayLabel}
                  renameAriaLabel={t('erd.sidebar.aria.renameTable', { name: node.data.label })}
                  deleteAriaLabel={t('erd.sidebar.aria.deleteTable', { name: node.data.label })}
                  onClick={() => handleFocusNode(node.id)}
                  onRename={(newName) => renameTable(node.id, newName)}
                  onDelete={() => deleteTable(node.id)}
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

        <div className="space-y-0.5">
          {groupNodes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('erd.sidebar.noGroups')}</p>
          ) : (
            groupNodes.map((group) => (
              <SidebarTableItem
                key={group.id}
                nodeId={group.id}
                label={group.data.label}
                renameAriaLabel={t('erd.sidebar.aria.renameGroup', { name: group.data.label })}
                deleteAriaLabel={t('erd.sidebar.aria.deleteGroup', { name: group.data.label })}
                onClick={() => handleFocusGroup(group.id)}
                onRename={(newName) => renameGroup(group.id, newName)}
                onDelete={() => deleteGroup(group.id)}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
