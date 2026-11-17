import type * as Y from 'yjs';
import type {
  DocumentReadExecutor,
  ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import {
  getTablesMap,
  getEdgesMap,
  yTableYMapToNode,
  yEdgeYMapToEdge,
} from '@/collaboration/yjsBridge';
import type { ProjectionDictionary, ProjectionSnapshot } from '@/lib/dsl-block-contracts';
import { parseErdColumnEntityId } from './erd-column-entity-id';

/**
 * 테이블·컬럼·관계 범위가 불명확하면 전체 재검증으로 폴백한다.
 * @param scopes 문서 변경 범위
 * @returns 전체 읽기가 필요한지 여부
 */
export function needsFullProjectionRead(scopes: ScopeRef[]): boolean {
  return (
    scopes.length === 0 ||
    scopes.some(
      (scope) =>
        !scope.id ||
        !['table', 'column', 'edge', 'group'].includes(scope.kind) ||
        (scope.kind === 'column' && !parseErdColumnEntityId(scope.id)),
    )
  );
}

/**
 * 한 동기 store.execute 안에서 사전과 필요한 엔티티를 함께 읽는다.
 * 기존 단일 테이블 투영기가 신형/레거시 컬럼과 scalar/레거시 좌표를 읽는다.
 * getDocument는 반드시 read와 같은 엔진의 현재 문서를 반환해야 한다.
 * @param read 문서 읽기 실행기
 * @param getDocument 현재 문서 조회 함수
 * @param dictionary 호출 중 변경되지 않는 사전 뷰
 * @param revision 새 투영 revision
 * @param previous 이전 전체 스냅샷 (없으면 전체 읽기)
 * @param scopes 누적 변경 범위 (없으면 전체 읽기)
 * @returns 일관 스냅샷과 읽은 문서 식별자 및 문서 revision
 */
export function readErdCodeProjectionSnapshot(
  read: Pick<DocumentReadExecutor, 'execute'>,
  getDocument: () => Y.Doc,
  dictionary: ProjectionDictionary,
  revision: number,
  previous?: ProjectionSnapshot,
  scopes?: ScopeRef[],
): { snapshot: ProjectionSnapshot; document: Y.Doc; documentRevision: string } {
  return read.execute({
    /**
     * 동일 읽기 경계 안에서 현재 문서의 투영 데이터를 확보한다.
     * @param context 스토어의 읽기 컨텍스트
     * @returns 스냅샷과 문서 식별 정보
     */
    run(context) {
      const document = getDocument();
      if (previous && scopes?.length === 0) {
        return {
          snapshot: { ...previous, revision, dictionary },
          document,
          documentRevision: context.getRevision(),
        };
      }
      const tables = getTablesMap(document);
      const edges = getEdgesMap(document);
      const full = !previous || !scopes || needsFullProjectionRead(scopes);
      const tableIds = new Set<string>();
      const edgeIds = new Set<string>();
      for (const scope of scopes ?? []) {
        if (scope.kind === 'table') tableIds.add(scope.id);
        if (scope.kind === 'column') {
          const ref = parseErdColumnEntityId(scope.id);
          if (ref) tableIds.add(ref.tableId);
        }
        if (scope.kind === 'edge') edgeIds.add(scope.id);
      }
      // 관계만 변경되어도 FK 플래그와 삭제 전후 양끝 테이블을 다시 읽는다.
      for (const id of edgeIds) {
        const before = previous?.edges.find((edge) => edge.id === id);
        const after = edges.get(id);
        if (before) {
          tableIds.add(before.source);
          tableIds.add(before.target);
        }
        if (after) {
          tableIds.add(after.get('source') as string);
          tableIds.add(after.get('target') as string);
        }
      }
      const oldNodes = new Map(previous?.nodes.map((node) => [node.id, node]));
      const oldEdges = new Map(previous?.edges.map((edge) => [edge.id, edge]));
      const nodes: ProjectionSnapshot['nodes'] = [];
      tables.forEach((table, id) => {
        const old = oldNodes.get(id);
        nodes.push(!full && old && !tableIds.has(id) ? old : yTableYMapToNode(id, table));
      });
      const relations: ProjectionSnapshot['edges'] = [];
      edges.forEach((edge, id) => {
        const old = oldEdges.get(id);
        const connected =
          tableIds.has(edge.get('source') as string) ||
          tableIds.has(edge.get('target') as string) ||
          (old && (tableIds.has(old.source) || tableIds.has(old.target)));
        relations.push(
          !full && old && !connected && !edgeIds.has(id) ? old : yEdgeYMapToEdge(id, edge),
        );
      });
      return {
        snapshot: { revision, nodes, edges: relations, dictionary },
        document,
        documentRevision: context.getRevision(),
      };
    },
  });
}
