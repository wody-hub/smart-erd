import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CodeBlockRecoveryJournal,
  RECOVERY_LIMITS,
  recoveryRecord,
} from '../../src/lib/code-block-recovery-journal.js';
import { CodeBlockRecoverySession } from '../../src/lib/code-block-recovery-session.js';
import { CodeBlockEditingController } from '../../src/lib/diagram-code-block-editing.js';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';

/** 문서 쓰기 없이 복구 판단과 가상 시계를 연결한다. */
function fixture() {
  let now = 1000,
    ready = true,
    active = true,
    restored = 0,
    seq = 0;
  const data = new Map<string, string>();
  const storage = {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const journal = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab', () => now);
  const snapshot: ProjectionSnapshot = {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: [
      {
        id: 't',
        data: {
          label: 'users',
          columns: [{ id: 'c', name: 'value', type: 'INT', nullable: true }],
        },
      },
    ],
  };
  const base = generateTableBlock('t', snapshot);
  const timers = new Map<number, { at: number; run: () => void }>();
  const commits: unknown[] = [];
  const sessionRef: { current?: CodeBlockRecoverySession } = {};
  const controller = new CodeBlockEditingController({
    now: () => now,
    schedule: (run, delay) => {
      const id = ++seq;
      timers.set(id, { at: now + delay, run });
      return () => {
        timers.delete(id);
      };
    },
    ready: () => ready,
    fingerprint: () => 'd',
    snapshot: () => snapshot,
    uuid: () => 'commit',
    commit: (commit) => {
      commits.push(commit);
      return {
        status: 'applied',
        commitId: commit.commitId,
        changedFields: commit.patches.length,
        noop: false,
      };
    },
    changed: (id) => sessionRef.current?.changed(id),
    replaceText: () => {},
  });
  controller.add(base);
  controller.edit('t', base.text.replace('::INT', '::TEXT'));
  const record = recoveryRecord(controller.get('t')!, now, 'old');
  journal.put({ ...record, ownerTabId: '', heartbeatAt: 0 });
  controller.discardRecovered('t');
  const session = new CodeBlockRecoverySession({
    controller,
    journal,
    ready: () => ready,
    active: () => active,
    authoritative: () => (snapshot.nodes.length ? [generateTableBlock('t', snapshot)] : []),
    schedule: (run, delay) => {
      const id = ++seq;
      timers.set(id, { at: now + delay, run });
      return () => {
        timers.delete(id);
      };
    },
    restored: (count) => {
      restored = count;
    },
    now: () => now,
  });
  sessionRef.current = session;
  return {
    controller,
    journal,
    session,
    snapshot,
    base,
    record,
    commits,
    data,
    count: () => restored,
    ready: (value: boolean) => {
      ready = value;
      controller.setReady(value);
    },
    logout: () => {
      CodeBlockRecoveryJournal.clearAccount(storage, 'a');
      active = false;
    },
    tick: (ms: number) => {
      const end = now + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].run();
      }
      now = end;
    },
  };
}

for (const scenario of [
  'unchanged',
  'non-conflicting',
  'conflicting',
  'deleted',
  'viewer',
  'not-ready',
  'live-tab',
] as const) {
  test(`restore decision: ${scenario}; restoration itself performs zero document writes`, () => {
    const h = fixture();
    if (scenario === 'non-conflicting') h.snapshot.nodes[0].data.label = 'remote_users';
    if (scenario === 'conflicting') h.snapshot.nodes[0].data.columns[0].type = 'BIGINT';
    if (scenario === 'deleted') h.snapshot.nodes = [];
    if (scenario === 'viewer' || scenario === 'not-ready') h.ready(false);
    if (scenario === 'live-tab') h.journal.put({ ...h.record, ownerTabId: 'other' });
    h.session.restore();
    assert.equal(h.commits.length, 0);
    if (['viewer', 'not-ready', 'live-tab'].includes(scenario)) {
      assert.equal(h.count(), 0);
      assert.equal(h.journal.read().length, 1);
      return;
    }
    const block = h.controller.get('t')!;
    assert.equal(h.count(), 1);
    assert.match(block.state.text, /::TEXT/);
    if (scenario === 'conflicting') {
      assert.equal(block.state.status, 'CONFLICT');
      assert.equal(block.conflicts[0].currentValue, 'BIGINT');
      h.tick(6000);
      assert.equal(h.commits.length, 0);
      h.controller.resolve('t', 'remote');
      assert.equal(h.journal.read().length, 0);
    } else if (scenario === 'deleted') {
      assert.equal(block.state.blockedReason, 'entity-removed');
      h.tick(6000);
      assert.equal(h.commits.length, 0);
      h.session.discard();
      assert.equal(h.controller.get('t'), undefined);
      assert.equal(h.journal.read().length, 0);
    } else {
      assert.equal(block.state.status, 'DIRTY');
      if (scenario === 'non-conflicting')
        assert.equal(block.base.metadata.tablePhysicalName, 'remote_users');
      h.tick(800);
      assert.equal(h.commits.length, 1);
      assert.equal(h.journal.read().length, 0);
    }
    h.session.dispose();
    h.controller.dispose();
  });
}

test('session: 500ms debounce, synchronous release flush and no repopulation after logout', () => {
  const h = fixture();
  h.journal.remove('t');
  h.controller.edit('t', h.base.text.replace('::INT', '::'));
  h.tick(499);
  assert.equal(h.journal.read().length, 0);
  h.tick(1);
  assert.equal(h.journal.read().length, 1);
  h.controller.edit('t', h.base.text.replace('::INT', '::?'));
  h.session.release();
  assert.match(h.journal.read()[0].text, /::\?/);
  assert.equal(h.journal.read()[0].ownerTabId, '');
  h.logout();
  h.session.dispose();
  h.tick(6000);
  assert.equal(h.data.size, 0);
});

test('session: not-ready hydration does not delete journal; later readiness restores it once', () => {
  const h = fixture();
  h.ready(false);
  h.session.changed();
  h.session.restore();
  assert.equal(h.journal.read().length, 1);
  h.ready(true);
  h.session.restore();
  h.session.restore();
  assert.equal(h.count(), 1);
  h.session.discard();
  assert.equal(h.controller.get('t')?.state.status, 'CLEAN');
  assert.equal(h.journal.read().length, 0);
  h.tick(6000);
  assert.equal(h.commits.length, 0);
});

test('session: crashed tab becomes restorable after lease expiry, structural edits stay unsupported', () => {
  const h = fixture();
  h.journal.put({ ...h.record, ownerTabId: 'crashed', editKind: 'replace-lines' });
  h.session.restore();
  assert.equal(h.count(), 0);
  h.tick(RECOVERY_LIMITS.leaseMs + 1);
  h.session.heartbeat();
  assert.equal(h.count(), 1);
  h.tick(6000);
  assert.equal(h.commits.length, 0);
  assert.equal(h.controller.get('t')?.state.status, 'UNSUPPORTED');
});
