import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecentProjectContextStorageKey,
  clearRecentProjectContext,
  loadRecentProjectContext,
  saveRecentProjectContext,
} from '../../src/hooks/useRecentProjectContext.js';

test('buildRecentProjectContextStorageKey 는 팀 스코프 키를 만든다', () => {
  assert.equal(
    buildRecentProjectContextStorageKey('team-1'),
    'smart-erd-recent-project-context:team-1',
  );
  assert.equal(buildRecentProjectContextStorageKey(undefined), null);
});

test('saveRecentProjectContext 와 loadRecentProjectContext 는 sessionStorage 를 round-trip 한다', () => {
  const storage = new Map<string, string>();
  const original = globalThis.sessionStorage;

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });

  try {
    const saved = saveRecentProjectContext('team-1', 'project-9');

    assert.equal(saved.teamId, 'team-1');
    assert.equal(saved.projectId, 'project-9');
    assert.deepEqual(loadRecentProjectContext('team-1'), saved);
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: original,
    });
  }
});

test('clearRecentProjectContext 는 저장된 최근 프로젝트 컨텍스트를 제거한다', () => {
  const storage = new Map<string, string>();
  const original = globalThis.sessionStorage;

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });

  try {
    saveRecentProjectContext('team-1', 'project-9');
    clearRecentProjectContext('team-1');

    assert.equal(loadRecentProjectContext('team-1'), null);
  } finally {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: original,
    });
  }
});
