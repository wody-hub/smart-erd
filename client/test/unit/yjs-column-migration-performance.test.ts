import { strict as assert } from 'node:assert';
import { test, type TestContext } from 'node:test';
import * as Y from 'yjs';
import { ErdDocumentMutationApplier } from '@/collaboration/plugins/erd/erd-document-mutation-applier';
import { ensureColumnStorage, getColumnYMap } from '@/collaboration/yjs-columns';
import { createColumnYMap, getTablesMap } from '@/collaboration/yjsBridge';

/**
 * 이관 성능 측정용 레거시 문서를 만든다. 생성 시간은 측정에서 제외한다.
 * @param tableCount 테이블 수 (각각 20컬럼)
 * @returns 레거시 문서
 */
function legacyDocument(tableCount: number): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    for (let index = 0; index < tableCount; index += 1) {
      const table = new Y.Map<unknown>();
      const columns = new Y.Array<Y.Map<unknown>>();
      columns.push(
        Array.from({ length: 20 }, (_, column) =>
          createColumnYMap({ id: `c${column}`, name: `column_${column}`, type: 'INT' }),
        ),
      );
      table.set('columns', columns);
      getTablesMap(doc).set(`t${index}`, table);
    }
  });
  return doc;
}

/**
 * 실제 Yjs 인코더를 관찰해 원본 struct 복제와 시스템 이관 횟수를 센다.
 * @param context 테스트 mock 수명 관리자
 * @param doc 측정 문서
 * @returns 누적 작업량
 */
function measureMigrationWork(context: TestContext, doc: Y.Doc) {
  const originalClient = doc.clientID;
  const originalClock = Y.decodeStateVector(Y.encodeStateVector(doc)).get(originalClient)!;
  const work = { legacyStructEncodings: 0, migrations: 0 };
  const write = Y.Item.prototype.write;
  // Do not retain encoder arguments/call histories: a full-document regression
  // would otherwise make the observer itself exhaust the test process heap.
  Y.Item.prototype.write = function (this: Y.Item, ...args: Parameters<Y.Item['write']>) {
    if (this.id.client === originalClient && this.id.clock < originalClock) {
      work.legacyStructEncodings += 1;
      assert.fail('Migration must never encode an existing source document struct');
    }
    return write.apply(this, args);
  };
  context.after(() => {
    Y.Item.prototype.write = write;
  });
  doc.on('update', (_update: Uint8Array, origin: unknown) => {
    if (origin === 'canvas-system-fallback') work.migrations += 1;
  });
  return work;
}

test('dictionary:reconcile migrates 200 x 20 legacy columns within 1 second without document copies', (context) => {
  const doc = legacyDocument(200);
  const work = measureMigrationWork(context, doc);
  const columnUpdates = Array.from({ length: 200 }, (_, table) =>
    Array.from({ length: 20 }, (_, column) => ({
      nodeId: `t${table}`,
      colId: `c${column}`,
      updates: { logicalName: `dictionary_${column}` },
    })),
  ).flat();
  const applier = new ErdDocumentMutationApplier({ getDocument: () => doc } as never);
  const mutation = {
    key: 'dictionary:reconcile',
    payload: { plan: { tableMetaUpdates: [], columnUpdates } },
    affectedScopes: [],
  };
  const start = performance.now();
  assert.equal(applier.apply(mutation).applied, true);
  const elapsed = performance.now() - start;
  context.diagnostic(`200 x 20 dictionary migration: ${elapsed.toFixed(1)} ms`);
  assert.equal(work.legacyStructEncodings, 0, 'must never encode the source document');
  assert.equal(work.migrations, 200, 'one migration per table, not per column');
  assert.ok(elapsed < 1000, `dictionary reconciliation took ${elapsed} ms`);
  for (const table of getTablesMap(doc).values()) {
    assert.equal((table.get('columnsById') as Y.Map<unknown>).size, 20);
    assert.equal(getColumnYMap(table, 'c19')!.get('logicalName'), 'dictionary_19');
  }
  applier.apply(mutation);
  assert.equal(work.migrations, 200, 'already migrated tables must be skipped');
  assert.equal(work.legacyStructEncodings, 0);
  doc.destroy();
});

test('bulk migration of 500 x 20 columns takes under 5 seconds and skips migrated tables', (context) => {
  const doc = legacyDocument(500);
  const work = measureMigrationWork(context, doc);
  const start = performance.now();
  for (const table of getTablesMap(doc).values()) ensureColumnStorage(table);
  const elapsed = performance.now() - start;
  context.diagnostic(`500 x 20 bulk migration: ${elapsed.toFixed(1)} ms`);
  assert.equal(work.legacyStructEncodings, 0, 'must never encode the source document');
  assert.equal(work.migrations, 500);
  assert.ok(elapsed < 5000, `bulk migration took ${elapsed} ms`);
  for (const table of getTablesMap(doc).values()) {
    const storage = ensureColumnStorage(table);
    assert.equal(storage.columnsById.size, 20);
    assert.equal(storage.columnOrder.length, 20);
  }
  assert.equal(work.migrations, 500);
  assert.equal(work.legacyStructEncodings, 0);
  doc.destroy();
});
