import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import * as Y from 'yjs';
import { DocumentStore } from '../../src/collaboration/core/store/document-store.js';
import { DocumentRevisionTracker } from '../../src/collaboration/core/store/document-revision-tracker.js';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { ErdDocumentMutationApplier } from '../../src/collaboration/plugins/erd/erd-document-mutation-applier.js';
import {
  ErdDocumentPlugin,
  isErdCanvasInputAdapter,
} from '../../src/collaboration/plugins/erd/erd-document-plugin.js';
import { ErdDocumentReadContextFactory } from '../../src/collaboration/plugins/erd/query/erd-document-read-context-factory.js';
import { collectErdAffectedScopes } from '../../src/collaboration/plugins/erd/erd-yjs-update-scope-collector.js';
import {
  ErdCodeProjectionPort,
  type TextPatchBatch,
} from '../../src/collaboration/plugins/erd/erd-code-projection-port.js';
import {
  createDiagramDocumentMutationSession,
  isDiagramDocumentReady,
} from '../../src/collaboration/channel/diagram/diagram-document-mutation-session.js';
import {
  useDiagramErdCodeBlockActions,
  type DiagramErdCodeBlockActions,
} from '../../src/collaboration/channel/diagram/use-diagram-erd-code-block-actions.js';
import { DocumentMutationSessionContext } from '../../src/collaboration/core/session/document-mutation-session.js';
import { createTableYMap, getTablesMap } from '../../src/collaboration/yjsBridge.js';
import { getColumnYMap } from '../../src/collaboration/yjs-columns.js';
import type {
  CodeBlockCommit,
  CodeBlockCommitResult,
} from '../../src/lib/code-block-commit-contract.js';
import { CANVAS_HISTORY_ORIGIN } from '../../src/constants/canvas-history.js';
import { getCodeBlockDictionaryFingerprint } from '../../src/collaboration/plugins/erd/erd-code-block-commit.js';

/** 실제 dispatch와 투영을 하나의 문서에 연결한다. */
function harness() {
  const doc = new Y.Doc();
  getTablesMap(doc).set(
    'a',
    createTableYMap('users', { x: 0, y: 0 }, [{ id: 'id', name: 'id', type: 'INT' }]),
  );
  const engine = new YjsSharedDocumentEngine(doc);
  const revisions = new DocumentRevisionTracker();
  const applier = new ErdDocumentMutationApplier(engine);
  const store = new DocumentStore(
    applier,
    revisions,
    new ErdDocumentReadContextFactory(engine, revisions),
    () => engine.exportSnapshot(),
    (update) => collectErdAffectedScopes(engine, update),
  );
  store.attach();
  const unsubscribe = engine.subscribeUpdates((update) => revisions.handleDocumentUpdated(update));
  const plugin = new ErdDocumentPlugin();
  const adapters = plugin.createInputAdapters({ read: store });
  const adapter = adapters.canvas;
  assert.ok(isErdCanvasInputAdapter(adapter));
  const policy = plugin.createMutationPolicy({ read: store });
  let ready = true;
  const session = createDiagramDocumentMutationSession(
    store,
    policy,
    adapters,
    () => ready,
    () => {},
  );
  const port = new ErdCodeProjectionPort({
    read: store,
    getDocument: () => doc,
    dictionary: { version: 1, fingerprint: 'empty', dictionary: { terms: [], domains: [] } },
  });
  const batches: TextPatchBatch[] = [];
  port.subscribe((batch) => batches.push(batch));
  port.hydrate();
  const commit: CodeBlockCommit = {
    kind: 'code-block-v1',
    commitId: 'local-commit',
    tableId: 'a',
    dictionaryFingerprint: 'empty',
    patches: [
      { target: 'table', tableId: 'a', field: 'label', baseValue: 'users', nextValue: 'people' },
    ],
  };
  return {
    doc,
    store,
    port,
    batches,
    commit,
    session,
    adapter,
    policy,
    ready: (value: boolean) => {
      ready = value;
    },
    dispose: () => {
      port.dispose();
      unsubscribe();
      store.dispose();
      doc.destroy();
    },
  };
}

/** React 공개 훅에서 사용자와 같은 액션을 얻는다. */
async function getActions(session: ReturnType<typeof harness>['session'] | null) {
  const i18n = createInstance();
  await i18n.init({ lng: 'ko', showSupportNotice: false, resources: { ko: { translation: {} } } });
  let actions!: DiagramErdCodeBlockActions;
  /** 훅의 공개 계약을 실제로 호출한다. */
  function Probe() {
    actions = useDiagramErdCodeBlockActions();
    return null;
  }
  renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        DocumentMutationSessionContext.Provider,
        { value: session },
        createElement(Probe),
      ),
    ),
  );
  return actions;
}

test('plugin resolves only table/column scopes and dispatch returns exact rejection details', () => {
  const h = harness();
  h.commit.patches.push({
    target: 'column',
    tableId: 'a',
    columnId: 'id',
    field: 'name',
    baseValue: 'id',
    nextValue: 'user_id',
  });
  const command = h.adapter.commitCodeBlock(h.commit);
  const mutation = h.policy.toMutation(command, { origin: { source: 'local' } });
  assert.equal(command.key, 'code-block:commit');
  assert.deepEqual(
    mutation.affectedScopes.map((scope) => scope.kind),
    ['table', 'column'],
  );
  assert.equal(mutation.affectedScopes[0].id, 'a');
  assert.equal(
    mutation.affectedScopes.some((scope) => scope.kind === 'edge'),
    false,
  );
  getTablesMap(h.doc).get('a')!.set('label', 'remote');
  const before = Y.encodeStateAsUpdate(h.doc);
  const result = h.session.emitCommandWithResult<CodeBlockCommitResult>(command);
  assert.equal(result.status, 'rejected');
  assert.deepEqual(result.value, {
    status: 'rejected',
    commitId: 'local-commit',
    reason: 'conflict',
    conflicts: [{ patchIndex: 0, baseValue: 'users', currentValue: 'remote', nextValue: 'people' }],
  });
  assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
  h.dispose();
});

test('mixed local echo and foreign change batch retains commit IDs, origins and both values', () => {
  const h = harness();
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(h.doc));
  assert.equal(
    h.session.emitCommandWithResult(h.adapter.commitCodeBlock(h.commit)).status,
    'applied',
  );
  getColumnYMap(getTablesMap(peer).get('a')!, 'id')!.set('logicalName', '원격 번호');
  Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(peer), 'remote');
  const batch = h.port.flush()!;
  assert.deepEqual(batch.commitIds, ['local-commit']);
  assert.deepEqual(batch.transactionOrigins, [CANVAS_HISTORY_ORIGIN.USER_CODE_COMMIT, 'remote']);
  assert.equal(h.batches.length, 2);
  assert.match(batch.blockMetadata[0].text, /people/);
  assert.match(batch.blockMetadata[0].text, /원격 번호/);
  // 직후 별도 배치에는 이전 커밋 ID가 남지 않는다.
  getTablesMap(h.doc).get('a')!.set('logicalTableName', '다음 변경');
  assert.deepEqual(h.port.flush()!.commitIds, []);
  peer.destroy();
  h.dispose();
});

test('multiple local commits coalesce without losing any echo ID', () => {
  const h = harness();
  h.session.emitCommand(h.adapter.commitCodeBlock(h.commit));
  h.session.emitCommand(
    h.adapter.commitCodeBlock({
      ...h.commit,
      commitId: 'second',
      patches: [{ ...h.commit.patches[0], baseValue: 'people', nextValue: 'persons' }],
    }),
  );
  assert.deepEqual(h.port.flush()!.commitIds, ['local-commit', 'second']);
  h.dispose();
});

test('dictionary fingerprint is checked at dispatch and a disposed port cannot authorize stale commits', () => {
  const h = harness();
  h.port.setDictionary({
    version: 2,
    fingerprint: 'changed',
    dictionary: { terms: [], domains: [] },
  });
  const before = Y.encodeStateAsUpdate(h.doc);
  assert.deepEqual(h.session.emitCommandWithResult(h.adapter.commitCodeBlock(h.commit)).value, {
    status: 'rejected',
    commitId: 'local-commit',
    reason: 'dictionary-changed',
  });
  assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
  h.port.dispose();
  assert.equal(getCodeBlockDictionaryFingerprint(h.doc), undefined);
  h.dispose();
});

for (const mode of ['hydrating', 'disconnected', 'viewer', 'no-session']) {
  test(`${mode} rejects with zero writes and the existing deduped toast ID`, async (t) => {
    const h = harness();
    const actions = await getActions(mode === 'no-session' ? null : h.session);
    h.ready(
      isDiagramDocumentReady({
        localOnly: false,
        canEdit: mode !== 'viewer',
        hydrated: mode !== 'hydrating',
        synced: true,
        connectionStatus: mode === 'disconnected' ? 'disconnected' : 'connected',
      }),
    );
    const warning = t.mock.method(toast, 'warning', () => 'warning');
    const before = Y.encodeStateAsUpdate(h.doc);
    for (let index = 0; index < 2; index++)
      assert.deepEqual(actions.commitCodeBlock(h.commit), {
        status: 'rejected',
        commitId: 'local-commit',
        reason: 'not-ready',
      });
    assert.deepEqual(Y.encodeStateAsUpdate(h.doc), before);
    assert.equal(warning.mock.callCount(), 2);
    for (const call of warning.mock.calls)
      assert.equal(call.arguments[1]?.id, 'diagram-command-rejected');
    h.dispose();
  });
}

test('public action returns applied metadata and conflict list without a generic rejection toast', async (t) => {
  const h = harness();
  const actions = await getActions(h.session);
  const warning = t.mock.method(toast, 'warning', () => 'warning');
  assert.deepEqual(actions.commitCodeBlock(h.commit), {
    status: 'applied',
    commitId: 'local-commit',
    changedFields: 1,
    noop: false,
  });
  assert.equal(
    actions.commitCodeBlock({
      ...h.commit,
      patches: [{ ...h.commit.patches[0], nextValue: 'different' }],
    }).status,
    'rejected',
  );
  assert.equal(warning.mock.callCount(), 0);
  h.dispose();
});
