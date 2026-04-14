import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { ScreenSpecDocumentMutationApplier } from '../../src/collaboration/plugins/screen-spec/screen-spec-document-mutation-applier.js';
import {
  SCREEN_DESIGN_DOCUMENT_PADDING,
  readScreenDesignDocument,
} from '../../src/pages/screendesign/screen-design-document.js';

function createHarness() {
  const doc = new Y.Doc();
  const applier = new ScreenSpecDocumentMutationApplier({
    getDocument: () => doc,
  } as never);

  return { doc, applier };
}

function applyMutation(
  applier: ScreenSpecDocumentMutationApplier,
  key: string,
  payload: Record<string, unknown>,
): void {
  const result = applier.apply({ key, payload, affectedScopes: [] });
  assert.equal(result.applied, true, `${key} should apply`);
}

function setupScreenAndMasters(applier: ScreenSpecDocumentMutationApplier): void {
  applyMutation(applier, 'screen:add', {
    screenId: 'screen-1',
    name: 'Screen 1',
    width: 1200,
    height: 900,
  });
  applyMutation(applier, 'master:add', {
    masterId: 'master-small',
    name: 'Small Card',
    categoryId: 'table',
    tier: 'widget',
  });
  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 240,
    height: 160,
  });
  applyMutation(applier, 'master:add', {
    masterId: 'master-large',
    name: 'Large Card',
    categoryId: 'table',
    tier: 'widget',
  });
  applyMutation(applier, 'master:update', {
    masterId: 'master-large',
    width: 480,
    height: 320,
    accentColor: '#93c5fd',
  });
}

test('screen spec rebind clamps inherited instance size against the next master defaults', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 936,
    y: 24,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    masterId: 'master-large',
  });

  const instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];

  assert.ok(instance);
  assert.equal(instance.masterId, 'master-large');
  assert.equal(instance.width, 480);
  assert.equal(instance.height, 320);
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
  assert.equal(instance.x, 1200 - instance.width - SCREEN_DESIGN_DOCUMENT_PADDING);
  assert.equal(instance.y, 24);
});

test('screen spec rebind preserves explicit size overrides while reclamping position', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 936,
    y: 24,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 300,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    masterId: 'master-large',
  });

  const instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];

  assert.ok(instance);
  assert.equal(instance.masterId, 'master-large');
  assert.equal(instance.width, 300);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.x, 1200 - instance.width - SCREEN_DESIGN_DOCUMENT_PADDING);
  assert.equal(instance.y, 24);
});

test('screen spec rebind clears stale overrides that now match the next master defaults', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'master:update', {
    masterId: 'master-large',
    name: 'Pinned card',
  });
  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 120,
    y: 80,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 480,
    height: 320,
    label: 'Pinned card',
    accentColor: '#93c5fd',
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);
  assert.equal(instance.overrideState.label, true);
  assert.equal(instance.overrideState.accentColor, true);

  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    masterId: 'master-large',
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.masterId, 'master-large');
  assert.equal(instance.width, 480);
  assert.equal(instance.height, 320);
  assert.equal(instance.label, 'Pinned card');
  assert.equal(instance.accentColor, '#93c5fd');
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
  assert.equal(instance.overrideState.label, false);
  assert.equal(instance.overrideState.accentColor, false);
});
