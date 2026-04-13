import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {
  SCREEN_DESIGN_INITIAL_SCREEN_ID,
  createInstanceMasterSnapshot,
  createInstanceYMap,
  createMasterYMap,
  createScreenYMap,
  ensureScreenDesignDocumentStructure,
  readScreenDesignDocument,
} from '../../src/pages/screendesign/screen-design-document.js';

test('ensureScreenDesignDocumentStructure 는 기본 마스터 라이브러리를 Y.Doc에 시드한다', () => {
  const doc = new Y.Doc();

  ensureScreenDesignDocumentStructure(doc);
  const snapshot = readScreenDesignDocument(doc);

  assert.equal(snapshot.mastersAvailable, true);
  assert.equal(snapshot.libraryItems.length, 23);
  assert.ok(snapshot.libraryItems.some((item) => item.id === 'layout-gnb'));
  assert.ok(snapshot.libraryItems.some((item) => item.id === 'table-data-table'));
  assert.ok(snapshot.libraryItems.some((item) => item.id === 'button-group'));
});

test('librarySeedVersion 이 있으면 빈 masters map을 다시 시드하지 않는다', () => {
  const doc = new Y.Doc();
  ensureScreenDesignDocumentStructure(doc);

  const root = doc.getMap('screenSpec');
  const masters = root.get('masters');
  assert.ok(masters instanceof Y.Map);

  doc.transact(() => {
    Array.from(masters.keys()).forEach((masterId) => masters.delete(masterId));
  }, 'test-clear-masters');

  const snapshot = readScreenDesignDocument(doc);
  assert.equal(snapshot.mastersAvailable, false);
  assert.equal(snapshot.libraryItems.length, 0);
});

test('createMasterYMap 으로 추가한 custom master 를 round-trip 한다', () => {
  const doc = new Y.Doc();
  ensureScreenDesignDocumentStructure(doc);

  const root = doc.getMap('screenSpec');
  const masters = root.get('masters');
  assert.ok(masters instanceof Y.Map);

  doc.transact(() => {
    masters.set(
      'master-custom-report',
      createMasterYMap('master-custom-report', {
        name: 'Report Summary',
        categoryId: 'table',
        tier: 'widget',
        width: 540,
        height: 280,
        renderKind: 'generic',
        preset: false,
      }),
    );
  }, 'test-add-custom-master');

  const snapshot = readScreenDesignDocument(doc);
  const customMaster = snapshot.libraryItems.find((item) => item.id === 'master-custom-report');

  assert.ok(customMaster);
  assert.equal(customMaster?.label, 'Report Summary');
  assert.equal(customMaster?.categoryId, 'table');
  assert.equal(customMaster?.tier, 'widget');
  assert.equal(customMaster?.width, 540);
  assert.equal(customMaster?.height, 280);
  assert.equal(customMaster?.preset, false);
});

test('동일한 초기 screen id 가 동시에 추가돼도 screen order 는 하나로 정규화된다', () => {
  const leftDoc = new Y.Doc();
  const rightDoc = new Y.Doc();

  ensureScreenDesignDocumentStructure(leftDoc);
  ensureScreenDesignDocumentStructure(rightDoc);

  seedInitialScreen(leftDoc);
  seedInitialScreen(rightDoc);

  Y.applyUpdate(leftDoc, Y.encodeStateAsUpdate(rightDoc), 'remote');
  Y.applyUpdate(rightDoc, Y.encodeStateAsUpdate(leftDoc), 'remote');

  const leftSnapshot = readScreenDesignDocument(leftDoc);
  const rightSnapshot = readScreenDesignDocument(rightDoc);

  assert.deepEqual(
    leftSnapshot.screens.map((screen) => screen.id),
    [SCREEN_DESIGN_INITIAL_SCREEN_ID],
  );
  assert.deepEqual(
    rightSnapshot.screens.map((screen) => screen.id),
    [SCREEN_DESIGN_INITIAL_SCREEN_ID],
  );

  const leftScreenOrder = getScreenOrder(leftDoc);
  const rightScreenOrder = getScreenOrder(rightDoc);
  assert.deepEqual(leftScreenOrder, [SCREEN_DESIGN_INITIAL_SCREEN_ID]);
  assert.deepEqual(rightScreenOrder, [SCREEN_DESIGN_INITIAL_SCREEN_ID]);
});

test('master 변경은 override 없는 인스턴스 해상값에 즉시 반영된다', () => {
  const doc = new Y.Doc();
  ensureScreenDesignDocumentStructure(doc);

  const { screens, layers, masters, instances } = getRootMaps(doc);

  doc.transact(() => {
    screens.set(
      'screen-1',
      createScreenYMap('screen-1', {
        name: 'Dashboard',
        width: 1280,
        height: 900,
      }),
    );
    layers.set('screen-1', new Y.Array<string>());
    masters.set(
      'master-report',
      createMasterYMap('master-report', {
        name: 'Report Summary',
        categoryId: 'table',
        tier: 'widget',
        width: 540,
        height: 280,
        renderKind: 'generic',
        accentColor: '#bfdbfe',
        preset: false,
      }),
    );
  }, 'test-seed-master');

  const initialMaster = readScreenDesignDocument(doc).libraryItems.find(
    (item) => item.id === 'master-report',
  );
  assert.ok(initialMaster);

  doc.transact(() => {
    instances.set(
      'instance-1',
      createInstanceYMap({
        id: 'instance-1',
        screenId: 'screen-1',
        masterId: 'master-report',
        x: 64,
        y: 72,
        masterSnapshot: createInstanceMasterSnapshot(initialMaster),
      }),
    );
    const screenLayers = layers.get('screen-1');
    assert.ok(screenLayers instanceof Y.Array);
    screenLayers.push(['instance-1']);
  }, 'test-seed-instance');

  let snapshot = readScreenDesignDocument(doc);
  let instance = snapshot.instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance?.label, 'Report Summary');
  assert.equal(instance?.width, 540);
  assert.equal(instance?.height, 280);
  assert.equal(instance?.accentColor, '#bfdbfe');
  assert.equal(instance?.overrideState.width, false);

  doc.transact(() => {
    const master = masters.get('master-report');
    assert.ok(master instanceof Y.Map);
    master.set('name', 'Report Summary v2');
    master.set('width', 620);
    master.set('height', 320);
    master.set('accentColor', '#93c5fd');
  }, 'test-update-master');

  snapshot = readScreenDesignDocument(doc);
  instance = snapshot.instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance?.label, 'Report Summary v2');
  assert.equal(instance?.width, 620);
  assert.equal(instance?.height, 320);
  assert.equal(instance?.accentColor, '#93c5fd');
  assert.equal(instance?.isOrphan, false);
});

test('master 삭제 후 인스턴스는 orphan 상태로 남고 마지막 master snapshot 을 유지한다', () => {
  const doc = new Y.Doc();
  ensureScreenDesignDocumentStructure(doc);

  const { screens, layers, masters, instances } = getRootMaps(doc);

  doc.transact(() => {
    screens.set(
      'screen-1',
      createScreenYMap('screen-1', {
        name: 'Settings',
        width: 960,
        height: 720,
      }),
    );
    layers.set('screen-1', new Y.Array<string>());
    masters.set(
      'master-panel',
      createMasterYMap('master-panel', {
        name: 'Legacy Panel',
        categoryId: 'form',
        tier: 'widget',
        width: 360,
        height: 240,
        renderKind: 'generic',
        accentColor: '#c7d2fe',
        preset: false,
      }),
    );
  }, 'test-seed-orphan-master');

  const initialMaster = readScreenDesignDocument(doc).libraryItems.find(
    (item) => item.id === 'master-panel',
  );
  assert.ok(initialMaster);

  doc.transact(() => {
    instances.set(
      'instance-1',
      createInstanceYMap({
        id: 'instance-1',
        screenId: 'screen-1',
        masterId: 'master-panel',
        x: 48,
        y: 56,
        overrides: {
          label: 'Pinned card',
          width: 420,
          accentColor: '#f59e0b',
        },
        masterSnapshot: createInstanceMasterSnapshot(initialMaster),
      }),
    );
    const screenLayers = layers.get('screen-1');
    assert.ok(screenLayers instanceof Y.Array);
    screenLayers.push(['instance-1']);
  }, 'test-seed-orphan-instance');

  doc.transact(() => {
    masters.delete('master-panel');
  }, 'test-delete-master');

  const snapshot = readScreenDesignDocument(doc);
  const orphan = snapshot.instancesByScreenId['screen-1']?.[0];
  assert.ok(orphan);
  assert.equal(orphan?.isOrphan, true);
  assert.equal(orphan?.label, 'Pinned card');
  assert.equal(orphan?.masterLabel, 'Legacy Panel');
  assert.equal(orphan?.width, 420);
  assert.equal(orphan?.height, 240);
  assert.equal(orphan?.accentColor, '#f59e0b');
  assert.equal(orphan?.masterAccentColor, '#c7d2fe');
});

function getRootMaps(doc: Y.Doc) {
  const root = doc.getMap('screenSpec');
  const screens = root.get('screens');
  const layers = root.get('layers');
  const masters = root.get('masters');
  const instances = root.get('instances');
  assert.ok(screens instanceof Y.Map);
  assert.ok(layers instanceof Y.Map);
  assert.ok(masters instanceof Y.Map);
  assert.ok(instances instanceof Y.Map);
  return { screens, layers, masters, instances };
}

function seedInitialScreen(doc: Y.Doc): void {
  const root = doc.getMap('screenSpec');
  const screens = root.get('screens');
  const screenOrder = root.get('screenOrder');
  const layers = root.get('layers');

  assert.ok(screens instanceof Y.Map);
  assert.ok(screenOrder instanceof Y.Array);
  assert.ok(layers instanceof Y.Map);

  doc.transact(() => {
    screens.set(
      SCREEN_DESIGN_INITIAL_SCREEN_ID,
      createScreenYMap(SCREEN_DESIGN_INITIAL_SCREEN_ID, {
        name: 'Screen 1',
        width: 1440,
        height: 1024,
      }),
    );
    screenOrder.push([SCREEN_DESIGN_INITIAL_SCREEN_ID]);
    layers.set(SCREEN_DESIGN_INITIAL_SCREEN_ID, new Y.Array<string>());
  }, 'test-seed-initial-screen');
}

function getScreenOrder(doc: Y.Doc): string[] {
  const screenOrder = doc.getMap('screenSpec').get('screenOrder');
  assert.ok(screenOrder instanceof Y.Array);
  return screenOrder
    .toArray()
    .filter((screenId): screenId is string => typeof screenId === 'string' && screenId.length > 0);
}
