import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReactElement } from 'react';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';

const translation = { useTranslation: () => ({ t: (key: string) => key }) };
type Element = ReactElement<Record<string, unknown>>;
function find(node: unknown, predicate: (element: Element) => boolean): Element {
  if (Array.isArray(node)) {
    for (const child of node) {
      try {
        return find(child, predicate);
      } catch {
        /* 다음 자식을 확인한다. */
      }
    }
  } else if (node && typeof node === 'object' && 'props' in node) {
    const element = node as Element;
    if (predicate(element)) return element;
    return find(element.props.children, predicate);
  }
  throw new Error('대상 요소 없음');
}

for (const status of ['rejected', 'applied']) {
  test(`DDL import ${status}: preserves input on rejection, closes and resets only on success`, () => {
    let closed = 0;
    let reset = 0;
    let success = 0;
    const h = sourceHookHarness('src/components/erd/DdlImportDialog.tsx', {
      'react-i18next': translation,
      'use-diagram-erd-crud-actions': {
        useDiagramErdCrudActions: () => ({ importDdl: () => status }),
      },
      useDdlParse: {
        useDdlParse: () => ({
          ddlText: 'CREATE TABLE a (id INT)',
          parseResult: { tables: [{}], relations: [], errors: [] },
          resetParse: () => reset++,
        }),
      },
      useDarkMode: { useDarkMode: () => false },
      sonner: {
        toast: { success: () => success++, error: () => assert.fail('예상하지 않은 오류') },
      },
    });
    const component = h.exports.default as (props: unknown) => Element;
    const tree = h.render(() => component({ open: true, onOpenChange: () => closed++ }));
    const button = find(
      tree,
      (element) => element.props.disabled === false && typeof element.props.onClick === 'function',
    );
    (button.props.onClick as () => void)();
    assert.equal(success, status === 'applied' ? 1 : 0);
    assert.equal(closed, success);
    assert.equal(reset, success);
  });
}

test('repeated rejected logical-name keystrokes restore the displayed document value', () => {
  let attempts = 0;
  const h = sourceHookHarness('src/components/erd/ColumnAutocomplete.tsx', {
    'react-i18next': translation,
    ErdDictionaryContext: {
      useErdDictionary: () => ({ searchTerms: () => [], resolveLogicalName: () => null }),
    },
    keybindings: { KEYS: {} },
  });
  const component = h.exports.default as (props: unknown) => Element;
  const props = {
    value: '문서값',
    onChange: () => {
      attempts++;
      return 'rejected';
    },
  };
  const render = () => h.render(() => component(props));
  let input = find(render(), (element) => element.type === 'input');
  h.refs[2].current = { value: '거절값' };
  for (let i = 0; i < 3; i++) {
    (input.props.onChange as (event: unknown) => void)({ target: { value: '거절값' } });
    h.flush();
    input = find(render(), (element) => element.type === 'input');
    assert.equal(input.props.value, '문서값');
  }
  assert.equal(attempts, 3);
});

test('inline edit remains open when rejected and closes when applied', () => {
  let status = 'rejected';
  const h = sourceHookHarness('src/hooks/useInlineEdit.ts', {});
  const hook = h.exports.useInlineEdit as (confirm: () => string) => {
    editing: boolean;
    startEdit: (value: string) => void;
    confirmEdit: () => void;
  };
  const render = () => h.render(() => hook(() => status));
  render().startEdit('이름');
  render().confirmEdit();
  assert.equal(render().editing, true);
  status = 'applied';
  render().confirmEdit();
  assert.equal(render().editing, false);
});

test('schema success followed by layout rejection reports partial apply without rolling back', async () => {
  const nodes = [{ id: 'schema-applied', position: { x: 0, y: 0 }, data: { columns: [] } }];
  let schemaApplied = false;
  let partial = 0;
  let success = 0;
  let failure = 0;
  const h = sourceHookHarness('src/hooks/useApplyToErd.ts', {
    'react-i18next': translation,
    useAuthStore: { __esModule: true, default: () => 'user' },
    'use-diagram-erd-apply-actions': {
      useDiagramErdApplyActions: () => ({
        replaceFromDdl: () => {
          schemaApplied = true;
          return 'applied';
        },
      }),
    },
    'use-diagram-erd-apply-runtime': {
      useDiagramErdApplyRuntime: () => ({
        currentNodes: [],
        captureBeforeState: () => ({ nodes: [], edges: [], groups: [], layoutNodes: [] }),
        applyLayout: () => 'rejected',
        getCurrentState: () => ({ nodes, edges: [] }),
      }),
    },
    'auto-layout': { applyErdLayout: async () => ({ status: 'applied', nodes }) },
    'sync-policy': {
      loadSyncPolicy: () => ({ layoutMode: 'full', largeDiagramThreshold: 100 }),
      resolveLayoutMode: () => 'full',
      getAutoApplyBlockReason: () => null,
    },
    'diff-apply-rollout': {
      resolveDiffApplyRollout: () => ({ enabled: false }),
      loadDiffApplyLocalOverride: () => null,
    },
    sonner: {
      toast: { warning: () => partial++, success: () => success++, error: () => failure++ },
    },
  });
  const hook = h.exports.useApplyToErd as (params: unknown) => {
    applyParsedToErd: () => Promise<boolean>;
  };
  const actions = h.render(() =>
    hook({
      canEdit: true,
      parseResult: { tables: [{ name: 'schema-applied', columns: [] }], errors: [] },
      parsing: false,
    }),
  );
  assert.equal(await actions.applyParsedToErd(), true);
  assert.equal(schemaApplied, true);
  assert.equal(partial, 1);
  assert.equal(success, 0);
  assert.equal(failure, 0);
});

test('group picker keeps its selection open on rejection and closes on success', () => {
  let status = 'rejected';
  let closed = 0;
  const h = sourceHookHarness('src/components/erd/GroupTableSelectDialog.tsx', {
    'react-i18next': translation,
    useCanvasStore: { __esModule: true, default: () => [{ id: 'a', data: { label: 'a' } }] },
    'use-diagram-erd-crud-actions': {
      useDiagramErdCrudActions: () => ({ updateGroupTables: () => status }),
    },
  });
  const component = h.exports.default as (props: unknown) => Element;
  const render = () =>
    h.render(() =>
      component({ open: true, groupId: 'g', existingTableIds: [], onOpenChange: () => closed++ }),
    );
  (find(render(), (element) => element.type === 'input').props.onChange as () => void)();
  const confirm = () =>
    (
      find(render(), (element) => element.props.children === 'common.button.confirm').props
        .onClick as () => void
    )();
  confirm();
  assert.equal(closed, 0);
  assert.equal(find(render(), (element) => element.type === 'input').props.checked, true);
  status = 'applied';
  confirm();
  assert.equal(closed, 1);
});

for (const rejection of ['diff', 'replace', 'group']) {
  test(`code apply ${rejection} rejection stops commands without success or fallback retry`, async () => {
    let replacements = 0;
    let groups = 0;
    let layouts = 0;
    let success = 0;
    let failure = 0;
    const h = sourceHookHarness('src/hooks/useApplyToErd.ts', {
      'react-i18next': translation,
      useAuthStore: { __esModule: true, default: () => 'user' },
      'use-diagram-erd-apply-actions': {
        useDiagramErdApplyActions: () => ({
          replaceFromDdl: () => {
            replacements++;
            return rejection === 'replace' ? 'rejected' : 'applied';
          },
          applyDiffPlan: () => null,
          updateGroupTables: () => {
            groups++;
            return 'rejected';
          },
        }),
      },
      'use-diagram-erd-apply-runtime': {
        useDiagramErdApplyRuntime: () => ({
          currentNodes: [],
          captureBeforeState: () => ({ nodes: [], edges: [], groups: [], layoutNodes: [] }),
          getCurrentNodes: () => [],
          getCurrentState: () => {
            layouts++;
            return { nodes: [], edges: [] };
          },
        }),
      },
      'erd-diff-plan': { createCurrentSnapshots: () => ({ tables: [], edgeById: {} }) },
      'erd-scoped-diff-builder': {
        buildScopedDiffPlan: () => {
          if (rejection === 'group') throw new Error('계획 생성 실패');
          return { safe: true, plan: { tables: [] } };
        },
      },
      'erd-fallback-group-remap': {
        buildFallbackGroupAssignments: () => [{ groupId: 'g', tableIds: ['a'], droppedCount: 0 }],
      },
      'sync-policy': { loadSyncPolicy: () => ({}), getAutoApplyBlockReason: () => null },
      'diff-apply-rollout': {
        resolveDiffApplyRollout: () => ({ enabled: rejection !== 'replace' }),
        loadDiffApplyLocalOverride: () => null,
      },
      sonner: { toast: { success: () => success++, error: () => failure++, info: () => {} } },
    });
    const hook = h.exports.useApplyToErd as (params: unknown) => {
      applyParsedToErd: () => Promise<boolean>;
    };
    const actions = h.render(() =>
      hook({
        canEdit: true,
        parsing: false,
        parseResult: { tables: [{ name: 'a', columns: [] }], relations: [], errors: [] },
      }),
    );
    assert.equal(await actions.applyParsedToErd(), false);
    assert.equal(replacements, rejection === 'diff' ? 0 : 1);
    assert.equal(groups, rejection === 'group' ? 1 : 0);
    assert.equal(layouts, 0);
    assert.equal(success, 0);
    assert.equal(failure, 0);
  });
}
