import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagramWorkModeStorageKey,
  createDiagramWorkModeCapabilities,
  loadDiagramWorkMode,
  resolveDiagramWorkModeRuntimeState,
  saveDiagramWorkMode,
} from '../../src/lib/diagram-work-mode.js';

test('buildDiagramWorkModeStorageKey 는 다이어그램 스코프 기준 키를 만든다', () => {
  assert.equal(
    buildDiagramWorkModeStorageKey({ teamId: 't1', projectId: 'p1', diagramId: 'd1' }),
    'smart-erd-work-mode:t1:p1:d1',
  );
});

test('buildDiagramWorkModeStorageKey 는 스코프가 불완전하면 null 을 반환한다', () => {
  assert.equal(buildDiagramWorkModeStorageKey({ teamId: 't1', projectId: 'p1' }), null);
});

test('createDiagramWorkModeCapabilities 는 code 모드에서 자동동기화를 끈다', () => {
  const capabilities = createDiagramWorkModeCapabilities('code');

  assert.equal(capabilities.canEditCode, true);
  assert.equal(capabilities.canEditCanvas, false);
  assert.equal(capabilities.enableCodeToErdAutoSync, false);
  assert.equal(capabilities.enableCodeEditorTableLock, false);
  assert.equal(capabilities.canvasSource, 'preview');
  assert.equal(capabilities.dslOnlyCodeEditor, true);
  assert.equal(capabilities.forcedLeftPanel, 'code');
});

test('resolveDiagramWorkModeRuntimeState 는 code 모드에서 preview 중이어도 코드 편집과 사전 관리를 허용한다', () => {
  const runtime = resolveDiagramWorkModeRuntimeState({
    mode: 'code',
    capabilities: createDiagramWorkModeCapabilities('code'),
    canEdit: true,
    isAuthoritativeBootstrapBlocked: false,
    isPersistedPreviewMode: true,
    hasActiveGroupView: false,
  });

  assert.equal(runtime.persistedEditingAllowed, false);
  assert.equal(runtime.effectiveCanvasCanEdit, false);
  assert.equal(runtime.effectiveCodeCanEdit, true);
  assert.equal(runtime.canPersistDiagramSave, false);
  assert.equal(runtime.showPreviewSyncBanner, false);
  assert.equal(runtime.canOpenDictionaryManagement, true);
  assert.equal(runtime.canEditDictionaryManagement, true);
});

test('resolveDiagramWorkModeRuntimeState 는 erd 모드에서 preview 중 코드/캔버스를 함께 잠근다', () => {
  const runtime = resolveDiagramWorkModeRuntimeState({
    mode: 'erd',
    capabilities: createDiagramWorkModeCapabilities('erd'),
    canEdit: true,
    isAuthoritativeBootstrapBlocked: false,
    isPersistedPreviewMode: true,
    hasActiveGroupView: false,
  });

  assert.equal(runtime.persistedEditingAllowed, false);
  assert.equal(runtime.effectiveCanvasCanEdit, false);
  assert.equal(runtime.effectiveCodeCanEdit, false);
  assert.equal(runtime.showPreviewSyncBanner, true);
  assert.equal(runtime.canToggleCodeEditor, false);
});

test('loadDiagramWorkMode 와 saveDiagramWorkMode 는 localStorage 를 round-trip 한다', () => {
  const storage = new Map<string, string>();
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  });

  try {
    saveDiagramWorkMode({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }, 'erd');
    assert.equal(
      loadDiagramWorkMode({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }),
      'erd',
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  }
});
