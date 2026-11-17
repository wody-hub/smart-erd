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
  onEmptyDocumentInitialized: () => void;
  updatePreviewMode: (preview: boolean) => void;
};
for (const room of ['empty', 'snapshot-null-content', 'populated']) {
  test(`${room}: explicit server confirmation initializes only an empty room per connection`, async () => {
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
      onmessage = (_event: { data: ArrayBuffer }) => {};
      sent: Uint8Array[] = [];
      constructor(readonly url: string) {
        sockets.push(this);
      }
      send(bytes: Uint8Array) {
        this.sent.push(bytes);
      }
      close() {
        this.readyState = 3;
        this.onclose({ code: 1000, reason: '' });
      }
      receive(bytes: Uint8Array) {
        this.onmessage({ data: bytes.buffer as ArrayBuffer });
      }
      open() {
        this.readyState = 1;
        this.onopen();
      }
    }
    const clock = testClock();
    const ph = sourceHookHarness(
      'src/collaboration/YjsProvider.ts',
      {
        yjs: Y,
        ws,
        platform: { getWsBaseUrl: () => 'ws://local' },
      },
      { WebSocket: FakeSocket, TextEncoder, ArrayBuffer, ...clock.globals },
    );
    const Provider = ph.exports.YjsProvider as new (...args: unknown[]) => {
      connect: () => void;
      destroy: () => void;
      isSynced: () => boolean;
      onConnectionStatusChange: unknown;
      onSyncStateChange: unknown;
      onEmptyDocumentInitialized: unknown;
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
      updatePreviewMode: () => {},
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
    provider.onEmptyDocumentInitialized = lifecycle.onEmptyDocumentInitialized;
    lifecycle.onProviderReady(provider);
    provider.connect();
    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[0].open();
    assert.equal(ready(), false, '첫 연결도 서버 확인 전에는 편집할 수 없다');
    clock.advance(5_000);
    assert.equal(ready(), false, '5초 동안 확인이 없으면 계속 편집을 차단한다');
    assert.match(sockets[0].url, /protocolVersion=3/);
    sockets[0].receive(new Uint8Array([0x0f]));
    assert.equal(ready(), room === 'empty');
    assert.equal(provider.isSynced(), false, '빈 문서 확인은 실제 sync가 아니다');
    assert.equal(runtime.getHydratedSnapshot(), null, '빈 문서는 저장 기준이 아니다');
    assert.equal(doc.store.clients.size, 0, '확인 응답으로 내용을 시딩하지 않는다');
    sockets[0].close();
    clock.advance(1_000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    sockets[1].open();
    sockets[0].receive(new Uint8Array([0x0f]));
    sockets[0].receive(new Uint8Array([ws.WS_MSG_TYPE.SYNC_STEP2, 0, 0]));
    sockets[0].onclose({ code: 1000, reason: '' });
    assert.equal(ready(), false, '이전 연결의 지연 확인과 sync는 새 세대를 초기화하지 않는다');
    assert.equal(provider.isSynced(), false);
    clock.advance(5_000);
    assert.equal(ready(), false, '재연결도 시간 경과만으로 초기화하지 않는다');
    sockets[1].receive(new Uint8Array([0x0f]));
    assert.equal(ready(), room === 'empty', '재연결에는 새 서버 확인이 필요하다');
    assert.equal(runtime.getRemoteHydrationGeneration(), 0, '빈 확인은 원격 수화가 아니다');
    if (room === 'empty') {
      doc.getMap('tables').set('first-local-edit', 'a');
      assert.ok(runtime.getHydratedSnapshot(), '첫 편집 이후에는 빈 초기 기준으로 저장한다');
      assert.equal(runtime.getHydratedContentRevision(), '1');
    } else {
      sockets[1].receive(new Uint8Array([ws.WS_MSG_TYPE.SYNC_STEP2, 0, 0]));
      assert.equal(provider.isSynced(), true);
      assert.equal(ready(), room === 'snapshot-null-content');
      lifecycle.updatePreviewMode(false);
      assert.equal(ready(), true, '실제 sync와 preview 해제 후 편집할 수 있다');
      assert.equal(runtime.getRemoteHydrationGeneration(), 1);
    }
    provider.destroy();
    doc.destroy();
  });
}

/**
 * 지정한 시간만큼 provider 타이머를 실행하는 테스트 시계를 만든다.
 *
 * @returns 타이머 전역 함수와 시간 진행 함수
 */
function testClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    globals: {
      setTimeout: (run: () => void, delay: number) => {
        timers.set(++nextId, { at: now + delay, run });
        return nextId;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
    advance: (ms: number) => {
      const target = now + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].run();
      }
      now = target;
    },
  };
}
