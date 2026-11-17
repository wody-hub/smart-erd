import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';

for (const trigger of ['pagehide', 'hidden', 'cleanup']) {
  for (const blocked of ['not-ready', 'empty', 'unchanged']) {
    test(`${trigger}: ${blocked} snapshot never saves; pending work survives`, () => {
      const doc = new Y.Doc();
      if (blocked !== 'empty') doc.getMap('tables').set('a', 'hydrated');
      let ready = blocked !== 'not-ready';
      const baseline = Y.encodeStateAsUpdate(doc);
      if (blocked === 'not-ready') doc.getMap('tables').set('b', 'pending');
      let saves = 0;
      const api = {
        persistDiagramYdocSnapshotKeepalive: () => {
          saves++;
          return true;
        },
      };
      const sh = sourceHookHarness(
        'src/collaboration/channel/diagram/diagram-document-persistence-session.ts',
        { diagramApi: api },
        { TextDecoder },
      );
      const Session = sh.exports.DiagramDocumentPersistenceSession as new (
        params: unknown,
      ) => unknown;
      const session = new Session({
        isReady: () => ready,
        getHydratedSnapshot: () => baseline,
        getHydratedContentRevision: () => '1',
        getRemoteHydrationGeneration: () => 1,
        checkpointReader: { getLatestCheckpoint: () => ({ snapshot: Y.encodeStateAsUpdate(doc) }) },
      });
      const events = new EventTarget();
      const documentEvents = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
      const h = sourceHookHarness(
        'src/collaboration/channel/diagram/use-diagram-code-mode-snapshot-persist.ts',
        {
          'code-mode-snapshot-persist': { shouldScheduleCodeModeSnapshotPersist: () => true },
          'code-mode-snapshot-keepalive': {
            beginCodeModeSnapshotKeepalive: () => ({ shouldSend: true }),
          },
        },
        {
          document: documentEvents,
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
        },
      );
      const hook = h.exports.useDiagramCodeModeSnapshotPersist as (params: unknown) => {
        flushSnapshotKeepaliveNow: () => void;
      };
      const actions = h.render(() =>
        hook({
          enabled: true,
          ydoc: doc,
          diagramContentRevision: '1',
          diagramPersistenceSession: session,
        }),
      );
      h.runEffects();
      if (trigger === 'pagehide') events.dispatchEvent(new Event('pagehide'));
      if (trigger === 'hidden') documentEvents.dispatchEvent(new Event('visibilitychange'));
      if (trigger === 'cleanup') actions.flushSnapshotKeepaliveNow();
      assert.equal(saves, 0);
      if (blocked === 'not-ready') {
        ready = true;
        actions.flushSnapshotKeepaliveNow();
        assert.equal(saves, 1);
      }
      h.cleanup();
      doc.destroy();
    });
  }
}

test('backup rechecks readiness at dispatch and preserves a blocked backup', async () => {
  let ready = true;
  let saves = 0;
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/diagram-document-persistence-session.ts',
    {
      diagramApi: {
        saveDiagram: async () => {
          saves++;
          return {};
        },
      },
      hash: { djb2: () => 'hash' },
    },
    { TextDecoder },
  );
  const Session = h.exports.DiagramDocumentPersistenceSession as new (params: unknown) => {
    preparePublishedBackup: () => unknown;
    savePublishedBackup: (backup: unknown) => Promise<unknown>;
  };
  const doc = new Y.Doc();
  const baseline = Y.encodeStateAsUpdate(doc);
  doc.getMap('tables').set('a', 'local');
  const session = new Session({
    isReady: () => ready,
    getHydratedSnapshot: () => baseline,
    getHydratedContentRevision: () => '1',
    getRemoteHydrationGeneration: () => 1,
    checkpointReader: {
      getLatestCheckpoint: () => ({
        snapshot: Y.encodeStateAsUpdate(doc),
        compatibilityArtifact: new TextEncoder().encode('{}'),
      }),
    },
  });
  const backup = session.preparePublishedBackup();
  assert.ok(backup);
  ready = false;
  await assert.rejects(session.savePublishedBackup(backup));
  assert.equal(saves, 0);
  ready = true;
  assert.ok(session.preparePublishedBackup());
  doc.destroy();
});

test('unready published save returns false without claiming finalization succeeded', async () => {
  let saves = 0;
  const h = sourceHookHarness('src/collaboration/channel/diagram/use-diagram-published-save.ts', {
    'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
    '@tanstack/react-query': {
      useMutation: () => ({ isPending: false }),
      useQueryClient: () => ({}),
    },
  });
  const hook = h.exports.useDiagramPublishedSave as (params: unknown) => {
    persistPublishedDiagramNow: () => Promise<boolean>;
  };
  const actions = h.render(() =>
    hook({
      diagramPersistenceSession: {
        ready: false,
        preparePublishedBackup: () => {
          saves++;
          return null;
        },
      },
    }),
  );
  assert.equal(await actions.persistPublishedDiagramNow(), false);
  assert.equal(saves, 0);
});

test('scheduled full-state compaction checks persistence eligibility at dispatch', () => {
  const doc = new Y.Doc();
  doc.getMap('tables').set('large', 'x'.repeat(40_000));
  let ready = true;
  let saves = 0;
  const providerRef = { current: { doc, isSynced: () => true, requestCompaction: () => saves++ } };
  const state = {
    presenceMode: 'active',
    participantsByUserId: new Map([['self', {}]]),
    remoteCursors: new Map(),
  };
  const h = sourceHookHarness('src/hooks/useSnapshotCompaction.ts', {
    yjs: Y,
    useCollaborationStore: {
      __esModule: true,
      default: Object.assign((select: (state: unknown) => unknown) => select(state), {
        getState: () => state,
      }),
    },
  });
  const hook = h.exports.useSnapshotCompaction as (...args: unknown[]) => void;
  h.render(() => hook(providerRef, 'd', () => ready));
  h.runEffects();
  ready = false;
  h.flush();
  assert.equal(saves, 0);
  ready = true;
  h.render(() => hook(providerRef, 'd', () => ready));
  h.runEffects();
  h.flush();
  assert.equal(saves, 1);
  h.cleanup();
  doc.destroy();
});

test('SPA provider disposal flushes pending draft and starts snapshot save before readiness is cleared', async () => {
  const { DiagramCollaborationProviderSession, DiagramCollaborationProviderConnection } =
    await import('../../src/collaboration/channel/diagram/diagram-collaboration-testable.js');
  const { DiagramCollaborationProviderLifecycle } =
    await import('../../src/collaboration/channel/diagram/diagram-collaboration-provider-lifecycle.js');
  const { YjsSharedDocumentEngine } =
    await import('../../src/collaboration/core/engines/yjs-shared-document-engine.js');
  const doc = new Y.Doc();
  const engine = new YjsSharedDocumentEngine(doc);
  const baseline = Y.encodeStateAsUpdate(doc);
  let ready = true;
  const order: string[] = [];
  let saved: Uint8Array | null = null;
  const sh = sourceHookHarness(
    'src/collaboration/channel/diagram/diagram-document-persistence-session.ts',
    {
      diagramApi: {
        persistDiagramYdocSnapshotKeepalive: (...args: unknown[]) => {
          order.push('save-start');
          saved = args[4] as Uint8Array;
          return true;
        },
      },
    },
  );
  const Session = sh.exports.DiagramDocumentPersistenceSession as new (params: unknown) => unknown;
  const persistence = new Session({
    isReady: () => ready,
    getHydratedSnapshot: () => baseline,
    getHydratedContentRevision: () => '1',
    getRemoteHydrationGeneration: () => 1,
    checkpointReader: { getLatestCheckpoint: () => ({ snapshot: Y.encodeStateAsUpdate(doc) }) },
  });
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-code-mode-snapshot-persist.ts',
    {
      'code-mode-snapshot-keepalive': {
        beginCodeModeSnapshotKeepalive: () => ({ shouldSend: true }),
      },
    },
  );
  const hook = h.exports.useDiagramCodeModeSnapshotPersist as (params: unknown) => {
    flushSnapshotKeepaliveNow: () => void;
    registerBeforeSnapshotPersist: (fn: () => void) => void;
  };
  const actions = h.render(() =>
    hook({
      enabled: true,
      ydoc: doc,
      diagramContentRevision: '1',
      diagramPersistenceSession: persistence,
    }),
  );
  actions.registerBeforeSnapshotPersist(() => {
    assert.equal(ready, true);
    order.push('draft-flush');
    doc.getMap('draft').set('text', 'pending');
  });
  const bootstrap = { hasYdocSnapshot: false, content: null, contentRevision: '1' };
  const codec = {
    snapshotFormatVersion: 1,
    decodeToSnapshot: (s: Uint8Array) => s,
    encodeForPersistence: (s: Uint8Array) => s,
  };
  const provider = new DiagramCollaborationProviderSession({
    collaborationBootstrap: bootstrap,
    sharedDocumentEngine: engine,
    snapshotCodec: codec,
    diagramId: 'd',
    teamId: 't',
    projectId: 'p',
    initYDoc: () => {},
    destroyYDoc: () => {
      order.push('doc-destroy');
      doc.destroy();
    },
    resetCollaboration: () => {},
    resetRuntimeState: () => {},
    updatePreviewMode: () => {},
    onProviderReady: () => {},
    onProviderDisposed: () => {
      ready = false;
      order.push('disposed');
    },
    beforeDestroyYDoc: actions.flushSnapshotKeepaliveNow,
    createProviderLifecycle: (options) =>
      new DiagramCollaborationProviderLifecycle(
        {
          ...options,
          bootstrap,
          handoffStartedAt: 0,
          handoffLogPrefix: '',
        },
        {
          contentOnlySnapshotSeeder: { seed: async () => 'skipped' } as never,
          previewHydrationController: { start: () => {}, dispose: () => {} } as never,
          providerConnection: new DiagramCollaborationProviderConnection(options, {
            transport: { websocketPath: () => '', issueTicket: async () => ({}) },
            providerBinding: { bind: () => {}, dispose: () => {} },
            providerEvents: { markTicketRequested: () => {}, logTicketIssued: () => {} },
            createProvider: () => ({
              connect: () => {},
              destroy: () => {
                order.push('provider-destroy');
              },
            }),
          }),
        },
      ),
  });
  await provider.setup();
  provider.dispose();
  provider.dispose();
  assert.deepEqual(order, [
    'draft-flush',
    'save-start',
    'provider-destroy',
    'disposed',
    'doc-destroy',
  ]);
  assert.ok(saved);
  const restored = new Y.Doc();
  Y.applyUpdate(restored, saved);
  assert.equal(restored.getMap('draft').get('text'), 'pending');
  restored.destroy();
});

test('409 refreshes revision but pagehide sends no stale snapshot until real remote rehydration', async () => {
  const doc = new Y.Doc();
  let baseline = Y.encodeStateAsUpdate(doc);
  let generation = 1;
  let hydratedRevision = '1';
  let requests = 0;
  let keepalives = 0;
  const conflict = { isAxiosError: true, response: { status: 409 } };
  const sh = sourceHookHarness(
    'src/collaboration/channel/diagram/diagram-document-persistence-session.ts',
    {
      axios: { isAxiosError: (error: unknown) => error === conflict },
      diagramApi: {
        persistDiagramYdocSnapshot: async () => {
          requests++;
          throw conflict;
        },
        fetchDiagram: async () => ({ contentRevision: '2' }),
        persistDiagramYdocSnapshotKeepalive: () => {
          keepalives++;
          return true;
        },
      },
    },
  );
  const Session = sh.exports.DiagramDocumentPersistenceSession as new (params: unknown) => {
    persistSnapshotWithConflictRetry: (revision: string) => Promise<{ refreshedDiagram: unknown }>;
    persistSnapshotKeepalive: (revision: string) => boolean;
    getLatestCheckpoint: () => unknown;
  };
  const session = new Session({
    isReady: () => true,
    getHydratedSnapshot: () => baseline,
    getHydratedContentRevision: () => hydratedRevision,
    getRemoteHydrationGeneration: () => generation,
    checkpointReader: { getLatestCheckpoint: () => ({ snapshot: Y.encodeStateAsUpdate(doc) }) },
  });
  doc.getMap('tables').set('local', 'stale');
  const result = await session.persistSnapshotWithConflictRetry('1');
  assert.equal((result.refreshedDiagram as { contentRevision: string }).contentRevision, '2');
  assert.equal(requests, 1);
  const events = new EventTarget();
  const documentEvents = Object.assign(new EventTarget(), { visibilityState: 'hidden' });
  const h = sourceHookHarness(
    'src/collaboration/channel/diagram/use-diagram-code-mode-snapshot-persist.ts',
    {
      'code-mode-snapshot-keepalive': {
        beginCodeModeSnapshotKeepalive: () => ({ shouldSend: true }),
      },
    },
    {
      document: documentEvents,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    },
  );
  const hook = h.exports.useDiagramCodeModeSnapshotPersist as (params: unknown) => void;
  h.render(() =>
    hook({
      enabled: true,
      ydoc: doc,
      diagramContentRevision: '2',
      diagramPersistenceSession: session,
    }),
  );
  h.runEffects();
  events.dispatchEvent(new Event('pagehide'));
  assert.equal(keepalives, 0);
  assert.equal(
    session.getLatestCheckpoint(),
    null,
    '명시적 백업과 compaction도 충돌 중에는 차단한다',
  );
  assert.equal(session.persistSnapshotKeepalive('2'), false);
  // HTTP revision 갱신이나 빈 방 추정은 원격 수화 세대를 바꾸지 않는다.
  hydratedRevision = '2';
  assert.equal(session.persistSnapshotKeepalive('2'), false);
  baseline = Y.encodeStateAsUpdate(doc);
  generation++;
  doc.getMap('tables').set('after-sync', 'new');
  assert.equal(
    session.persistSnapshotKeepalive('1'),
    false,
    '이전 revision 체크포인트는 재사용하지 않는다',
  );
  assert.equal(session.persistSnapshotKeepalive('2'), true);
  assert.equal(keepalives, 1);
  h.cleanup();
  doc.destroy();
});
