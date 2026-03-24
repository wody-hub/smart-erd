import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeDiagramDefinitionExportContent } from '../../src/lib/diagram-definition-export.js';

test('serializeDiagramDefinitionExportContent keeps nodes and edges and clears groups', () => {
  const nodes = [
    {
      id: 'table-1',
      type: 'table',
      position: { x: 10, y: 20 },
      data: {
        label: 'common_code',
        logicalTableName: '공통코드',
        columns: [
          {
            id: 'column-1',
            name: 'code_id',
            logicalName: '코드 ID',
            type: 'varchar(50)',
            nullable: false,
            pk: true,
          },
        ],
      },
    },
  ];
  const edges = [
    {
      id: 'edge-1',
      source: 'table-1',
      target: 'table-2',
      sourceHandle: 'table-1-column-1-source-left',
      targetHandle: 'table-2-column-2-target-left',
    },
  ];

  const content = serializeDiagramDefinitionExportContent(nodes as never, edges as never);
  const parsed = JSON.parse(content);

  assert.deepEqual(parsed.nodes, nodes);
  assert.deepEqual(parsed.edges, edges);
  assert.deepEqual(parsed.groups, []);
});
