import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TableNodeData, TableGroup } from '@/types/erd';

/**
 * useDiagramPreview 훅의 반환 타입.
 */
interface UseDiagramPreviewReturn {
  /** preview용 노드 배열 */
  previewNodes: Node<TableNodeData>[];
  /** preview용 엣지 배열 */
  previewEdges: Edge[];
  /** preview용 그룹 배열 */
  previewGroups: TableGroup[];
  /** JSON 파싱 성공 여부 */
  parseSuccess: boolean;
  /** 파싱 에러 메시지 (실패 시) */
  parseError: string | null;
}

/**
 * 다이어그램 JSON content를 파싱하여 preview용 React Flow 노드/엣지를 반환하는 훅.
 *
 * WS 스냅샷 도착 전 API 응답의 JSON content를 즉시 렌더하기 위해 사용한다.
 * Y.Doc 주입 없이 순수 JSON 파싱만 수행한다.
 *
 * @param content 직렬화된 React Flow JSON 문자열 (null이면 빈 결과)
 * @returns preview 노드/엣지/그룹 및 파싱 결과
 */
export function useDiagramPreview(content: string | null | undefined): UseDiagramPreviewReturn {
  return useMemo(() => {
    if (!content) {
      return {
        previewNodes: [],
        previewEdges: [],
        previewGroups: [],
        parseSuccess: true,
        parseError: null,
      };
    }

    try {
      const parsed = JSON.parse(content) as {
        nodes?: Node<TableNodeData>[];
        edges?: Edge[];
        groups?: TableGroup[];
      };

      return {
        previewNodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        previewEdges: Array.isArray(parsed.edges) ? parsed.edges : [],
        previewGroups: Array.isArray(parsed.groups) ? parsed.groups : [],
        parseSuccess: true,
        parseError: null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown parse error';
      console.warn('[useDiagramPreview] JSON 파싱 실패:', message);
      return {
        previewNodes: [],
        previewEdges: [],
        previewGroups: [],
        parseSuccess: false,
        parseError: message,
      };
    }
  }, [content]);
}
