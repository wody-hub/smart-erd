import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Node } from '@xyflow/react';
import { buildDiagramDictionaryReconciliationPlan, DEFAULT_COLUMN_TYPE } from '../../src/lib/diagram-dictionary-reconciliation.js';
import { buildWordMatchIndex } from '../../src/lib/word-composition.js';
import { resolveLogicalName } from '../../src/lib/logical-name-resolution.js';
import type { Domain, Term, Word } from '../../src/types/dictionary.js';
import type { TableNodeData } from '../../src/types/erd.js';

function createWord(id: number, logicalName: string, physicalName: string): Word {
  return {
    id,
    logicalName,
    physicalName,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

function createDomain(id: number, logicalName: string, physicalType: string): Domain {
  return {
    id,
    logicalName,
    domainGroup: null,
    domainClassification: null,
    dataType: null,
    dataLength: null,
    dataScale: null,
    physicalType,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

function createTerm(
  id: number,
  logicalName: string,
  physicalName: string,
  domainId: number | null,
): Term {
  return {
    id,
    logicalName,
    physicalName,
    description: null,
    teamId: 1,
    dictionarySetId: 1,
    domainId,
    domainLogicalName: domainId != null ? '식별자' : null,
    createdAt: '2026-03-13T00:00:00Z',
    updatedAt: '2026-03-13T00:00:00Z',
  };
}

function createTableNode(data: TableNodeData): Node<TableNodeData> {
  return {
    id: 'table-1',
    type: 'table',
    position: { x: 100, y: 100 },
    data,
  };
}

test('linked term and domain changes are applied to table and column on entry', () => {
  const words = [createWord(1, '회원', 'member'), createWord(2, '아이디', 'id')];
  const domains = [createDomain(10, '식별자', 'UUID')];
  const terms = [createTerm(100, '회원 아이디', 'member_id', 10)];
  const nodes = [
    createTableNode({
      label: 'user',
      logicalTableName: '사용자 아이디',
      tableTermId: 100,
      columns: [
        {
          id: 'col-1',
          logicalName: '사용자 아이디',
          name: 'user_id',
          type: 'BIGINT',
          termId: 100,
          domainId: 10,
        },
      ],
    }),
  ];

  const runtime = {
    findTermById: (id: number) => terms.find((term) => term.id === id),
    findDomainById: (id: number) => domains.find((domain) => domain.id === id),
    resolveLogicalName: (logicalName: string) =>
      resolveLogicalName(logicalName, {
        termByName: new Map(terms.map((term) => [term.logicalName, term])),
        domainById: new Map(domains.map((domain) => [domain.id, domain])),
        wordMatchIndex: buildWordMatchIndex(words),
      }),
  };

  const plan = buildDiagramDictionaryReconciliationPlan(nodes, runtime);

  assert.deepEqual(plan.tableMetaUpdates, [
    {
      nodeId: 'table-1',
      updates: {
        logicalTableName: '회원 아이디',
        label: 'member_id',
      },
    },
  ]);
  assert.deepEqual(plan.columnUpdates, [
    {
      nodeId: 'table-1',
      colId: 'col-1',
      updates: {
        logicalName: '회원 아이디',
        name: 'member_id',
        type: 'UUID',
      },
    },
  ]);
});

test('deleted term falls back to word composition and clears stale bindings', () => {
  const words = [createWord(1, '사용자', 'user'), createWord(2, '아이디', 'id')];
  const domains = [createDomain(10, '식별자', 'UUID')];
  const nodes = [
    createTableNode({
      label: 'legacy_user',
      logicalTableName: '사용자 아이디',
      tableTermId: 100,
      columns: [
        {
          id: 'col-1',
          logicalName: '사용자 아이디',
          name: 'legacy_user_id',
          type: 'UUID',
          termId: 100,
          domainId: 10,
        },
      ],
    }),
  ];

  const runtime = {
    findTermById: (_id: number) => undefined,
    findDomainById: (id: number) => domains.find((domain) => domain.id === id),
    resolveLogicalName: (logicalName: string) =>
      resolveLogicalName(logicalName, {
        termByName: new Map<string, Term>(),
        domainById: new Map(domains.map((domain) => [domain.id, domain])),
        wordMatchIndex: buildWordMatchIndex(words),
      }),
  };

  const plan = buildDiagramDictionaryReconciliationPlan(nodes, runtime);

  assert.deepEqual(plan.tableMetaUpdates, [
    {
      nodeId: 'table-1',
      updates: {
        label: 'user_id',
        tableTermId: undefined,
      },
    },
  ]);
  assert.deepEqual(plan.columnUpdates, [
    {
      nodeId: 'table-1',
      colId: 'col-1',
      updates: {
        name: 'user_id',
        type: DEFAULT_COLUMN_TYPE,
        termId: undefined,
        domainId: undefined,
      },
    },
  ]);
});

test('explicit domain mapping keeps link and updates type to latest domain physical type', () => {
  const domains = [createDomain(10, '식별자', 'UUID')];
  const nodes = [
    createTableNode({
      label: 'users',
      columns: [
        {
          id: 'col-1',
          logicalName: '사용자 아이디',
          name: 'user_id',
          type: 'BIGINT',
          domainId: 10,
        },
      ],
    }),
  ];

  const runtime = {
    findTermById: (_id: number) => undefined,
    findDomainById: (id: number) => domains.find((domain) => domain.id === id),
    resolveLogicalName: (logicalName: string) =>
      resolveLogicalName(logicalName, {
        termByName: new Map<string, Term>(),
        domainById: new Map(domains.map((domain) => [domain.id, domain])),
        wordMatchIndex: buildWordMatchIndex([]),
      }),
  };

  const plan = buildDiagramDictionaryReconciliationPlan(nodes, runtime);

  assert.deepEqual(plan.tableMetaUpdates, []);
  assert.deepEqual(plan.columnUpdates, [
    {
      nodeId: 'table-1',
      colId: 'col-1',
      updates: {
        type: 'UUID',
      },
    },
  ]);
});
