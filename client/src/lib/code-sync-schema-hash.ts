import type { DdlParseResult } from './ddl-parser.js';
import type { ERDEdge, TableNode } from '../types/erd.js';
import { sortObjectKeys } from './code-sync-revision.js';
import { djb2 } from './hash.js';
import { extractColId } from './handle-id.js';

/**
 * 코드 자동반영 비교용 컬럼 스냅샷을 정규화한다.
 *
 * @param column 파싱된 컬럼 정보
 * @returns 의미 기반 컬럼 스냅샷
 */
function sanitizeParsedColumn(column: DdlParseResult['tables'][number]['columns'][number]) {
  return {
    name: column.name,
    type: column.type,
    pk: column.pk,
    nullable: column.nullable,
    autoIncrement: column.autoIncrement,
    logicalName: column.logicalName ?? column.comment ?? null,
    termId: column.termId ?? null,
    domainId: column.domainId ?? null,
  };
}

function buildParsedSchemaHashPayload(result: DdlParseResult) {
  return {
    tables: [...result.tables]
      .map((table) => ({
        name: table.name,
        logicalTableName: table.logicalTableName ?? table.comment ?? null,
        tableTermId: table.tableTermId ?? null,
        columns: [...table.columns]
          .map((column) => sanitizeParsedColumn(column))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    relations: [...result.relations]
      .map((relation) => ({
        parentTable: relation.parentTable,
        parentColumn: relation.parentColumn,
        childTable: relation.childTable,
        childColumn: relation.childColumn,
      }))
      .sort((a, b) =>
        `${a.parentTable}.${a.parentColumn}->${a.childTable}.${a.childColumn}`.localeCompare(
          `${b.parentTable}.${b.parentColumn}->${b.childTable}.${b.childColumn}`,
        ),
      ),
  };
}

/**
 * 파싱 결과를 결정적 스키마 해시로 변환한다.
 *
 * 주석/포맷 변화처럼 스키마에 영향 없는 수정은 제외하고
 * table/column/relation 구조만 비교 대상으로 사용한다.
 *
 * @param result 파싱 결과
 * @returns 결정적 스키마 해시
 */
export function buildParsedSchemaHash(result: DdlParseResult): string {
  const payload = buildParsedSchemaHashPayload(result);

  return djb2(JSON.stringify(sortObjectKeys(payload)));
}

/**
 * persisted ERD 그래프를 parsed schema와 동일 기준의 semantic hash로 변환한다.
 *
 * 노드/엣지 ID, handle side, 위치/시각 정보는 제외하고
 * 테이블/컬럼/관계 의미 정보만 비교 대상으로 사용한다.
 *
 * @param nodes persisted 테이블 노드 목록
 * @param edges persisted 관계 엣지 목록
 * @returns parsed schema hash와 동일 기준의 semantic hash
 *          안전한 비교가 불가능하면 null
 */
export function buildPersistedDiagramSchemaHash(
  nodes: TableNode[],
  edges: ERDEdge[],
): string | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relations: Array<{
    parentTable: string;
    parentColumn: string;
    childTable: string;
    childColumn: string;
  }> = [];

  for (const edge of edges) {
    const relationType = edge.data?.relationType ?? 'non-identifying';
    if (relationType !== 'non-identifying') {
      return null;
    }

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode || !edge.sourceHandle || !edge.targetHandle) {
      return null;
    }

    const sourceColumnId = extractColId(edge.sourceHandle, sourceNode.id);
    const targetColumnId = extractColId(edge.targetHandle, targetNode.id);
    const sourceColumn = sourceNode.data.columns.find((column) => column.id === sourceColumnId);
    const targetColumn = targetNode.data.columns.find((column) => column.id === targetColumnId);
    if (!sourceColumn || !targetColumn) {
      return null;
    }

    relations.push({
      parentTable: sourceNode.data.label,
      parentColumn: sourceColumn.name,
      childTable: targetNode.data.label,
      childColumn: targetColumn.name,
    });
  }

  const payload = {
    tables: [...nodes]
      .map((node) => ({
        name: node.data.label,
        logicalTableName: node.data.logicalTableName ?? null,
        tableTermId: node.data.tableTermId ?? null,
        columns: [...node.data.columns]
          .map((column) =>
            sanitizeParsedColumn({
              name: column.name,
              type: column.type,
              pk: column.pk === true,
              nullable: column.nullable !== false,
              autoIncrement: column.autoIncrement === true,
              logicalName: column.logicalName,
              comment: column.logicalName,
              termId: column.termId,
              domainId: column.domainId,
            }),
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    relations: relations
      .sort((a, b) =>
        `${a.parentTable}.${a.parentColumn}->${a.childTable}.${a.childColumn}`.localeCompare(
          `${b.parentTable}.${b.parentColumn}->${b.childTable}.${b.childColumn}`,
        ),
      ),
  };

  return djb2(JSON.stringify(sortObjectKeys(payload)));
}
