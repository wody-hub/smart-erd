import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OnMount } from '@monaco-editor/react';
import ts from 'typescript';
import * as Y from 'yjs';
import * as sharedSchemaDraft from '../../src/lib/shared-schema-draft.js';
import * as codeModeSharedDraft from '../../src/lib/code-mode-shared-draft.js';
import * as modelHelpers from '../../src/lib/dsl-live-projection-model.js';
import { generateProjection } from '../../src/lib/dsl-block-projection.js';
import type { DiagramCodeProjectionPatch } from '../../src/collaboration/channel/diagram/diagram-code-projection-state.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import { createProjectionMonacoModel } from '../helpers/projection-monaco-model.js';

const panelPath = 'src/components/erd/DslLiveProjectionPanel.tsx';
const runtime = { source: null, ready: false, generation: 0 };
const snapshot = {
  ...generateProjection({
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: [{ id: 'a', data: { label: 'users', columns: [] } }],
  }),
  status: 'ready',
  unsupportedNotices: 0,
};

/** 브라우저 의존성만 대체하고 실제 패널의 JSX와 효과를 실행한다. */
function panelMocks(
  subscribePatches: (listener: (event: DiagramCodeProjectionPatch) => void) => () => void,
) {
  return {
    'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
    ErdDictionaryContext: {
      useErdDictionary: () => ({ terms: [], domains: [], dictionaryRevision: 1 }),
    },
    'use-diagram-code-projection': {
      useDiagramCodeProjection: () => ({
        ...snapshot,
        getSnapshot: () => snapshot,
        subscribePatches,
      }),
    },
    'use-diagram-unapplied-shared-draft': { useDiagramUnappliedSharedDraft: () => false },
    'dsl-live-projection-model': modelHelpers,
    useDarkMode: { useDarkMode: () => false },
  };
}

/** JSX에서 Monaco 호스트를 찾아 실제 마운트 콜백과 옵션을 반환한다. */
function editorProps(tree: React.ReactNode): {
  onMount: OnMount;
  options: { readOnly: boolean; domReadOnly: boolean };
  keepCurrentModel?: boolean;
} {
  if (React.isValidElement<{ onMount?: OnMount; children?: React.ReactNode }>(tree)) {
    if (tree.props.onMount) return tree.props as ReturnType<typeof editorProps>;
    for (const child of React.Children.toArray(tree.props.children)) {
      const found = findEditor(child);
      if (found) return found;
    }
  }
  throw new Error('Projection editor host is missing');
}

/** 자식 요소에서 에디터 호스트를 찾는다. */
function findEditor(tree: React.ReactNode): ReturnType<typeof editorProps> | undefined {
  try {
    return editorProps(tree);
  } catch {
    return undefined;
  }
}

test('panel remount and repeated Monaco onMount release patch subscribers and decorations', async () => {
  const listeners = new Set<(event: DiagramCodeProjectionPatch) => void>();
  for (let mount = 0; mount < 12; mount++) {
    const harness = sourceHookHarness(
      panelPath,
      panelMocks((listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }),
    );
    const panel = harness.exports.default as React.ComponentType<{
      diagramId: string;
      runtime: typeof runtime;
    }>;
    const tree = harness.render(() =>
      (panel as (props: { diagramId: string; runtime: typeof runtime }) => React.ReactNode)({
        diagramId: 'same-diagram',
        runtime,
      }),
    );
    const props = editorProps(tree);
    assert.equal(props.options.readOnly, true);
    assert.equal(props.options.domReadOnly, true);
    // 모델 수명은 @monaco-editor/react가 소유한다. 보존 옵션을 켜면 언마운트 후 모델이 남는다.
    assert.notEqual(props.keepCurrentModel, true);
    harness.runEffects();
    const model = await createProjectionMonacoModel();
    const editor = {
      getModel: () => model,
      createDecorationsCollection: (items: Parameters<typeof model.deltaDecorations>[1]) => {
        let ids = model.deltaDecorations([], items);
        return {
          set: (next: typeof items) => {
            ids = model.deltaDecorations(ids, next);
          },
          clear: () => {
            ids = model.deltaDecorations(ids, []);
          },
        };
      },
    } as unknown as Parameters<OnMount>[0];
    try {
      props.onMount(editor, {} as Parameters<OnMount>[1]);
      const decorations = model.getAllDecorations().length;
      assert.ok(decorations > 0);
      assert.equal(listeners.size, 1);
      props.onMount(editor, {} as Parameters<OnMount>[1]);
      assert.equal(listeners.size, 1);
      assert.equal(model.getAllDecorations().length, decorations);
      harness.cleanup();
      assert.equal(listeners.size, 0);
      assert.equal(model.getAllDecorations().length, 0);
    } finally {
      harness.cleanup();
      model.dispose();
    }
  }
});

test('two panels for the same diagram derive distinct URIs from real React useId', () => {
  const require = createRequire(import.meta.url);
  const mocks = panelMocks(() => () => {});
  const module = {
    exports: {} as { default: React.ComponentType<{ diagramId: string; runtime: typeof runtime }> },
  };
  const js = ts.transpileModule(readFileSync(panelPath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  runInNewContext(js, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (id === 'react' || id === 'react/jsx-runtime') return require(id);
      if (id === '@monaco-editor/react')
        return ({ path }: { path: string }) => React.createElement('div', { 'data-uri': path });
      return (
        mocks[id as keyof typeof mocks] ?? mocks[id.split('/').at(-1)! as keyof typeof mocks] ?? {}
      );
    },
  });
  const html = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(module.exports.default, { diagramId: 'same/diagram', runtime }),
      React.createElement(module.exports.default, { diagramId: 'same/diagram', runtime }),
    ),
  );
  const uris = [...html.matchAll(/data-uri="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(uris.length, 2);
  assert.equal(new Set(uris).size, 2);
  uris.forEach((uri) => assert.match(uri, /^erd-live-projection:\/\/same%2Fdiagram\/.+\.dsl$/));
});

test('shared-draft notice removes its Y.Doc observer after each unmount', () => {
  const doc = new Y.Doc();
  const initial = doc._observers.get('afterTransaction')?.size ?? 0;
  try {
    for (let mount = 0; mount < 20; mount++) {
      const harness = sourceHookHarness(
        'src/collaboration/channel/diagram/use-diagram-unapplied-shared-draft.ts',
        {
          'shared-schema-draft': sharedSchemaDraft,
          'code-mode-shared-draft': codeModeSharedDraft,
        },
      );
      const hook = harness.exports.useDiagramUnappliedSharedDraft as (value: unknown) => boolean;
      harness.render(() =>
        hook({ ready: true, generation: mount, source: { getDocument: () => doc } }),
      );
      harness.runEffects();
      assert.equal(doc._observers.get('afterTransaction')?.size, initial + 1);
      harness.cleanup();
      assert.equal(doc._observers.get('afterTransaction')?.size ?? 0, initial);
    }
  } finally {
    doc.destroy();
  }
});
