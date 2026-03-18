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
      },
    );
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  }
});
