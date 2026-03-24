import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { DiagramCollaborationProviderConnection } from '../../src/collaboration/channel/diagram/diagram-collaboration-testable.js';

test('DiagramCollaborationProviderConnection connects provider with ticket bridge and disposes cleanly', async () => {
  const callOrder: string[] = [];
  const ydoc = new Y.Doc();
  const fakeProvider = {
    connect() {
      callOrder.push('provider:connect');
    },
    destroy() {
      callOrder.push('provider:destroy');
    },
  };

  const connection = new DiagramCollaborationProviderConnection(
    {
      ydoc,
      diagramId: '123',
      onProviderReady: (provider) => {
        assert.equal(provider, fakeProvider);
        callOrder.push('provider:ready');
      },
      onProviderDisposed: () => {
        callOrder.push('provider:disposed');
      },
    },
    {
      transport: {
        websocketPath(diagramId) {
          assert.equal(diagramId, '123');
          return '/ws/diagram/123';
        },
        async issueTicket(diagramId) {
          assert.equal(diagramId, '123');
          callOrder.push('transport:ticket');
          return { ticket: 'ticket-123' };
        },
      },
      providerBinding: {
        bind(provider) {
          assert.equal(provider, fakeProvider);
          callOrder.push('binding:bind');
        },
        dispose(provider) {
          assert.equal(provider, fakeProvider);
          callOrder.push('binding:dispose');
        },
      },
      providerEvents: {
        markTicketRequested() {
          callOrder.push('events:mark-ticket-requested');
        },
        logTicketIssued() {
          callOrder.push('events:log-ticket-issued');
        },
      },
      createProvider(doc, options) {
        assert.equal(doc, ydoc);
        assert.equal(options.diagramId, '123');
        assert.equal(options.websocketPath, '/ws/diagram/123');
        void options
          .getTicket()
          .then((ticket) => {
            assert.deepEqual(ticket, { ticket: 'ticket-123' });
          });
        callOrder.push('provider:create');
        return fakeProvider as never;
      },
    },
  );

  connection.connect();
  await Promise.resolve();
  await Promise.resolve();
  connection.dispose();

  assert.deepEqual(callOrder, [
    'events:mark-ticket-requested',
    'transport:ticket',
    'provider:create',
    'binding:bind',
    'provider:connect',
    'provider:ready',
    'events:log-ticket-issued',
    'binding:dispose',
    'provider:destroy',
    'provider:disposed',
  ]);
});
