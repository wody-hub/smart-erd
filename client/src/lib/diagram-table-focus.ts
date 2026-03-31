import type { TableNode } from '@/types/erd';
import type { DslPreviewNode } from './dsl-preview-graph';
import { buildTableLockKeyFromNodeData } from './table-lock-key';
import type { CodeEditorTableFocusRequest } from './code-editor-table-navigation';

/**
 * persisted ERD 테이블 중 포커스 요청과 일치하는 노드를 찾는다.
 *
 * @param nodes persisted 테이블 노드 목록
 * @param request 코드 에디터 포커스 요청
 * @returns 매칭 노드 또는 null
 */
export function findPersistedTableNodeForFocus(
  nodes: readonly TableNode[],
  request: CodeEditorTableFocusRequest,
): TableNode | null {
  return (
    nodes.find(
      (node) =>
        node.type === 'table' && buildTableLockKeyFromNodeData(node.data) === request.tableKey,
    ) ??
    nodes.find((node) => node.type === 'table' && node.data.label === request.physicalName) ??
    nodes.find(
      (node) =>
        node.type === 'table' &&
        !!request.logicalName &&
        (node.data.logicalTableName?.trim() ?? '') === request.logicalName,
    ) ??
    null
  );
}

/**
 * preview 그래프 노드 중 포커스 요청과 일치하는 노드를 찾는다.
 *
 * @param nodes preview 노드 목록
 * @param request 코드 에디터 포커스 요청
 * @returns 매칭 노드 또는 null
 */
export function findPreviewTableNodeForFocus(
  nodes: readonly DslPreviewNode[],
  request: CodeEditorTableFocusRequest,
): DslPreviewNode | null {
  return (
    nodes.find((node) => node.data.label === request.physicalName) ??
    nodes.find(
      (node) =>
        !!request.logicalName && (node.data.logicalTableName?.trim() ?? '') === request.logicalName,
    ) ??
    null
  );
}
