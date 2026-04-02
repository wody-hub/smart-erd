import test from 'node:test';
import assert from 'node:assert/strict';
import { YjsSharedDocumentEngine } from '../../src/collaboration/core/engines/yjs-shared-document-engine.js';
import { DiagramCollaborationProviderSession } from '../../src/collaboration/channel/diagram/diagram-collaboration-testable.js';

test('DiagramCollaborationProviderSession cleans up when provider lifecycle setup fails', async () => {
  const callOrder: string[] = [];
  let destroyedDoc = false;
  const fakeLifecycle = {
    async setup() {
      callOrder.push('lifecycle:setup');
      throw new Error('provider-setup-failed');
    },
    dispose() {
      callOrder.push('lifecycle:dispose');
    },
  };

  const session = new DiagramCollaborationProviderSession({
    collaborationBootstrap: {
      hasYdocSnapshot: false,
      content: 'table users',
      contentRevision: '0',
    },
    sharedDocumentEngine: new YjsSharedDocumentEngine(),
    snapshotCodec: {
      snapshotFormatVersion: 1,
      decodeToSnapshot: (persisted) => persisted,
      encodeForPersistence: (snapshot) => snapshot,
    },
    diagramId: 'diagram-1',
    teamId: 'team-1',
    projectId: 'project-1',
    initYDoc: (doc) => {
      callOrder.push('session:init-ydoc');
      destroyedDoc = doc.isDestroyed;
    },
    destroyYDoc: () => {
      callOrder.push('session:destroy-ydoc');
    },
    resetCollaboration: () => {
      callOrder.push('session:reset-collaboration');
    },
    resetRuntimeState: () => {
      callOrder.push('session:reset-runtime-state');
    },
    createProviderLifecycle: ({ diagramId, teamId, projectId, onProviderReady, onProviderDisposed }) => {
      assert.equal(diagramId, 'diagram-1');
      assert.equal(teamId, 'team-1');
      assert.equal(projectId, 'project-1');
      assert.equal(typeof onProviderReady, 'function');
      assert.equal(typeof onProviderDisposed, 'function');
      callOrder.push('session:create-lifecycle');
      return fakeLifecycle as never;
    },
    updatePreviewMode: () => {
      callOrder.push('session:update-preview-mode');
    },
    onProviderReady: (_provider) => {
      callOrder.push('session:provider-ready');
    },
    onProviderDisposed: () => {
      callOrder.push('session:provider-disposed');
    },
  });

  await assert.rejects(() => session.setup(), /provider-setup-failed/);
  session.dispose();

  assert.equal(destroyedDoc, false);
  assert.deepEqual(callOrder, [
    'session:init-ydoc',
    'session:create-lifecycle',
    'lifecycle:setup',
    'lifecycle:dispose',
    'session:reset-runtime-state',
    'session:destroy-ydoc',
    'session:reset-collaboration',
  ]);
});
