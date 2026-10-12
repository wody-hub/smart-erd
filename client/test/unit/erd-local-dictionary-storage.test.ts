import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERD_LOCAL_DICTIONARY_FILE_VERSION,
  nextErdLocalId,
  parseErdLocalDictionaryFile,
  readErdLocalDictionary,
  writeErdLocalDictionary,
} from '../../src/lib/erd-local-dictionary-storage.js';
import { STORAGE_KEYS } from '../../src/constants/storage.js';
import type { ErdLocalDictionaryFile } from '../../src/lib/erd-local-dictionary-storage.js';

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

/** 최소 유효 로컬 사전 페이로드. */
function validPayload(): ErdLocalDictionaryFile {
  return {
    version: ERD_LOCAL_DICTIONARY_FILE_VERSION,
    domains: [],
    terms: [],
    words: [],
  };
}

test('STORAGE_KEYS exposes local dictionary key', () => {
  assert.equal(STORAGE_KEYS.ERD_LOCAL_DICTIONARY, 'smart-erd-erd-local-dictionary');
});

test('write/read round-trips the dictionary payload', () => {
  const storage = createMemoryStorage();
  assert.equal(writeErdLocalDictionary(storage, validPayload()), true);
  assert.deepEqual(readErdLocalDictionary(storage), validPayload());
});

test('read returns null and drops corrupt payloads', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY, '{broken');
  assert.equal(readErdLocalDictionary(storage), null);
  assert.equal(storage.getItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY), null);
});

test('write returns false when storage throws', () => {
  const storage = createMemoryStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.equal(writeErdLocalDictionary(storage, validPayload()), false);
});

test('parse accepts a valid dictionary file', () => {
  const result = parseErdLocalDictionaryFile(JSON.stringify(validPayload()));
  assert.equal(result.ok, true);
});

test('parse rejects wrong version, missing arrays, and broken JSON', () => {
  assert.equal(parseErdLocalDictionaryFile('{broken').ok, false);
  assert.equal(
    parseErdLocalDictionaryFile(JSON.stringify({ ...validPayload(), version: 999 })).ok,
    false,
  );
  assert.equal(
    parseErdLocalDictionaryFile(JSON.stringify({ ...validPayload(), terms: {} })).ok,
    false,
  );
  assert.equal(
    parseErdLocalDictionaryFile(
      JSON.stringify({
        ...validPayload(),
        terms: [{ id: 1, logicalName: '  ', physicalName: 'x' }],
      }),
    ).ok,
    false,
  );
});

test('nextErdLocalId allocates descending negative ids', () => {
  assert.equal(nextErdLocalId([]), -1);
  assert.equal(nextErdLocalId([-1, -4]), -5);
  assert.equal(nextErdLocalId([3, 7]), -1);
});
