import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseDslBlock, type DslDictionary } from '../../src/lib/dsl-parser.js';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';

import { buildWordMatchIndex } from '../../src/lib/word-composition.js';

const dictionary: DslDictionary = {
  termByName: new Map(),
  domainByName: new Map(),
  domainById: new Map(),
  wordMatchIndex: buildWordMatchIndex([]),
};

for (const newline of ['\n', '\r', '\r\n']) {
  test(`no-edit ${JSON.stringify(newline)} names retain IDs and originals`, () => {
    const snapshot: ProjectionSnapshot = {
      revision: 1,
      dictionary: { terms: [], domains: [] },
      edges: [],
      nodes: [
        {
          id: 't',
          data: {
            label: 'physical',
            logicalTableName: `table${newline}name`,
            columns: [{ id: 'c', name: 'physical_col', logicalName: `x${newline}y`, type: 'INT' }],
          },
        },
      ],
    };
    const block = generateTableBlock('t', snapshot);
    const parsed = parseDslBlock(block.text, dictionary, { metadata: block.metadata });
    assert.equal(parsed.metadataMatchesText, true);
    assert.equal(parsed.columnRanges[0].columnId, 'c');
    assert.equal(parsed.metadata!.columns[0].logicalName, `x${newline}y`);
  });
}

test('normalization collisions never bind ambiguous IDs', () => {
  const snapshot: ProjectionSnapshot = {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: [
      {
        id: 't',
        data: {
          label: 'table',
          columns: [
            { id: 'a', name: 'x\ny', type: 'INT' },
            { id: 'b', name: 'x y', type: 'INT' },
          ],
        },
      },
    ],
  };
  const block = generateTableBlock('t', snapshot);
  const parsed = parseDslBlock(block.text, dictionary, { metadata: block.metadata });
  assert.equal(parsed.metadataMatchesText, false);
  assert.ok(parsed.columnRanges.every((range) => range.columnId === undefined));
});

test('unknownTerm remains error by default and becomes warning consistently only by option', () => {
  const text = 'Table 임의테이블 {\n  임의컬럼 ::INT\n}\n';
  const normal = parseDslBlock(text, dictionary);
  assert.ok(normal.result.errors.some((error) => error.startsWith('Unknown term:')));
  assert.ok(
    normal.diagnostics.some((d) => d.messageKey.endsWith('unknownTerm') && d.severity === 'error'),
  );
  const internal = parseDslBlock(text, dictionary, { unknownTermSeverity: 'warning' });
  assert.deepEqual(internal.result.errors, []);
  assert.ok(
    internal.diagnostics
      .filter((d) => d.messageKey.endsWith('unknownTerm'))
      .every((d) => d.severity === 'warning'),
  );
  const syntax = parseDslBlock(text.replace('::INT', '::!invalid'), dictionary, {
    unknownTermSeverity: 'warning',
  });
  assert.ok(syntax.result.errors.length > 0);
  assert.ok(syntax.diagnostics.some((d) => d.severity === 'error'));
});
