import { STORAGE_KEYS } from '../../src/constants/storage.js';
import { sourceHookHarness } from '../helpers/source-hook-harness.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CodeBlockRecoveryJournal,
  RECOVERY_LIMITS,
  recoveryRecord,
} from '../../src/lib/code-block-recovery-journal.js';
import { CodeBlockEditingController } from '../../src/lib/diagram-code-block-editing.js';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';

/** 계정별 저장과 손상된 입력을 검증하는 메모리 저장소. */
export class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
/** 실제 컨트롤러의 dirty 블록을 만든다. */
function fixture() {
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
  const controller = new CodeBlockEditingController({
    now: () => 0,
    schedule: () => () => {},
    ready: () => true,
    fingerprint: () => 'd',
    snapshot: () => snapshot,
    uuid: () => 'id',
    commit: () => {
      throw new Error('Recovery must not write');
    },
    changed: () => {},
    replaceText: () => {},
  });
  controller.add(generateTableBlock('t', snapshot));
  controller.edit('t', controller.get('t')!.base.text.replace('::INT', '::TEXT'));
  return { controller, snapshot, record: recoveryRecord(controller.get('t')!, 1000, 'tab-a') };
}

test('journal: CRUD, account isolation and account-wide logout clear', () => {
  const storage = new MemoryStorage();
  const a = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => 1000);
  const b = new CodeBlockRecoveryJournal(storage, 'b', 'd', 'tab-b', () => 1000);
  const other = new CodeBlockRecoveryJournal(storage, 'a', 'other', 'tab-a', () => 1000);
  const { record } = fixture();
  a.put(record);
  other.put(record);
  assert.equal(a.read().length, 1);
  assert.equal(b.read().length, 0);
  a.remove('t');
  assert.equal(a.read().length, 0);
  a.put(record);
  b.put(record);
  CodeBlockRecoveryJournal.clearAccount(storage, 'a');
  assert.equal(a.read().length, 0);
  assert.equal(other.read().length, 0);
  assert.equal(b.read().length, 1);
});

test('journal: TTL, corrupt JSON, version mismatch and malformed sidecars discard silently', () => {
  let now = 1000;
  const storage = new MemoryStorage();
  const journal = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => now);
  const { record } = fixture();
  journal.put(record);
  now += RECOVERY_LIMITS.ttlMs + 1;
  assert.deepEqual(journal.read(), []);
  for (const raw of [
    '{',
    JSON.stringify({ version: 2, records: [record] }),
    JSON.stringify({ version: 1, records: [{ ...record, version: 2 }] }),
    JSON.stringify({ version: 1, records: [{ ...record, baseBlockSidecar: {} }] }),
  ]) {
    storage.setItem(journal.key, raw);
    assert.deepEqual(journal.read(), []);
  }
});

test('journal: caps drop oldest; oversized records and unavailable storage never throw', () => {
  const storage = new MemoryStorage();
  const journal = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => 100000);
  const { record } = fixture();
  for (let i = 0; i < RECOVERY_LIMITS.maxRecords + 3; i++)
    journal.put({
      ...record,
      tableId: `t${i}`,
      baseBlockSidecar: { ...record.baseBlockSidecar, tableId: `t${i}` },
      savedAt: i + 1,
    });
  assert.equal(journal.read().length, RECOVERY_LIMITS.maxRecords);
  assert.equal(
    journal.read().some((r) => r.tableId === 't0'),
    false,
  );
  journal.put({ ...record, text: 'x'.repeat(RECOVERY_LIMITS.maxRecordBytes) });
  assert.equal(
    journal.read().some((r) => r.tableId === 't'),
    false,
  );
  storage.getItem = () => {
    throw new Error('denied');
  };
  assert.doesNotThrow(() => journal.read());
  assert.doesNotThrow(() => journal.put(record));
});

test('journal: live owner prevents second-tab restoration; release or expired heartbeat permits it', () => {
  let now = 1000;
  const storage = new MemoryStorage();
  const a = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => now);
  const b = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-b', () => now);
  a.put(fixture().record);
  assert.equal(b.claim('t'), undefined);
  a.release();
  assert.ok(b.claim('t'));
  assert.equal(a.owns('t'), false);
  now += RECOVERY_LIMITS.leaseMs + 1;
  assert.ok(a.claim('t'));
  assert.equal(b.owns('t'), false);
});

test('journal: total byte cap, per-table last writer wins and other table preservation', () => {
  const storage = new MemoryStorage();
  const a = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => 1000);
  const b = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-b', () => 1000);
  const { record } = fixture();
  for (let i = 0; i < 15; i++)
    a.put({
      ...record,
      tableId: `t${i}`,
      baseBlockSidecar: { ...record.baseBlockSidecar, tableId: `t${i}` },
      text: '가'.repeat(25000),
      savedAt: i + 1,
    });
  assert.ok(
    new TextEncoder().encode(storage.getItem(a.key)!).length <= RECOVERY_LIMITS.maxTotalBytes,
  );
  assert.ok(a.read().length < 15);
  assert.equal(
    a.read().some((r) => r.tableId === 't0'),
    false,
  );
  a.put(record);
  b.put({ ...record, ownerTabId: 'tab-b', text: 'last' });
  assert.equal(a.read().find((r) => r.tableId === 't')!.text, 'last');
  assert.ok(a.read().some((r) => r.tableId === 't14'));
  assert.equal(a.owns('t'), false);
  b.remove('t');
  assert.equal(
    a.owns('t'),
    false,
    'old owner cannot commit after the new owner removed its record',
  );
});

test('logout: actual clearAuthState clears all account journals before removing identity', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEYS.LOGIN_ID, 'a');
  storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'test');
  storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'test');
  const a = new CodeBlockRecoveryJournal(storage, 'a', 'd', 'tab-a', () => 1000);
  const b = new CodeBlockRecoveryJournal(storage, 'b', 'd', 'tab-b', () => 1000);
  a.put(fixture().record);
  b.put(fixture().record);
  const h = sourceHookHarness(
    'src/lib/auth-refresh.ts',
    {
      storage: { STORAGE_KEYS },
      'code-block-recovery-journal': { CodeBlockRecoveryJournal },
    },
    { localStorage: storage },
  );
  (h.exports.clearAuthState as () => void)();
  assert.equal(storage.getItem(STORAGE_KEYS.LOGIN_ID), null);
  assert.equal(storage.getItem(STORAGE_KEYS.ACCESS_TOKEN), null);
  assert.equal(a.read().length, 0);
  assert.equal(b.read().length, 1);
});
