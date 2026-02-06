import { useEffect } from 'react';
import { MarkerType } from '@xyflow/react';
import DiagramPage from './pages/DiagramPage';
import useCanvasStore from './stores/useCanvasStore';
import type { TableNodeData } from './types/erd';
import type { Node, Edge } from '@xyflow/react';

const demoNodes: Node<TableNodeData>[] = [
  {
    id: 'users',
    type: 'table',
    position: { x: 50, y: 50 },
    data: {
      label: 'users',
      columns: [
        { id: 'id', name: 'id', type: 'BIGINT', pk: true },
        { id: 'login_id', name: 'login_id', type: 'VARCHAR(50)' },
        { id: 'password', name: 'password', type: 'VARCHAR(255)' },
        { id: 'name', name: 'name', type: 'VARCHAR(50)' },
      ],
    },
  },
  {
    id: 'teams',
    type: 'table',
    position: { x: 400, y: 50 },
    data: {
      label: 'teams',
      columns: [
        { id: 'id', name: 'id', type: 'BIGINT', pk: true },
        { id: 'name', name: 'name', type: 'VARCHAR(100)' },
        { id: 'owner_id', name: 'owner_id', type: 'BIGINT', fk: true },
      ],
    },
  },
  {
    id: 'projects',
    type: 'table',
    position: { x: 750, y: 50 },
    data: {
      label: 'projects',
      columns: [
        { id: 'id', name: 'id', type: 'BIGINT', pk: true },
        { id: 'name', name: 'name', type: 'VARCHAR(100)' },
        { id: 'team_id', name: 'team_id', type: 'BIGINT', fk: true },
      ],
    },
  },
  {
    id: 'diagrams',
    type: 'table',
    position: { x: 750, y: 280 },
    data: {
      label: 'diagrams',
      columns: [
        { id: 'id', name: 'id', type: 'BIGINT', pk: true },
        { id: 'name', name: 'name', type: 'VARCHAR(100)' },
        { id: 'project_id', name: 'project_id', type: 'BIGINT', fk: true },
        { id: 'content', name: 'content', type: 'CLOB' },
      ],
    },
  },
];

const demoEdges: Edge[] = [
  {
    id: 'e-users-teams',
    source: 'users',
    sourceHandle: 'users-id-source',
    target: 'teams',
    targetHandle: 'teams-owner_id-target',
    type: 'step',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-teams-projects',
    source: 'teams',
    sourceHandle: 'teams-id-source',
    target: 'projects',
    targetHandle: 'projects-team_id-target',
    type: 'step',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e-projects-diagrams',
    source: 'projects',
    sourceHandle: 'projects-id-source',
    target: 'diagrams',
    targetHandle: 'diagrams-project_id-target',
    type: 'step',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export default function App() {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  useEffect(() => {
    setNodes(demoNodes);
    setEdges(demoEdges);
  }, [setNodes, setEdges]);

  return <DiagramPage />;
}
