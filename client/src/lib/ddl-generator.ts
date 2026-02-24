import type { TableNode, ERDEdge, DbmsType, Column } from '@/types/erd';
import { extractColId } from '@/lib/handle-id';

/** DBMS별 방언 설정 */
interface DbmsDialect {
  /** 식별자 인용 (테이블명, 컬럼명) */
  quote(name: string): string;
  /** 문장 구분자 */
  statementSeparator: string;
  /** 컬럼 COMMENT 문 생성 (null이면 미지원) */
  comment?(table: string, column: string, text: string): string;
  /** 테이블 COMMENT 문 생성 (COMMENT ON TABLE) */
  tableComment?(table: string, text: string): string;
  /** 테이블 생성 후 추가 옵션 (예: ENGINE=InnoDB) */
  tableOptions?: string;
  /** MySQL 인라인 컬럼 COMMENT 생성 */
  inlineComment?(text: string): string;
  /** MySQL 인라인 테이블 COMMENT 생성 */
  inlineTableComment?(text: string): string;
  /** 자동증가 토큰 설정 */
  autoIncrement?: {
    /** SQL 토큰 */
    token: string;
    /** true: NOT NULL 뒤에 배치 (MySQL), false: 타입 뒤에 배치 (기본) */
    afterNotNull?: boolean;
  };
}

/** FK 관계 정보 */
interface FkRelation {
  /** 자식 테이블명 */
  childTable: string;
  /** 자식 컬럼명 */
  childColumn: string;
  /** 부모 테이블명 */
  parentTable: string;
  /** 부모 컬럼명 */
  parentColumn: string;
}

/**
 * 쌍따옴표 식별자를 이스케이프한다 (PostgreSQL, Oracle, ANSI).
 *
 * @param name 식별자
 * @returns 쌍따옴표가 이스케이프된 식별자
 */
function escapeDoubleQuote(name: string): string {
  return name.replace(/"/g, '""');
}

/**
 * 백틱 식별자를 이스케이프한다 (MySQL).
 *
 * @param name 식별자
 * @returns 백틱이 이스케이프된 식별자
 */
function escapeBacktick(name: string): string {
  return name.replace(/`/g, '``');
}

/**
 * 대괄호 식별자를 이스케이프한다 (SQL Server).
 *
 * @param name 식별자
 * @returns 닫는 대괄호가 이스케이프된 식별자
 */
function escapeBracket(name: string): string {
  return name.replace(/]/g, ']]');
}

/** DBMS별 방언 레지스트리 */
const dialects: Record<DbmsType, DbmsDialect> = {
  postgresql: {
    quote: (name) => `"${escapeDoubleQuote(name)}"`,
    statementSeparator: ';',
    comment: (table, column, text) =>
      `COMMENT ON COLUMN "${escapeDoubleQuote(table)}"."${escapeDoubleQuote(column)}" IS '${escapeQuote(text)}'`,
    tableComment: (table, text) =>
      `COMMENT ON TABLE "${escapeDoubleQuote(table)}" IS '${escapeQuote(text)}'`,
    autoIncrement: { token: 'GENERATED ALWAYS AS IDENTITY' },
  },
  mysql: {
    quote: (name) => `\`${escapeBacktick(name)}\``,
    statementSeparator: ';',
    tableOptions: ' ENGINE=InnoDB',
    inlineComment: (text) => ` COMMENT '${escapeQuote(text)}'`,
    inlineTableComment: (text) => ` COMMENT='${escapeQuote(text)}'`,
    autoIncrement: { token: 'AUTO_INCREMENT', afterNotNull: true },
  },
  oracle: {
    quote: (name) => `"${escapeDoubleQuote(name)}"`,
    statementSeparator: ';',
    comment: (table, column, text) =>
      `COMMENT ON COLUMN "${escapeDoubleQuote(table)}"."${escapeDoubleQuote(column)}" IS '${escapeQuote(text)}'`,
    tableComment: (table, text) =>
      `COMMENT ON TABLE "${escapeDoubleQuote(table)}" IS '${escapeQuote(text)}'`,
    autoIncrement: { token: 'GENERATED ALWAYS AS IDENTITY' },
  },
  sqlserver: {
    quote: (name) => `[${escapeBracket(name)}]`,
    statementSeparator: ';\nGO',
    autoIncrement: { token: 'IDENTITY(1,1)' },
  },
  ansi: {
    quote: (name) => `"${escapeDoubleQuote(name)}"`,
    statementSeparator: ';',
    autoIncrement: { token: 'GENERATED ALWAYS AS IDENTITY' },
  },
};

/**
 * SQL 문자열 내 작은따옴표를 이스케이프한다.
 *
 * @param text 원본 문자열
 * @returns 이스케이프된 문자열
 */
function escapeQuote(text: string): string {
  return text.replace(/'/g, "''");
}

/**
 * 위상 정렬을 수행한다 (FK 참조 순서 기반).
 *
 * @param tableNames 테이블 이름 배열
 * @param fkRelations FK 관계 배열
 * @returns 위상 정렬된 테이블 이름 배열
 */
function topologicalSort(tableNames: string[], fkRelations: FkRelation[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const name of tableNames) {
    inDegree.set(name, 0);
    adjacency.set(name, []);
  }

  for (const fk of fkRelations) {
    if (fk.parentTable !== fk.childTable && inDegree.has(fk.parentTable)) {
      adjacency.get(fk.parentTable)!.push(fk.childTable);
      inDegree.set(fk.childTable, (inDegree.get(fk.childTable) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // 순환 참조가 있는 경우 나머지 테이블을 원래 순서대로 추가
  for (const name of tableNames) {
    if (!sorted.includes(name)) {
      sorted.push(name);
    }
  }

  return sorted;
}

/**
 * 컬럼 정의 문자열을 생성한다.
 *
 * @param col     컬럼 정보
 * @param dialect DBMS 방언
 * @returns 컬럼 정의 SQL 문자열
 */
function buildColumnDef(col: Column, dialect: DbmsDialect): string {
  const parts = [dialect.quote(col.name), col.type || 'VARCHAR(255)'];

  // 자동증가: NOT NULL 앞 (기본 위치 — PostgreSQL, Oracle, SQL Server, ANSI)
  if (col.pk && col.autoIncrement && dialect.autoIncrement && !dialect.autoIncrement.afterNotNull) {
    parts.push(dialect.autoIncrement.token);
  }

  if (!col.nullable) {
    parts.push('NOT NULL');
  }

  // 자동증가: NOT NULL 뒤 (MySQL)
  if (col.pk && col.autoIncrement && dialect.autoIncrement?.afterNotNull) {
    parts.push(dialect.autoIncrement.token);
  }

  if (dialect.inlineComment && col.logicalName) {
    parts.push(dialect.inlineComment(col.logicalName));
  }

  return parts.join(' ');
}

/**
 * FK 제약조건 이름을 생성한다.
 *
 * @param childTable  자식 테이블명
 * @param parentTable 부모 테이블명
 * @param childColumn 자식 컬럼명
 * @returns 제약조건 이름
 */
function buildFkConstraintName(
  childTable: string,
  parentTable: string,
  childColumn: string,
): string {
  return `fk_${childTable}_${parentTable}_${childColumn}`;
}

/**
 * ERD 노드/엣지 데이터를 SQL DDL 문자열로 변환한다.
 *
 * @param nodes React Flow 테이블 노드 배열
 * @param edges React Flow 엣지 배열 (FK 관계)
 * @param dbms  대상 DBMS 타입
 * @returns SQL DDL 문자열
 */
export function generateDdl(nodes: TableNode[], edges: ERDEdge[], dbms: DbmsType): string {
  if (nodes.length === 0) return '';

  const dialect = dialects[dbms];
  const statements: string[] = [];

  // 헤더 주석
  const now = new Date().toISOString().split('T')[0];
  statements.push(`-- Generated by Smart ERD`);
  statements.push(`-- DBMS: ${dbms.charAt(0).toUpperCase() + dbms.slice(1)}`);
  statements.push(`-- Date: ${now}`);
  statements.push('');

  // 노드 → 테이블 맵 구축
  const nodeMap = new Map<string, TableNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 엣지 → FK 관계 추출
  const fkRelations: FkRelation[] = [];
  for (const edge of edges) {
    if (!edge.sourceHandle || !edge.targetHandle) continue;

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceColId = extractColId(edge.sourceHandle, edge.source);
    const targetColId = extractColId(edge.targetHandle, edge.target);

    const sourceCol = sourceNode.data.columns.find((c) => c.id === sourceColId);
    const targetCol = targetNode.data.columns.find((c) => c.id === targetColId);

    if (sourceCol && targetCol) {
      fkRelations.push({
        parentTable: sourceNode.data.label,
        parentColumn: sourceCol.name,
        childTable: targetNode.data.label,
        childColumn: targetCol.name,
      });
    }
  }

  // 위상 정렬
  const tableNames = nodes.map((n) => n.data.label);
  const sortedNames = topologicalSort(tableNames, fkRelations);

  // 정렬 순서에 따라 노드 정렬
  const sortedNodes = sortedNames
    .map((name) => nodes.find((n) => n.data.label === name))
    .filter((n): n is TableNode => n !== undefined);

  // CREATE TABLE 문 생성
  for (const node of sortedNodes) {
    const { label, columns } = node.data;
    const lines: string[] = [];

    // 컬럼 정의
    for (const col of columns) {
      lines.push(`    ${buildColumnDef(col, dialect)}`);
    }

    // PK 제약조건
    const pkCols = columns.filter((c) => c.pk);
    if (pkCols.length > 0) {
      const pkColNames = pkCols.map((c) => dialect.quote(c.name)).join(', ');
      lines.push(`    CONSTRAINT ${dialect.quote(`pk_${label}`)} PRIMARY KEY (${pkColNames})`);
    }

    const tableBody = lines.join(',\n');
    const tableOptions = dialect.tableOptions ?? '';
    const inlineTblComment =
      dialect.inlineTableComment && node.data.logicalTableName
        ? dialect.inlineTableComment(node.data.logicalTableName)
        : '';
    statements.push(
      `CREATE TABLE ${dialect.quote(label)} (\n${tableBody}\n)${tableOptions}${inlineTblComment}${dialect.statementSeparator}`,
    );
    statements.push('');
  }

  // COMMENT 문 생성 (MySQL은 인라인이므로 제외)
  if (dialect.comment || dialect.tableComment) {
    const commentStatements: string[] = [];

    // 테이블 COMMENT (COMMENT ON TABLE)
    if (dialect.tableComment) {
      for (const node of sortedNodes) {
        if (node.data.logicalTableName) {
          commentStatements.push(
            `${dialect.tableComment(node.data.label, node.data.logicalTableName)}${dialect.statementSeparator}`,
          );
        }
      }
    }

    // 컬럼 COMMENT (COMMENT ON COLUMN)
    if (dialect.comment) {
      for (const node of sortedNodes) {
        for (const col of node.data.columns) {
          if (col.logicalName) {
            commentStatements.push(
              `${dialect.comment(node.data.label, col.name, col.logicalName)}${dialect.statementSeparator}`,
            );
          }
        }
      }
    }

    if (commentStatements.length > 0) {
      statements.push(...commentStatements);
      statements.push('');
    }
  }

  // ALTER TABLE FK 제약조건 생성
  if (fkRelations.length > 0) {
    for (const fk of fkRelations) {
      const constraintName = buildFkConstraintName(fk.childTable, fk.parentTable, fk.childColumn);
      statements.push(
        `ALTER TABLE ${dialect.quote(fk.childTable)}\n    ADD CONSTRAINT ${dialect.quote(constraintName)}\n    FOREIGN KEY (${dialect.quote(fk.childColumn)})\n    REFERENCES ${dialect.quote(fk.parentTable)} (${dialect.quote(fk.parentColumn)})${dialect.statementSeparator}`,
      );
      statements.push('');
    }
  }

  return statements.join('\n').trimEnd() + '\n';
}
