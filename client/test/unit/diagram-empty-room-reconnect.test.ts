import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import * as ws from '../../src/constants/ws.js';
import { isDiagramDocumentReady } from '../../src/collaboration/channel/diagram/diagram-document-mutation-session.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';

type Lifecycle = {
  onProviderReady: (provider: unknown) => void;
  onConnectionStatusChange: (status: string) => void;
  onSyncStateChange: (synced: boolean) => void;
  onSyncRetry: (attempt: number) => void;
};
for (const room of ['empty', 'snapshot-null-content', 'populated']) {
  test(`${room}: real provider retries initialize only an empty room per connection without SYNC_STEP2`, async () => {
    const doc = new Y.Doc();
    let connectionStatus = 'disconnected';
    let ready = () => false;
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      readyState = 0;
      onopen = () => {};
      onclose = (_event: unknown) => {};
      sent: Uint8Array[] = [];
      constructor() {
        sockets.push(this);
      }
      send(bytes: Uint8Array) {
        this.sent.push(bytes);
      }
      close() {
        this.readyState = 3;
        this.onclose({ code: 1000, reason: '' });
      }
      open() {
        this.readyState = 1;
        this.onopen();
      }
    }
    const ph = sourceHookHarness(
      'src/collaboration/YjsProvider.ts',
      {
        yjs: Y,
        ws,
        platform: { getWsBaseUrl: () => 'ws://local' },
      },
      { WebSocket: FakeSocket, TextEncoder },
    );
    const Provider = ph.exports.YjsProvider as new (...args: unknown[]) => {
      connect: () => void;
      destroy: () => void;
      isSynced: () => boolean;
      onConnectionStatusChange: unknown;
      onSyncStateChange: unknown;
      onSyncRetry: unknown;
    };
    const h = sourceHookHarness(
      'src/collaboration/channel/diagram/use-diagram-collaboration-runtime.ts',
      {
        useCollaborationStore: {
          __esModule: true,
          default: Object.assign(() => connectionStatus, {
            getState: () => ({ connectionStatus }),
          }),
        },
        useCanvasStore: { __esModule: true, default: () => () => {} },
        'diagram-document-mutation-session': { isDiagramDocumentReady },
        'use-diagram-collaboration-store-bridge': {
          useDiagramCollaborationStoreBridge: () => ({}),
        },
        'use-diagram-runtime-bootstrap': {
          useDiagramRuntimeBootstrap: () => ({
            collaborationBootstrap: {
              hasYdocSnapshot: room === 'snapshot-null-content',
              content: room === 'populated' ? '{}' : null,
              contentRevision: '1',
            },
            previewEnabled: room === 'populated',
            sharedDocumentEngine: { exportSnapshot: () => Y.encodeStateAsUpdate(doc) },
            snapshotCodec: {},
            contentOnlySnapshotSeeder: {},
          }),
        },
        'use-collaboration-session': { useCollaborationSession: () => ({ runtimeState: 'live' }) },
        'collaboration-preview-sync-status': { toPreviewSyncStatus: () => 'live' },
        'use-diagram-document-runtime': {
          useDiagramDocumentRuntime: (params: { isCommandReady: () => boolean }) => {
            ready = params.isCommandReady;
            return {};
          },
        },
        'create-diagram-collaboration-provider-lifecycle': {
          createDiagramCollaborationProviderLifecycle: (options: unknown) => options,
        },
      },
    );
    const hook = h.exports.useDiagramCollaborationRuntime as (...args: unknown[]) => {
      createProviderLifecycle: (params: unknown) => Lifecycle;
      getHydratedSnapshot: () => Uint8Array | null;
      getHydratedContentRevision: () => string | null;
      getRemoteHydrationGeneration: () => number;
    };
    const runtime = h.render(() => hook(undefined, undefined, 0, true));
    const lifecycle = runtime.createProviderLifecycle({
      diagramId: 'd',
      onProviderReady: () => {},
      onProviderDisposed: () => {},
    });
    const provider = new Provider(doc, {
      diagramId: 'd',
      getTicket: async () => ({ ticket: '', userId: 'u' }),
    });
    provider.onConnectionStatusChange = (status: string) => {
      connectionStatus = status;
      lifecycle.onConnectionStatusChange(status);
    };
    provider.onSyncStateChange = lifecycle.onSyncStateChange;
    provider.onSyncRetry = (attempt: number) => lifecycle.onSyncRetry(attempt);
    lifecycle.onProviderReady(provider);
    provider.connect();
    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[0].open();
    assert.equal(ready(), room === 'empty', '새 빈 다이어그램 첫 입장은 편집 가능하다');
    sockets[0].close();
    ph.flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[1].open();
    assert.equal(ready(), false);
    ph.flush();
    assert.equal(ready(), false, '첫 재시도만으로 초기화하지 않는다');
    ph.flush();
    assert.equal(ready(), room === 'empty');
    assert.equal(provider.isSynced(), false, '빈 방 추정은 실제 sync가 아니다');
    assert.equal(runtime.getHydratedSnapshot(), null, '빈 추정 문서는 저장 기준이 아니다');
    assert.equal(doc.store.clients.size, 0, '추정으로 내용을 시딩하지 않는다');
    assert.equal(
      sockets[1].sent.filter((bytes) => bytes[0] === ws.WS_MSG_TYPE.SYNC_STEP1).length,
      3,
    );
    sockets[1].close();
    ph.flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[2].open();
    ph.flush();
    assert.equal(ready(), false, '다음 세대도 두 번의 재시도가 필요하다');
    assert.equal(
      runtime.getRemoteHydrationGeneration(),
      0,
      '추정으로 원격 수화 세대를 올리지 않는다',
    );
    if (room === 'empty') {
      ph.flush();
      assert.equal(ready(), true);
      doc.getMap('tables').set('first-local-edit', 'a');
      assert.ok(
        runtime.getHydratedSnapshot(),
        '첫 로컬 편집 이후에는 빈 초기 기준으로 변경을 저장할 수 있다',
      );
      assert.equal(runtime.getHydratedContentRevision(), '1');
    }
    provider.destroy();
    doc.destroy();
  });
}
