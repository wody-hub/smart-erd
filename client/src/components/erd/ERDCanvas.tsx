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
import useCanvasStore from '../../stores/useCanvasStore';
import TableNode from './TableNode';

const nodeTypes: NodeTypes = {
  table: TableNode,
};

export default function ERDCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore();

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
        <MiniMap
          nodeStrokeColor="#666"
          nodeColor="#fff"
          nodeBorderRadius={4}
        />
      </ReactFlow>
    </div>
  );
}
