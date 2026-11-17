import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosError } from 'axios';
import { ClientProtocolGate } from '../../src/lib/collaboration-protocol.js';
import { installProtocolInterceptors } from '../../src/api/collaborationProtocol.js';
import { mapCloseEventToConnectionIssue } from '../../src/collaboration/YjsProvider.js';

test('protocol header is attached and 426 blocks future content writes without retrying or blocking reads', async () => {
  const gate = new ClientProtocolGate();
  const client = axios.create();
  installProtocolInterceptors(client, gate);
  let calls = 0;
  let notices = 0;
  gate.subscribe(() => notices++);
  client.defaults.adapter = async (config) => {
    calls++;
    assert.equal(config.headers.get('X-Smart-Erd-Client-Protocol'), '3');
    if (config.method === 'put') {
      throw new AxiosError('upgrade', 'ERR_BAD_RESPONSE', config, undefined, {
        data: { error: 'Reload' },
        status: 426,
        statusText: 'Upgrade Required',
        headers: {},
        config,
      });
    }
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await assert.rejects(client.put('/teams/1/projects/2/diagrams/3', {}));
  assert.equal(gate.isBlocked(), true);
  await assert.rejects(client.post('/teams/1/projects/2/diagrams/3/ydoc-snapshot', {}));
  await assert.rejects(client.post('/ws-ticket', {}));
  assert.equal(calls, 1);
  await client.get('/teams/1/projects/2/diagrams/3');
  assert.equal(calls, 2);
  gate.block();
  assert.equal(notices, 1);
});

test('protocol policy close is distinct and other policy outcomes remain compatible', () => {
  assert.equal(mapCloseEventToConnectionIssue(1008, 'protocol-too-old'), 'protocol-too-old');
  assert.equal(mapCloseEventToConnectionIssue(1008, 'unknown'), 'policy-violation');
  assert.equal(mapCloseEventToConnectionIssue(4408, ''), 'connection-limit-exceeded');
  assert.equal(mapCloseEventToConnectionIssue(1006, ''), null);
});

import * as Y from 'yjs';
import * as protocolConstants from '../../src/constants/collaboration-protocol.js';
import * as wsConstants from '../../src/constants/ws.js';
import {
  isProtocolTooOldError,
  ProtocolTooOldError,
} from '../../src/lib/collaboration-protocol.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';

test('keepalive advertises v3, observes 426, and stops subsequent keepalive and normal saves', async () => {
  const gate = new ClientProtocolGate();
  let requests = 0;
  const h = sourceHookHarness(
    'src/api/diagramApi.ts',
    {
      'collaboration-protocol': {
        ...protocolConstants,
        collaborationProtocolGate: gate,
        ProtocolTooOldError,
      },
      platform: { getApiBaseUrl: () => '/api' },
      storage: { STORAGE_KEYS: { ACCESS_TOKEN: 'token', LANGUAGE: 'language' } },
    },
    {
      localStorage: { getItem: () => null },
      navigator: { language: 'en' },
      btoa,
      fetch: async (_url: string, options: RequestInit) => {
        requests++;
        assert.equal(options.keepalive, true);
        assert.equal(
          (options.headers as Record<string, string>)['X-Smart-Erd-Client-Protocol'],
          '3',
        );
        return { status: 426 };
      },
    },
  );
  const keepalive = h.exports.persistDiagramYdocSnapshotKeepalive as (
    ...args: unknown[]
  ) => boolean;
  const save = h.exports.saveDiagram as (...args: unknown[]) => Promise<unknown>;
  assert.equal(keepalive('1', '2', '3', '1', new Uint8Array([1])), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(gate.isBlocked(), true);
  assert.equal(keepalive('1', '2', '3', '1', new Uint8Array([1])), false);
  await assert.rejects(save('1', '2', '3', '{}'), isProtocolTooOldError);
  assert.equal(requests, 1);
});

for (const outcome of ['ticket-426', 'handshake-close', 'rest-426']) {
  test(`${outcome} blocks provider with no reconnect or outbound compaction`, async () => {
    const gate = new ClientProtocolGate();
    const sockets: FakeSocket[] = [];
    let ticketCalls = 0;
    class FakeSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      readyState = 0;
      onopen = () => {};
      onclose = (_event: { code: number; reason: string }) => {};
      sent: unknown[] = [];
      constructor(readonly url: string) {
        sockets.push(this);
      }
      send(value: unknown) {
        this.sent.push(value);
      }
      close() {
        this.readyState = 3;
      }
    }
    const h = sourceHookHarness(
      'src/collaboration/YjsProvider.ts',
      {
        yjs: Y,
        ws: wsConstants,

        'collaboration-protocol': {
          ...protocolConstants,
          collaborationProtocolGate: gate,
          isProtocolTooOldError,
        },
        platform: { getWsBaseUrl: () => 'ws://local' },
      },
      { WebSocket: FakeSocket, TextEncoder, ArrayBuffer },
    );
    const Provider = h.exports.YjsProvider as new (...args: unknown[]) => {
      connect(): void;
      destroy(): void;
      isSynced(): boolean;
      requestCompaction(bytes: Uint8Array): void;
      onConnectionIssueDetected: (kind: unknown) => void;
    };
    const doc = new Y.Doc();
    const provider = new Provider(doc, {
      diagramId: '3',
      getTicket: async () => {
        ticketCalls++;
        if (outcome === 'ticket-426') throw { response: { status: 426 } };
        return { ticket: 'ticket', userId: 'user', presenceProtocolVersion: 0 };
      },
    });
    const issues: unknown[] = [];
    provider.onConnectionIssueDetected = (issue) => issues.push(issue);
    provider.connect();
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (outcome !== 'ticket-426') {
      assert.match(sockets[0].url, /protocolVersion=3$/);
      if (outcome === 'handshake-close') {
        sockets[0].onclose({ code: 1008, reason: 'protocol-too-old' });
      } else {
        gate.block();
      }
    }
    assert.equal(gate.isBlocked(), true);
    assert.equal(issues.at(-1), 'protocol-too-old');
    assert.equal(provider.isSynced(), false);
    h.flush();
    provider.connect();
    h.flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(ticketCalls, 1);
    doc.getMap('tables').set('local', 'blocked');
    provider.requestCompaction(new Uint8Array([1]));
    assert.equal(sockets[0]?.sent.length ?? 0, 0);
    provider.destroy();
    doc.destroy();
  });
}
