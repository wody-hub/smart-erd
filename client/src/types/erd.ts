import type { Node, Edge } from '@xyflow/react';

export interface Column {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  nullable?: boolean;
}

export interface TableNodeData {
  label: string;
  columns: Column[];
  [key: string]: unknown;
}

export type TableNode = Node<TableNodeData, 'table'>;

export type ERDEdge = Edge;
