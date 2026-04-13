import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { ScreenSpecYjsDocumentAdapter } from '../../src/collaboration/yjs/screen-spec-yjs-document-adapter.js';
import { createScreenSpecDocumentPlugin } from '../../src/collaboration/plugins/screen-spec/screen-spec-document-plugin.js';
import {
  SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION,
  readScreenDesignDocument,
} from '../../src/pages/screendesign/screen-design-document.js';

test('screen spec bootstrap hydrates snapshot-style persisted content', () => {
  const doc = new Y.Doc();
  const adapter = new ScreenSpecYjsDocumentAdapter();
  const bootstrapContent = JSON.stringify({
    screens: [
      {
        id: 'screen-1',
        name: 'Dashboard',
        width: 1280,
        height: 900,
      },
    ],
    libraryItems: [
      {
        id: 'master-report',
        label: 'Report Summary',
        categoryId: 'table',
        tier: 'widget',
        width: 540,
        height: 280,
        renderKind: 'generic',
        accentColor: '#bfdbfe',
        preset: false,
      },
    ],
    instancesByScreenId: {
      'screen-1': [
        {
          id: 'instance-1',
          screenId: 'screen-1',
          masterId: 'master-report',
          x: 64,
          y: 72,
          width: 620,
          height: 320,
          label: 'Pinned report',
          accentColor: '#93c5fd',
          overrideState: {
            label: true,
            accentColor: true,
            width: true,
            height: true,
          },
          masterSnapshot: {
            label: 'Report Summary',
            categoryId: 'table',
            tier: 'widget',
            width: 540,
            height: 280,
            renderKind: 'generic',
            accentColor: '#bfdbfe',
            preset: false,
          },
        },
      ],
    },
  });

  adapter.applyBootstrapToDoc(
    doc,
    {
      content: bootstrapContent,
      hasYdocSnapshot: false,
      contentRevision: '12',
    },
    'bootstrap',
  );

  const snapshot = readScreenDesignDocument(doc);
  const screen = snapshot.screens[0];
  const instance = snapshot.instancesByScreenId['screen-1']?.[0];
  const master = snapshot.libraryItems.find((item) => item.id === 'master-report');

  assert.equal(screen?.name, 'Dashboard');
  assert.ok(master);
  assert.equal(instance?.label, 'Pinned report');
  assert.equal(instance?.accentColor, '#93c5fd');
  assert.equal(instance?.overrideState.label, true);
  assert.equal(instance?.overrideState.accentColor, true);
  assert.equal(instance?.overrideState.width, true);
  assert.equal(instance?.overrideState.height, true);
});

test('screen spec bootstrap migrates legacy instance dimensions to the current schema', () => {
  const doc = new Y.Doc();
  const adapter = new ScreenSpecYjsDocumentAdapter();
  const bootstrapContent = JSON.stringify({
    screenSpec: {
      schemaVersion: 1,
      screens: {
        'screen-1': {
          id: 'screen-1',
          name: 'Dashboard',
          width: 1280,
          height: 900,
        },
      },
      screenOrder: ['screen-1'],
      masters: {
        'master-report': {
          id: 'master-report',
          name: 'Report Summary',
          category: 'table',
          tier: 'widget',
          width: 540,
          height: 280,
          renderKind: 'generic',
          accentColor: '#bfdbfe',
          preset: false,
        },
      },
      instances: {
        'instance-1': {
          id: 'instance-1',
          screenId: 'screen-1',
          masterId: 'master-report',
          x: 80,
          y: 96,
          width: 620,
          height: 320,
        },
      },
      layers: {
        'screen-1': ['instance-1'],
      },
    },
  });

  adapter.applyBootstrapToDoc(
    doc,
    {
      content: bootstrapContent,
      hasYdocSnapshot: false,
      contentRevision: '7',
    },
    'bootstrap',
  );

  const root = doc.getMap('screenSpec');
  const instanceMap = root.get('instances');
  const snapshot = readScreenDesignDocument(doc);
  const instance = snapshot.instancesByScreenId['screen-1']?.[0];

  assert.equal(root.get('schemaVersion'), SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION);
  assert.ok(instanceMap instanceof Y.Map);
  assert.equal(instanceMap.get('instance-1') instanceof Y.Map, true);
  assert.equal(instance?.width, 620);
  assert.equal(instance?.height, 320);
  assert.equal(instance?.overrideState.width, true);
  assert.equal(instance?.overrideState.height, true);
});

test('screen spec plugin schema version follows the screen design document schema', () => {
  const plugin = createScreenSpecDocumentPlugin();

  assert.equal(plugin.schemaVersion, SCREEN_DESIGN_DOCUMENT_SCHEMA_VERSION);
});
