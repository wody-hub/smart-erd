import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as names from '../../src/lib/code-block-names.js';
import { generateProjection } from '../../src/lib/dsl-block-projection.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';

test('duplicate detector is deterministic across merged column order and case variants', () => {
  const columns = [
    { id: 'z', name: 'same' },
    { id: 'a', name: 'Same' },
    { id: 'b', name: 'unique' },
  ];
  assert.deepEqual(names.duplicateColumnNames(columns), [
    { name: 'Same / same', columnIds: ['a', 'z'] },
  ]);
  assert.deepEqual(
    names.duplicateColumnNames([...columns].reverse()),
    names.duplicateColumnNames(columns),
  );
  assert.equal(names.tableNameCollision({ label: 'users' }, [{ label: 'Users' }]), false);
});

for (const locale of ['ko', 'en'])
  test(`editable panel shows duplicate count and physical names (${locale})`, () => {
    const resources = JSON.parse(
      readFileSync(`src/i18n/locales/${locale}/translation.json`, 'utf8'),
    );
    const projection = {
      ...generateProjection({
        revision: 1,
        edges: [],
        dictionary: { terms: [], domains: [] },
        nodes: [
          {
            id: 't',
            data: {
              label: 'customers',
              columns: [
                { id: 'a', name: 'same', type: 'INT' },
                { id: 'b', name: 'same', type: 'TEXT' },
              ],
            },
          },
        ],
      }),
      status: 'ready',
      unsupportedNotices: 0,
    };
    const h = sourceHookHarness('src/components/erd/DslEditableProjectionPanel.tsx', {
      'code-block-names': names,
      'use-diagram-code-projection': { useDiagramCodeProjection: () => projection },
      'use-diagram-code-block-editing': {
        useDiagramCodeBlockEditing: () => ({ blocks: [], onMount() {} }),
      },
      'use-diagram-unapplied-shared-draft': { useDiagramUnappliedSharedDraft: () => false },
      ErdDictionaryContext: {
        useErdDictionary: () => ({ terms: [], domains: [], dictionaryRevision: 0 }),
      },
      'react-i18next': {
        useTranslation: () => ({
          t: (key: string, args: Record<string, unknown> = {}) => {
            const template = key.split('.').reduce((value, part) => value?.[part], resources);
            return typeof template === 'string'
              ? template.replace(/{{(\w+)}}/g, (_, name: string) => String(args[name]))
              : key;
          },
        }),
      },
    });
    const panel = h.exports.default as (props: unknown) => unknown;
    const tree = h.render(() =>
      panel({ diagramId: 'd', runtime: { ready: true }, ready: true, isReady: () => true }),
    );
    /** React 트리의 화면 문자열과 Editor 옵션을 수집한다. */
    const collect = (
      value: unknown,
    ): { text: string; editor?: { path: string; options: { contextmenu: boolean } } } => {
      if (typeof value === 'string') return { text: value };
      if (!value || typeof value !== 'object') return { text: '' };
      if (Array.isArray(value))
        return value
          .map(collect)
          .reduce((a, b) => ({ text: a.text + b.text, editor: a.editor ?? b.editor }), {
            text: '',
          });
      const props = (
        value as {
          props?: { children?: unknown; path?: string; options?: { contextmenu: boolean } };
        } | null
      )?.props;
      const children = collect(props?.children ?? null);
      return {
        ...children,
        editor: props?.path ? { path: props.path, options: props.options! } : children.editor,
      };
    };
    const rendered = collect(tree);
    assert.match(rendered.text, /2/);
    assert.match(rendered.text, /customers: same/);
    assert.match(
      rendered.text,
      locale === 'ko' ? /중복된 컬럼 물리명/ : /Duplicate column physical names/,
    );
    assert.ok(rendered.editor?.path.startsWith('erd-unified-edit://'));
    assert.equal(rendered.editor?.options.contextmenu, false);
    h.cleanup();
  });

test('table physical names and declared DSL names have separate uniqueness scopes', () => {
  assert.equal(
    names.tableNameCollision({ label: 'C', logicalTableName: 'B' }, [
      { label: 'B', logicalTableName: 'D' },
    ]),
    false,
  );
  assert.equal(
    names.tableNameCollision({ label: 'C', logicalTableName: 'B' }, [
      { label: 'C', logicalTableName: 'D' },
    ]),
    true,
  );
  assert.equal(
    names.tableNameCollision({ label: 'C', logicalTableName: 'B' }, [
      { label: 'D', logicalTableName: 'B' },
    ]),
    true,
  );
  assert.equal(
    names.tableNameCollision({ label: 'C', logicalTableName: 'B' }, [{ label: 'B' }]),
    true,
  );
});
