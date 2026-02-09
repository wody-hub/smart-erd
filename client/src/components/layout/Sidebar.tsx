import { Plus } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import useCanvasStore from '@/stores/useCanvasStore';
import SidebarTableItem from './SidebarTableItem';

/**
 * 좌측 사이드바 컴포넌트.
 *
 * 고정 너비(224px)의 테이블 목록 패널을 표시한다.
 * 테이블 추가, 삭제, 이름 변경, 클릭 시 캔버스 포커스 기능을 제공한다.
 */
export default function Sidebar() {
  const nodes = useCanvasStore((s) => s.nodes);
  const addTable = useCanvasStore((s) => s.addTable);
  const deleteTable = useCanvasStore((s) => s.deleteTable);
  const renameTable = useCanvasStore((s) => s.renameTable);
  const reactFlowInstance = useReactFlow();

  /** 테이블 클릭 시 캔버스에서 해당 노드로 포커스한다. @param nodeId 포커스할 테이블 노드 ID */
  const handleFocusNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
      zoom: 1.2,
      duration: 300,
    });
  };

  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-200 p-4 shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tables</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => addTable()}
          title="Add table"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-0.5">
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-400">No tables yet</p>
        ) : (
          nodes.map((node) => (
            <SidebarTableItem
              key={node.id}
              nodeId={node.id}
              label={node.data.label}
              onClick={() => handleFocusNode(node.id)}
              onRename={(newName) => renameTable(node.id, newName)}
              onDelete={() => deleteTable(node.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
