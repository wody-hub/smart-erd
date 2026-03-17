#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import dagre from 'dagre';
import parserPkg from 'node-sql-parser/build/postgresql.js';

const { Parser } = parserPkg;

const DEFAULT_ITERATIONS = 15;
const DEFAULT_WARMUP = 2;

const SCENARIO_TABLES = {
  S50: 50,
  S200: 200,
  S500: 500,
};

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 52;
const FOOTER_HEIGHT = 32;

function parseArgs(argv) {
  const options = {
    iterations: DEFAULT_ITERATIONS,
    warmup: DEFAULT_WARMUP,
    scenarios: Object.keys(SCENARIO_TABLES),
    out: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--iterations') {
      options.iterations = Number.parseInt(argv[i + 1] ?? '', 10);
      i += 1;
      continue;
    }
    if (arg === '--warmup') {
      options.warmup = Number.parseInt(argv[i + 1] ?? '', 10);
      i += 1;
      continue;
    }
    if (arg === '--scenarios') {
      options.scenarios = (argv[i + 1] ?? '')
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--out') {
      options.out = argv[i + 1] ?? null;
      i += 1;
    }
  }

  if (!Number.isFinite(options.iterations) || options.iterations <= 0) {
    throw new Error(`Invalid --iterations: ${options.iterations}`);
  }
  if (!Number.isFinite(options.warmup) || options.warmup < 0) {
    throw new Error(`Invalid --warmup: ${options.warmup}`);
  }
  options.scenarios = options.scenarios.filter((name) => name in SCENARIO_TABLES);
  if (options.scenarios.length === 0) {
    throw new Error('No valid scenarios. Use S50,S200,S500');
  }

  return options;
}

function calcNodeHeight(columnCount) {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT + FOOTER_HEIGHT;
}

function generateScenario(tableCount) {
  const sqlParts = [];

  for (let i = 1; i <= tableCount; i += 1) {
    const tableName = `table_${i}`;
    const previousTable = i > 1 ? `table_${i - 1}` : null;

    const columnSql = [
      '  id BIGINT PRIMARY KEY',
      '  , code VARCHAR(64) NOT NULL',
      '  , name VARCHAR(120) NOT NULL',
      '  , created_at TIMESTAMP NOT NULL',
    ];
    if (previousTable) {
      columnSql.push('  , prev_id BIGINT');
      columnSql.push(
        `  , CONSTRAINT fk_${tableName}_prev FOREIGN KEY (prev_id) REFERENCES ${previousTable}(id)`,
      );
    }

    sqlParts.push(`CREATE TABLE ${tableName} (\n${columnSql.join('\n')}\n);`);
  }

  return {
    ddl: sqlParts.join('\n\n'),
  };
}

function extractIdentifier(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    if (typeof value.value === 'string') {
      return value.value;
    }
    if (typeof value.column === 'string') {
      return value.column;
    }
    if (value.column && typeof value.column === 'object') {
      const nested = value.column;
      if (typeof nested === 'object' && nested.expr && typeof nested.expr === 'object') {
        const expr = nested.expr;
        if (typeof expr.value === 'string') {
          return expr.value;
        }
      }
    }
  }
  return '';
}

function extractDataType(definition) {
  const base = typeof definition?.dataType === 'string' ? definition.dataType : 'TEXT';
  const length = definition?.length;
  if (typeof length === 'number' && Number.isFinite(length)) {
    return `${base}(${length})`;
  }
  return base;
}

function astToParsed(astResult) {
  const astArray = Array.isArray(astResult) ? astResult : [astResult];
  const tables = [];
  const relations = [];

  for (const ast of astArray) {
    if (!ast || ast.type !== 'create' || ast.keyword !== 'table') {
      continue;
    }
    const tableName = ast.table?.[0]?.table;
    if (typeof tableName !== 'string' || !Array.isArray(ast.create_definitions)) {
      continue;
    }

    const pkColumns = new Set();
    for (const definition of ast.create_definitions) {
      if (definition?.resource !== 'constraint') {
        continue;
      }
      const constraintType = String(definition.constraint_type ?? '').toUpperCase();
      if (!constraintType.includes('PRIMARY KEY')) {
        continue;
      }
      for (const colRef of definition.definition ?? []) {
        const pkColumnName = extractIdentifier(colRef?.column ?? colRef);
        if (pkColumnName) {
          pkColumns.add(pkColumnName);
        }
      }
    }

    const columns = [];
    for (const definition of ast.create_definitions) {
      if (definition?.resource !== 'column') {
        continue;
      }
      const columnName = extractIdentifier(definition.column?.column ?? definition.column);
      if (!columnName) {
        continue;
      }
      const isPk = Boolean(definition.primary_key) || pkColumns.has(columnName);
      const isNotNull = String(definition.nullable?.type ?? '').toLowerCase() === 'not null';
      columns.push({
        name: columnName,
        type: extractDataType(definition.definition),
        pk: isPk,
        nullable: isPk ? false : !isNotNull,
        autoIncrement: false,
      });
    }

    for (const definition of ast.create_definitions) {
      if (definition?.resource !== 'constraint') {
        continue;
      }
      const constraintType = String(definition.constraint_type ?? '').toUpperCase();
      if (!constraintType.includes('FOREIGN KEY')) {
        continue;
      }
      const childColumns = (definition.definition ?? []).map((colRef) =>
        extractIdentifier(colRef?.column ?? colRef),
      );
      const parentTable = definition.reference_definition?.table?.[0]?.table;
      const parentColumns = (definition.reference_definition?.definition ?? []).map((colRef) =>
        extractIdentifier(colRef?.column ?? colRef),
      );
      if (typeof parentTable !== 'string' || !parentTable) {
        continue;
      }
      const pairLength = Math.min(childColumns.length, parentColumns.length);
      for (let i = 0; i < pairLength; i += 1) {
        const childColumn = childColumns[i];
        const parentColumn = parentColumns[i];
        if (!childColumn || !parentColumn) {
          continue;
        }
        relations.push({
          parentTable,
          parentColumn,
          childTable: tableName,
          childColumn,
        });
      }
    }

    tables.push({
      name: tableName,
      columns,
    });
  }

  return { tables, relations };
}

function applyParsed(parsed) {
  const tableMap = new Map();
  const nodes = [];
  const edges = [];
  const GRID_COLS = 4;
  const GRID_X = 300;
  const GRID_Y = 250;
  const START_X = 100;
  const START_Y = 100;

  parsed.tables.forEach((table, index) => {
    const nodeId = `table-${index + 1}`;
    const columnMap = new Map();
    table.columns.forEach((column, columnIndex) => {
      columnMap.set(column.name, `col-${index + 1}-${columnIndex + 1}`);
    });
    tableMap.set(table.name, { nodeId, columnMap });
    nodes.push({
      id: nodeId,
      data: { label: table.name, columns: table.columns },
      position: {
        x: START_X + (index % GRID_COLS) * GRID_X,
        y: START_Y + Math.floor(index / GRID_COLS) * GRID_Y,
      },
    });
  });

  parsed.relations.forEach((relation) => {
    const parent = tableMap.get(relation.parentTable);
    const child = tableMap.get(relation.childTable);
    if (!parent || !child) {
      return;
    }
    const parentColId = parent.columnMap.get(relation.parentColumn);
    const childColId = child.columnMap.get(relation.childColumn);
    if (!parentColId || !childColId) {
      return;
    }
    edges.push({
      id: `e-${parent.nodeId}-${parentColId}-${child.nodeId}-${childColId}`,
      source: parent.nodeId,
      target: child.nodeId,
      sourceHandle: `${parent.nodeId}-${parentColId}-source`,
      targetHandle: `${child.nodeId}-${childColId}-target`,
    });
  });

  return { nodes, edges };
}

function applyLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 80,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const height = calcNodeHeight(node.data.columns.length);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);
}

function percentile(samples, ratio) {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(ratio * sorted.length) - 1;
  const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));
  return Number(sorted[safeIndex].toFixed(3));
}

function summarize(samplesByMetric) {
  const result = {};
  for (const [name, samples] of Object.entries(samplesByMetric)) {
    result[name] = {
      p50: percentile(samples, 0.5),
      p95: percentile(samples, 0.95),
      min: percentile(samples, 0),
      max: percentile(samples, 1),
    };
  }
  return result;
}

function runScenario(parser, scenarioName, tableCount, options) {
  const scenario = generateScenario(tableCount);
  const samples = {
    parseMs: [],
    applyMs: [],
    layoutMs: [],
    totalMs: [],
  };

  const totalRuns = options.warmup + options.iterations;
  for (let i = 0; i < totalRuns; i += 1) {
    const totalStart = performance.now();

    const parseStart = performance.now();
    const ast = parser.astify(scenario.ddl, {
      database: 'postgresql',
      parseOptions: { includeLocations: false },
    });
    const parsed = astToParsed(ast);
    const parseMs = performance.now() - parseStart;

    const applyStart = performance.now();
    const applied = applyParsed(parsed);
    const applyMs = performance.now() - applyStart;

    const layoutStart = performance.now();
    applyLayout(applied.nodes, applied.edges);
    const layoutMs = performance.now() - layoutStart;

    const totalMs = performance.now() - totalStart;

    if (i >= options.warmup) {
      samples.parseMs.push(parseMs);
      samples.applyMs.push(applyMs);
      samples.layoutMs.push(layoutMs);
      samples.totalMs.push(totalMs);
    }
  }

  return {
    scenario: scenarioName,
    tableCount,
    edgeCount: tableCount > 1 ? tableCount - 1 : 0,
    iterations: options.iterations,
    warmup: options.warmup,
    summary: summarize(samples),
  };
}

function ensureDirectory(outPath) {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const parser = new Parser();
  const reports = {};

  for (const scenarioName of options.scenarios) {
    const tableCount = SCENARIO_TABLES[scenarioName];
    reports[scenarioName] = runScenario(parser, scenarioName, tableCount, options);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    config: {
      scenarios: options.scenarios,
      iterations: options.iterations,
      warmup: options.warmup,
    },
    reports,
  };

  const output = JSON.stringify(payload, null, 2);
  if (options.out) {
    const outPath = path.resolve(options.out);
    ensureDirectory(outPath);
    fs.writeFileSync(outPath, `${output}\n`, 'utf8');
  }

  process.stdout.write(`${output}\n`);
}

main();
