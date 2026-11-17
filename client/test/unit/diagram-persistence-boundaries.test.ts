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
