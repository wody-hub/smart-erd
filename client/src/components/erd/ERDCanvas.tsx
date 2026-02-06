import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import useCanvasStore from '../../stores/useCanvasStore';
import TableNode from './TableNode';

/** React Flow에 등록할 커스텀 노드 타입 매핑 */
const nodeTypes: NodeTypes = {
  table: TableNode,
};

/**
 * ERD 캔버스 컴포넌트.
 *
 * React Flow를 사용하여 테이블 노드와 관계 엣지를 시각화한다.
 * 16x16 그리드 스냅, 미니맵, 컨트롤, step 타입 엣지(화살표)를 기본 설정으로 사용한다.
 * 상태는 {@link useCanvasStore}에서 관리한다.
 */
export default function ERDCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
    })),
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'step',
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap nodeStrokeColor="#666" nodeColor="#fff" nodeBorderRadius={4} />
      </ReactFlow>
    </div>
  );
}
