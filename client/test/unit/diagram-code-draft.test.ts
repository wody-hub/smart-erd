import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagramDslDraftStorageKey,
  loadDiagramDslDraft,
  loadDiagramDslDraftRecord,
  saveDiagramDslDraftRecord,
} from '../../src/lib/diagram-code-draft.js';

test('buildDiagramDslDraftStorageKey 는 다이어그램 스코프 기준 키를 만든다', () => {
  assert.equal(
    buildDiagramDslDraftStorageKey({ teamId: 't1', projectId: 'p1', diagramId: 'd1' }),
    'smart-erd-dsl-draft:t1:p1:d1',
  );
});

test('buildDiagramDslDraftStorageKey 는 스코프가 불완전하면 null 을 반환한다', () => {
  assert.equal(buildDiagramDslDraftStorageKey({ teamId: 't1', projectId: 'p1' }), null);
});

test('loadDiagramDslDraft 와 saveDiagramDslDraftRecord 는 localStorage 를 round-trip 한다', () => {
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
    saveDiagramDslDraftRecord(
      { teamId: 'team', projectId: 'project', diagramId: 'diagram' },
      {
        text: "Table '사용자' {}",
        baselineRevision: 'rev-1',
        previewPositions: {
          'preview-table:user': { x: 120, y: 240 },
        },
      },
    );
    assert.equal(
      loadDiagramDslDraft({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }),
      "Table '사용자' {}",
    );
    assert.deepEqual(
      loadDiagramDslDraftRecord({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }),
      {
        text: "Table '사용자' {}",
        baselineRevision: 'rev-1',
        previewPositions: {
          'preview-table:user': { x: 120, y: 240 },
        },
      },
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  }
});

test('loadDiagramDslDraftRecord 는 legacy plain string 저장값도 호환한다', () => {
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
    storage.set('smart-erd-dsl-draft:team:project:diagram', "Table '레거시' {}");
    assert.deepEqual(
      loadDiagramDslDraftRecord({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }),
      {
        text: "Table '레거시' {}",
        baselineRevision: null,
        previewPositions: {},
      },
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  }
});

test('loadDiagramDslDraftRecord 는 잘못된 previewPositions 값을 무시한다', () => {
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
    storage.set(
      'smart-erd-dsl-draft:team:project:diagram',
      JSON.stringify({
        text: "Table '사용자' {}",
        baselineRevision: 'rev-2',
        previewPositions: {
          valid: { x: 10, y: 20 },
          invalidX: { x: '10', y: 20 },
          invalidY: { x: 10, y: null },
        },
      }),
    );

    assert.deepEqual(
      loadDiagramDslDraftRecord({ teamId: 'team', projectId: 'project', diagramId: 'diagram' }),
      {
        text: "Table '사용자' {}",
        baselineRevision: 'rev-2',
        previewPositions: {
          valid: { x: 10, y: 20 },
        },
      },
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  }
});
