import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readErdLocalDraft,
  writeErdLocalDraft,
  parseErdLocalFileText,
  type ErdLocalStorageLike,
} from '../../src/lib/erd-local-storage.js';
import { STORAGE_KEYS } from '../../src/constants/storage.js';

/** 메모리 기반 가짜 스토리지. */
function createMemoryStorage(): ErdLocalStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const VALID_JSON = JSON.stringify({ nodes: [], edges: [], groups: [] });

test('writeErdLocalDraft stores JSON and readErdLocalDraft returns it', () => {
  const storage = createMemoryStorage();
  assert.equal(writeErdLocalDraft(storage, VALID_JSON), true);
  assert.equal(readErdLocalDraft(storage), VALID_JSON);
});

test('readErdLocalDraft returns null when nothing is stored', () => {
  assert.equal(readErdLocalDraft(createMemoryStorage()), null);
});

test('readErdLocalDraft drops corrupt drafts and returns null', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEYS.ERD_LOCAL_DRAFT, '{broken');
  assert.equal(readErdLocalDraft(storage), null);
  assert.equal(storage.getItem(STORAGE_KEYS.ERD_LOCAL_DRAFT), null);
});

test('writeErdLocalDraft returns false when storage throws', () => {
  const storage = createMemoryStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.equal(writeErdLocalDraft(storage, VALID_JSON), false);
});

test('parseErdLocalFileText accepts ERD JSON text', () => {
  assert.equal(parseErdLocalFileText(VALID_JSON), VALID_JSON);
});

test('parseErdLocalFileText rejects broken or non-object payloads', () => {
  assert.equal(parseErdLocalFileText('{broken'), null);
  assert.equal(parseErdLocalFileText('[1,2]'), null);
  assert.equal(parseErdLocalFileText('plain text'), null);
});
