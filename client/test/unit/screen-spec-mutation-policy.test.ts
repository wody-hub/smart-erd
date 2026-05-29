import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { ScreenSpecDocumentReadContextFactory } from '../../src/collaboration/plugins/screen-spec/query/screen-spec-document-read-context-factory.js';
import { ScreenSpecMutationPolicy } from '../../src/collaboration/plugins/screen-spec/screen-spec-mutation-policy.js';
import { ScreenSpecScopeResolver } from '../../src/collaboration/plugins/screen-spec/screen-spec-scope-resolver.js';
import {
  createScreenSpecDocumentPlugin,
  isScreenSpecCanvasInputAdapter,
} from '../../src/collaboration/plugins/screen-spec/screen-spec-document-plugin.js';
import {
  createScreenYMap,
  ensureScreenDesignDocumentStructure,
} from '../../src/pages/screendesign/screen-design-document.js';

test('ScreenSpecDocumentReadContextFactory 는 Y.Doc snapshot으로 read context를 생성한다', () => {
  const doc = new Y.Doc();
  ensureScreenDesignDocumentStructure(doc);
  const root = doc.getMap('screenSpec');
  const screens = root.get('screens');
  const screenOrder = root.get('screenOrder');
  assert.ok(screens instanceof Y.Map);
  assert.ok(screenOrder instanceof Y.Array);

  doc.transact(() => {
    screens.set(
      'screen-read-context',
      createScreenYMap('screen-read-context', {
        name: 'Read Context',
        width: 1440,
        height: 960,
      }),
    );
    screenOrder.push(['screen-read-context']);
  }, 'test-read-context');

  const factory = new ScreenSpecDocumentReadContextFactory(
    { getDocument: () => doc } as never,
    { getRevision: () => 'revision-1' } as never,
  );
  const context = factory.create();

  assert.deepEqual(context.findByKind('screen'), [
    {
      kind: 'screen',
      id: 'screen-read-context',
    },
  ]);
  assert.equal(context.getRevision(), 'revision-1');
});

test('screen spec canvas adapter 는 screen/add 와 instance/add command 를 생성한다', () => {
  const plugin = createScreenSpecDocumentPlugin();
  const adapters = plugin.createInputAdapters({ read: {} as never });

  assert.ok(isScreenSpecCanvasInputAdapter(adapters.canvas));
  assert.deepEqual(adapters.canvas.addScreen('screen-1', 'Dashboard', 1440, 960), {
    key: 'screen:add',
    payload: {
      screenId: 'screen-1',
      name: 'Dashboard',
      width: 1440,
      height: 960,
    },
  });
  assert.deepEqual(adapters.canvas.addMaster('master-1', 'Filter Panel', 'form', 'widget'), {
    key: 'master:add',
    payload: {
      masterId: 'master-1',
      name: 'Filter Panel',
      categoryId: 'form',
      tier: 'widget',
    },
  });
  assert.deepEqual(adapters.canvas.addInstance('instance-1', 'screen-1', 'master-1', 120, 80), {
    key: 'instance:add',
    payload: {
      instanceId: 'instance-1',
      screenId: 'screen-1',
      masterId: 'master-1',
      x: 120,
      y: 80,
    },
  });
});

test('ScreenSpecMutationPolicy 는 screen/add 와 master/add 를 초기 생성 scope 로 변환한다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const screenMutation = mutationPolicy.toMutation(
    {
      key: 'screen:add',
      payload: {
        screenId: 'screen-1',
        name: 'Dashboard',
        width: 1440,
        height: 960,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );
  const masterMutation = mutationPolicy.toMutation(
    {
      key: 'master:add',
      payload: {
        masterId: 'master-1',
        name: 'Filter Panel',
        categoryId: 'form',
        tier: 'widget',
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.equal(screenMutation.key, 'screen:add');
  assert.deepEqual(screenMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'exclusive',
    },
  ]);
  assert.deepEqual(masterMutation.affectedScopes, [
    {
      kind: 'masters',
      id: 'collection',
      mode: 'shared',
    },
  ]);
});

test('ScreenSpecMutationPolicy 는 instance/layer command 를 세분화된 scope 로 변환한다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const updateMutation = mutationPolicy.toMutation(
    {
      key: 'instance:update',
      payload: {
        instanceId: 'instance-2',
        screenId: 'screen-1',
        x: 640,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );
  const layerMutation = mutationPolicy.toMutation(
    {
      key: 'layer:move',
      payload: {
        instanceId: 'instance-2',
        screenId: 'screen-1',
        direction: 'front',
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.deepEqual(updateMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'shared',
    },
    {
      kind: 'layer',
      id: 'screen-1',
      mode: 'shared',
    },
    {
      kind: 'instance',
      id: 'instance-2',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
  assert.deepEqual(layerMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'shared',
    },
    {
      kind: 'layer',
      id: 'screen-1',
      mode: 'exclusive',
    },
    {
      kind: 'instance',
      id: 'instance-2',
      mode: 'shared',
    },
  ]);
});

test('ScreenSpecMutationPolicy 는 instance/add 에 master shared scope 를 포함한다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const addMutation = mutationPolicy.toMutation(
    {
      key: 'instance:add',
      payload: {
        instanceId: 'instance-2',
        screenId: 'screen-1',
        masterId: 'master-7',
        x: 120,
        y: 48,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.deepEqual(addMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'shared',
    },
    {
      kind: 'layer',
      id: 'screen-1',
      mode: 'shared',
    },
    {
      kind: 'instance',
      id: 'instance-2',
      mode: 'exclusive',
    },
    {
      kind: 'master',
      id: 'master-7',
      mode: 'shared',
    },
  ]);
});

test('ScreenSpecMutationPolicy 는 cascaded instance writes 를 위한 coordination scope 를 포함한다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const masterUpdateMutation = mutationPolicy.toMutation(
    {
      key: 'master:update',
      payload: {
        masterId: 'master-7',
        width: 480,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );
  const screenFrameMutation = mutationPolicy.toMutation(
    {
      key: 'screen:update-frame',
      payload: {
        screenId: 'screen-1',
        width: 800,
        height: 600,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );
  const masterDeleteMutation = mutationPolicy.toMutation(
    {
      key: 'master:delete',
      payload: {
        masterId: 'master-7',
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );
  const screenDeleteMutation = mutationPolicy.toMutation(
    {
      key: 'screen:delete',
      payload: {
        screenId: 'screen-1',
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.deepEqual(masterUpdateMutation.affectedScopes, [
    {
      kind: 'master',
      id: 'master-7',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
  assert.deepEqual(screenFrameMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
  assert.deepEqual(masterDeleteMutation.affectedScopes, [
    {
      kind: 'master',
      id: 'master-7',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
  assert.deepEqual(screenDeleteMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-1',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
});

test('ScreenSpecMutationPolicy 는 cross-screen instance update 에 coordination scope 를 포함한다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const moveMutation = mutationPolicy.toMutation(
    {
      key: 'instance:update',
      payload: {
        instanceId: 'instance-2',
        screenId: 'screen-2',
        x: 640,
      },
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.deepEqual(moveMutation.affectedScopes, [
    {
      kind: 'screen',
      id: 'screen-2',
      mode: 'shared',
    },
    {
      kind: 'layer',
      id: 'screen-2',
      mode: 'shared',
    },
    {
      kind: 'instance',
      id: 'instance-2',
      mode: 'exclusive',
    },
    {
      kind: 'instance-cascade',
      id: 'collection',
      mode: 'exclusive',
    },
  ]);
});

test('ScreenSpecMutationPolicy 는 미처리 command 에 root lock 을 부여하지 않는다', () => {
  const mutationPolicy = new ScreenSpecMutationPolicy(new ScreenSpecScopeResolver());

  const mutation = mutationPolicy.toMutation(
    {
      key: 'unknown:command',
      payload: {},
    },
    {
      origin: {
        source: 'local',
      },
    },
  );

  assert.deepEqual(mutation.affectedScopes, []);
});
