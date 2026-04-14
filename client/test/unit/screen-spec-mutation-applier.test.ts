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

test('screen spec master update reclamps inherited instances after resized defaults grow', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 936,
    y: 716,
  });
  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 480,
    height: 320,
  });

  const instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];

  assert.ok(instance);
  assert.equal(instance.width, 480);
  assert.equal(instance.height, 320);
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
  assert.equal(instance.x, 1200 - instance.width - SCREEN_DESIGN_DOCUMENT_PADDING);
  assert.equal(instance.y, 900 - instance.height - SCREEN_DESIGN_DOCUMENT_PADDING);
});

test('screen spec master update clears stale overrides that now match updated defaults', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 120,
    y: 80,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 300,
    height: 200,
    label: 'Pinned card',
    accentColor: '#0f172a',
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);
  assert.equal(instance.overrideState.label, true);
  assert.equal(instance.overrideState.accentColor, true);

  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    name: 'Pinned card',
    width: 300,
    height: 200,
    accentColor: '#0f172a',
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 300);
  assert.equal(instance.height, 200);
  assert.equal(instance.label, 'Pinned card');
  assert.equal(instance.accentColor, '#0f172a');
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
  assert.equal(instance.overrideState.label, false);
  assert.equal(instance.overrideState.accentColor, false);
});

test('screen spec frame update reclamps instances that overflow the resized screen', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 936,
    y: 716,
  });
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 800,
    height: 600,
  });

  const instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];

  assert.ok(instance);
  assert.equal(instance.width, 240);
  assert.equal(instance.height, 160);
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
  assert.equal(instance.x, 800 - instance.width - SCREEN_DESIGN_DOCUMENT_PADDING);
  assert.equal(instance.y, 600 - instance.height - SCREEN_DESIGN_DOCUMENT_PADDING);
});

test('screen spec frame update clamps oversized instance overrides to the resized screen', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 120,
    y: 80,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 900,
    height: 700,
  });
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 500,
    height: 400,
  });

  const instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];

  assert.ok(instance);
  assert.equal(instance.width, 500 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.height, 400 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);
  assert.equal(instance.x, SCREEN_DESIGN_DOCUMENT_PADDING);
  assert.equal(instance.y, SCREEN_DESIGN_DOCUMENT_PADDING);
});

test('screen spec frame update restores inherited size after a temporary clamp is lifted', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 600,
    height: 300,
  });
  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 24,
    y: 24,
  });
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 500,
    height: 400,
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 500 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.overrideState.width, true);

  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 1200,
    height: 900,
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 600);
  assert.equal(instance.height, 300);
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
});

test('screen spec frame update restores explicit override size after a temporary clamp is lifted', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 24,
    y: 24,
  });
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 900,
    height: 640,
  });
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 500,
    height: 400,
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 500 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.height, 400 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);

  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 1200,
    height: 900,
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 900);
  assert.equal(instance.height, 640);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);
});

test('screen spec master update restores inherited size when screen grows back after a temporary clamp', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  // Grow master-small to 600x300 so it is larger than the later 500x400 screen
  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 600,
    height: 300,
  });
  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 24,
    y: 24,
  });

  // Shrink the screen so the inherited instance is temporarily clamped
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 500,
    height: 400,
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 500 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.overrideState.width, true);

  // Update the master while the screen is still small
  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 700,
    height: 360,
  });

  // Grow the screen back — the instance should restore to the updated inherited target
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 1200,
    height: 900,
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 700);
  assert.equal(instance.height, 360);
  assert.equal(instance.overrideState.width, false);
  assert.equal(instance.overrideState.height, false);
});

test('screen spec master update preserves explicit override through a temporary clamp', () => {
  const { doc, applier } = createHarness();
  setupScreenAndMasters(applier);

  applyMutation(applier, 'instance:add', {
    instanceId: 'instance-1',
    screenId: 'screen-1',
    masterId: 'master-small',
    x: 24,
    y: 24,
  });
  // User sets an explicit size larger than the screen will allow later
  applyMutation(applier, 'instance:update', {
    instanceId: 'instance-1',
    width: 900,
    height: 640,
  });

  // Shrink the screen — explicit override is clamped
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 500,
    height: 400,
  });

  let instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 500 - SCREEN_DESIGN_DOCUMENT_PADDING * 2);
  assert.equal(instance.overrideState.width, true);

  // Update the master while the screen is still small — must not overwrite the user's desired 900
  applyMutation(applier, 'master:update', {
    masterId: 'master-small',
    width: 300,
    height: 200,
  });

  // Grow the screen back — the user's explicit override should be fully restored
  applyMutation(applier, 'screen:update-frame', {
    screenId: 'screen-1',
    width: 1200,
    height: 900,
  });

  instance = readScreenDesignDocument(doc).instancesByScreenId['screen-1']?.[0];
  assert.ok(instance);
  assert.equal(instance.width, 900);
  assert.equal(instance.height, 640);
  assert.equal(instance.overrideState.width, true);
  assert.equal(instance.overrideState.height, true);
});
