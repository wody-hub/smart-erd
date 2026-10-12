# ERD Local Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/erd-local`에서 서버 없이 도메인/용어/단어 직접 등록·수정·삭제 + JSON 파일 저장/열기가 동작하고, 기존 ERD 자동완성·검증·Quick 다이얼로그가 로컬 사전을 그대로 소비한다.

**Architecture:** 서버 타입(`Domain`/`Term`/`Word`)을 그대로 재사용하고 id만 음수(서버 양수와 충돌 불가)로 발급한다. `erdDictionaryData`의 파생맵·검색·해석 로직을 순수 `buildErdDictionaryView`로 추출해 서버 훅과 로컬 Provider가 공유한다. Quick 다이얼로그 2종은 context의 선택적 `localWriter`가 있을 때만 로컬 분기로 동작하고, 없으면 기존 서버 경로 그대로다.

**Tech Stack:** React 19, TypeScript 5.6, Zustand 불필요(로컬 useState), react-i18next, sonner, node --test.

## Global Constraints

- All functions/components/interfaces/state have JSDoc (`@param` + `@returns` for functions, single-line `/** */` for fields/state).
- No hardcoded colors — semantic tokens only.
- No hardcoded UI strings — `t('erdLocalDictionary.*')`, key convention `{domain}.{screen}.{usage}`. `erdLocal.storageFull` 토스트는 재사용한다.
- Toasts via `toast.error(t(...))` / `toast.success(t(...))`; `getErrorMessage(err, t(...))` for caught errors. No inline error text.
- No magic strings — `STORAGE_KEYS.*` for storage keys. Local sentinel ids are negative numbers (see Task 1).
- ESM only, `@/` alias, no `require()`.
- `pages/erd-local/` must never import `api/*` or `stores/useAuthStore` (verified by grep in Task 6).
- Prettier: TS tabWidth 2, printWidth 100, singleQuote.

---

### Task 1: Writer Interface + Storage Key + i18n + Storage Helpers

**Files:**
- Modify: `client/src/types/dictionary.ts`
- Modify: `client/src/constants/storage.ts`
- Modify: `client/src/i18n/locales/ko/translation.json`
- Modify: `client/src/i18n/locales/en/translation.json`
- Create: `client/src/lib/erd-local-dictionary-storage.ts`
- Test: `client/test/unit/erd-local-dictionary-storage.test.ts`

**Interfaces:**
- Consumes: `ErdLocalStorageLike` (`lib/erd-local-storage.ts`), `STORAGE_KEYS` (add `ERD_LOCAL_DICTIONARY`).
- Produces: `ErdDictionaryLocalWriter` (in `types/dictionary.ts`), `STORAGE_KEYS.ERD_LOCAL_DICTIONARY = 'smart-erd-erd-local-dictionary'`, `readErdLocalDictionary(storage): ErdLocalDictionaryFile | null`, `writeErdLocalDictionary(storage, data): boolean`, `parseErdLocalDictionaryFile(text): { ok: true; data } | { ok: false }`, `nextErdLocalId(existingIds: number[]): number`, `ERD_LOCAL_DICTIONARY_FILE_VERSION = 1`.

Local entities reuse server types verbatim: `id` negative (`-1, -2, ...`), `teamId: 0` (local-only sentinel), `dictionarySetId: null`, ISO timestamps. No new entity types.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- erd-local-dictionary-storage`
Expected: FAIL (module not found).

- [ ] **Step 3: Add writer interface to types/dictionary.ts**

Append at end of `client/src/types/dictionary.ts`:

```ts
/**
 * 로컬 사전 쓰기 어댑터 (서버 없는 ERD 로컬 모드용).
 *
 * Quick 다이얼로그가 context에서 이 값을 받으면 서버 API 대신 로컬 저장소에 쓴다.
 */
export interface ErdDictionaryLocalWriter {
  /** 로컬 용어를 생성한다 (음수 id 발급). */
  createTerm: (data: TermFormData) => Term;
  /** 로컬 도메인을 생성한다 (음수 id 발급). */
  createDomain: (data: DomainFormData) => Domain;
  /** 로컬 단어를 생성한다 (음수 id 발급). */
  createWord: (data: WordFormData) => Word;
  /**
   * 키워드와 정확히 일치하는 용어를 찾아 추천 형태로 반환한다.
   *
   * @param keyword 검색 키워드
   * @returns 정확히 일치하는 용어가 있으면 추천, 없으면 null
   */
  suggest: (keyword: string) => SuggestResponse | null;
}
```

`TermFormData` has `wordIds` (form-only, not stored — mirror `termApi.createTerm` which strips it).

- [ ] **Step 4: Add storage key**

In `client/src/constants/storage.ts`, inside `STORAGE_KEYS` after `ERD_LOCAL_DRAFT`:

```ts
  /** 로그인 불필요 ERD 로컬 사전 */
  ERD_LOCAL_DICTIONARY: 'smart-erd-erd-local-dictionary',
```

- [ ] **Step 5: Add i18n keys (ko + en, same keys)**

ko:

```json
"erdLocalDictionary": {
  "manage": "로컬 사전",
  "title": "로컬 사전 관리",
  "domains": "도메인",
  "terms": "용어",
  "words": "단어",
  "create": "추가",
  "edit": "수정",
  "delete": "삭제",
  "deleteTitle": "삭제할까요?",
  "deleteDescription": "선택한 항목을 로컬 사전에서 삭제합니다.",
  "duplicateLogicalName": "이미 등록된 논리명입니다.",
  "saveFile": "사전 파일로 저장",
  "openFile": "사전 파일 열기",
  "importError": "사전 파일을 불러오지 못했습니다. 로컬 사전 JSON 파일인지 확인해주세요.",
  "empty": "등록된 항목이 없습니다.",
  "domainUnlinked": "연결된 도메인이 해제되었습니다."
}
```

en:

```json
"erdLocalDictionary": {
  "manage": "Local dictionary",
  "title": "Manage local dictionary",
  "domains": "Domains",
  "terms": "Terms",
  "words": "Words",
  "create": "Add",
  "edit": "Edit",
  "delete": "Delete",
  "deleteTitle": "Delete this entry?",
  "deleteDescription": "Removes the selected entry from the local dictionary.",
  "duplicateLogicalName": "This logical name is already registered.",
  "saveFile": "Save dictionary to file",
  "openFile": "Open dictionary file",
  "importError": "Could not load the dictionary file. Please check it is a local dictionary JSON file.",
  "empty": "No entries yet.",
  "domainUnlinked": "The linked domain was cleared."
}
```

- [ ] **Step 6: Write storage helpers**

Create `client/src/lib/erd-local-dictionary-storage.ts`:

```ts
import { STORAGE_KEYS } from '@/constants/storage';
import type { ErdLocalStorageLike } from '@/lib/erd-local-storage';
import type { Domain, Term, Word } from '@/types/dictionary';

/** 로컬 사전 파일 형식 버전. */
export const ERD_LOCAL_DICTIONARY_FILE_VERSION = 1;

/** 로컬 사전 파일 페이로드 (서버 타입 재사용, id는 음수). */
export interface ErdLocalDictionaryFile {
  /** 파일 형식 버전 */
  version: number;
  /** 로컬 도메인 목록 */
  domains: Domain[];
  /** 로컬 용어 목록 */
  terms: Term[];
  /** 로컬 단어 목록 */
  words: Word[];
}

/**
 * 로컬 사전 페이로드를 읽는다. 손상됐으면 삭제하고 null을 반환한다.
 *
 * @param storage 읽기 대상 스토리지
 * @returns 저장된 사전, 없거나 손상됐으면 null
 */
export function readErdLocalDictionary(storage: ErdLocalStorageLike): ErdLocalDictionaryFile | null {
  const raw = storage.getItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY);
  if (raw === null) {
    return null;
  }
  const parsed = parseErdLocalDictionaryFile(raw);
  if (!parsed.ok) {
    storage.removeItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY);
    return null;
  }
  return parsed.data;
}

/**
 * 로컬 사전 페이로드를 저장한다.
 *
 * @param storage 저장 대상 스토리지
 * @param data    저장할 사전 페이로드
 * @returns 저장 성공 여부
 */
export function writeErdLocalDictionary(
  storage: ErdLocalStorageLike,
  data: ErdLocalDictionaryFile,
): boolean {
  try {
    storage.setItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 사전 파일 텍스트를 검증한다.
 *
 * 도메인은 `logicalName` 비어 있지 않음 + `physicalType` 비어 있지 않음,
 * 용어/단어는 `logicalName` + `physicalName` 비어 있지 않음을 요구한다.
 *
 * @param text 파일 텍스트
 * @returns 유효하면 `{ ok: true, data }`, 아니면 `{ ok: false }`
 */
export function parseErdLocalDictionaryFile(
  text: string,
): { ok: true; data: ErdLocalDictionaryFile } | { ok: false } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false };
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== ERD_LOCAL_DICTIONARY_FILE_VERSION) {
      return { ok: false };
    }
    if (
      !Array.isArray(record.domains) ||
      !Array.isArray(record.terms) ||
      !Array.isArray(record.words)
    ) {
      return { ok: false };
    }
    if (
      !record.domains.every(isValidDomainRow) ||
      !record.terms.every(isValidTermRow) ||
      !record.words.every(isValidWordRow)
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      data: {
        version: ERD_LOCAL_DICTIONARY_FILE_VERSION,
        domains: record.domains as Domain[],
        terms: record.terms as Term[],
        words: record.words as Word[],
      },
    };
  } catch {
    return { ok: false };
  }
}

/**
 * 다음 로컬 id를 발급한다. 서버 양수 id와 충돌하지 않는 음수를 쓴다.
 *
 * @param existingIds 기존 id 목록
 * @returns 기존 최소값보다 1 작은 음수 (없으면 -1)
 */
export function nextErdLocalId(existingIds: number[]): number {
  if (existingIds.length === 0) {
    return -1;
  }
  return Math.min(0, ...existingIds) - 1;
}

/**
 * 도메인 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidDomainRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.logicalName === 'string' &&
    record.logicalName.trim().length > 0 &&
    typeof record.physicalType === 'string' &&
    record.physicalType.trim().length > 0
  );
}

/**
 * 용어 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidTermRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.logicalName === 'string' &&
    record.logicalName.trim().length > 0 &&
    typeof record.physicalName === 'string' &&
    record.physicalName.trim().length > 0
  );
}

/**
 * 단어 행의 최소 형식을 검증한다.
 *
 * @param row 검사 대상
 * @returns 유효 여부
 */
function isValidWordRow(row: unknown): boolean {
  return isValidTermRow(row);
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test:unit -- erd-local-dictionary-storage`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/types/dictionary.ts client/src/constants/storage.ts client/src/i18n/locales/ko/translation.json client/src/i18n/locales/en/translation.json client/src/lib/erd-local-dictionary-storage.ts client/test/unit/erd-local-dictionary-storage.test.ts
git commit -m "feat: add erd-local dictionary storage helpers and writer contract"
```

---

### Task 2: Extract Pure Dictionary View (Shared Refactor)

**Files:**
- Modify: `client/src/components/erd/erdDictionaryData.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: exported `buildErdDictionaryView(terms: Term[], domains: Domain[], words: Word[])` returning `{ domainMap, termMap, termByNameMap, domainByNameMap, wordMap, wordMatchIndex, searchTerms, findTermById, findDomainById, findWordById, getTermWithType, resolveLogicalName }`. `useErdDictionaryData` return shape unchanged (behavior identical).

This is a pure code move: cut the derivation block (maps, `wordMatchIndex`, `searchTerms`, finders, `getTermWithType`, `resolveLogicalName` with its closure cache) into a plain exported function; the hook calls it inside `useMemo` on `[terms, domains, words]`. No behavior change — existing server pages must work exactly as before.

- [ ] **Step 1: Extract the pure builder**

In `client/src/components/erd/erdDictionaryData.ts`, add above `useErdDictionaryData`:

```ts
/**
 * 사전 파생 뷰(맵·검색·해석 함수 묶음).
 *
 * `useErdDictionaryData`의 반환 중 terms/domains/words·ready 상태를 제외한 순수 파생 부분.
 */
export interface ErdDictionaryView {
  /** 도메인 id → 도메인 */
  domainMap: Map<number, Domain>;
  /** 용어 id → 용어 */
  termMap: Map<number, Term>;
  /** 용어 논리명 → 용어 */
  termByNameMap: Map<string, Term>;
  /** 도메인 논리명 → 도메인 */
  domainByNameMap: Map<string, Domain>;
  /** 단어 id → 단어 */
  wordMap: Map<number, Word>;
  /** 단어 매칭 인덱스 */
  wordMatchIndex: WordMatchIndex;
  /** 용어 검색 (상위 10개) */
  searchTerms: (query: string) => Term[];
  /** 용어 id 조회 */
  findTermById: (termId: number) => Term | undefined;
  /** 도메인 id 조회 */
  findDomainById: (domainId: number) => Domain | undefined;
  /** 단어 id 조회 */
  findWordById: (wordId: number) => Word | undefined;
  /** 용어에 연결 도메인의 물리 타입 첨부 */
  getTermWithType: (term: Term) => TermWithType;
  /** 논리명 해석 */
  resolveLogicalName: (query: string) => LogicalNameResolution;
}
```

`TermWithType` is currently a non-exported interface in the same file — export it too (add `export`). `WordMatchIndex` type: imported from `@/lib/word-composition`? Check the file's imports — `buildWordMatchIndex` is imported; the type must be imported as `import { buildWordMatchIndex, type WordMatchIndex } from '@/lib/word-composition'` (verify and adjust the import line if the type isn't imported yet).

```ts
/**
 * 용어/도메인/단어 배열에서 ERD 소비용 파생 뷰를 만든다 (순수 함수).
 *
 * 서버 훅과 로컬 Provider가 공유한다. `resolveLogicalName`의 해석 캐시는
 * 이 호출 단위로 유지된다 (호출자는 데이터 변경 시에만 다시 호출한다).
 *
 * @param terms   용어 목록
 * @param domains 도메인 목록
 * @param words   단어 목록
 * @returns 파생 뷰
 */
export function buildErdDictionaryView(
  terms: Term[],
  domains: Domain[],
  words: Word[],
): ErdDictionaryView {
  const domainMap = new Map<number, Domain>();
  for (const domain of domains) {
    domainMap.set(domain.id, domain);
  }
  const termMap = new Map<number, Term>();
  for (const term of terms) {
    termMap.set(term.id, term);
  }
  const termByNameMap = new Map<string, Term>();
  for (const term of terms) {
    termByNameMap.set(term.logicalName, term);
  }
  const domainByNameMap = new Map<string, Domain>();
  for (const domain of domains) {
    domainByNameMap.set(domain.logicalName, domain);
  }
  const wordMap = new Map<number, Word>();
  for (const word of words) {
    wordMap.set(word.id, word);
  }
  const wordMatchIndex = buildWordMatchIndex(words);

  /** 용어 검색 (상위 10개). @param query 검색어 @returns 매칭 용어 */
  const searchTerms = (query: string): Term[] => {
    if (!query.trim()) {
      return [];
    }
    const lower = query.toLowerCase();
    return terms
      .filter(
        (term) =>
          term.logicalName.toLowerCase().includes(lower) ||
          term.physicalName.toLowerCase().includes(lower),
      )
      .slice(0, 10);
  };

  /** 용어 id 조회. @param termId 용어 ID @returns 용어 또는 undefined */
  const findTermById = (termId: number): Term | undefined => termMap.get(termId);

  /** 도메인 id 조회. @param domainId 도메인 ID @returns 도메인 또는 undefined */
  const findDomainById = (domainId: number): Domain | undefined => domainMap.get(domainId);

  /** 단어 id 조회. @param wordId 단어 ID @returns 단어 또는 undefined */
  const findWordById = (wordId: number): Word | undefined => wordMap.get(wordId);

  /** 용어에 연결 도메인의 물리 타입 첨부. @param term 용어 @returns 타입 포함 용어 */
  const getTermWithType = (term: Term): TermWithType => {
    const domain = term.domainId ? domainMap.get(term.domainId) : undefined;
    return { ...term, physicalType: domain?.physicalType };
  };

  const resolutionCache = new Map<string, LogicalNameResolution>();
  /** 논리명 해석 (호출 단위 캐시). @param query 논리명 @returns 해석 결과 */
  const resolveLogicalName = (query: string): LogicalNameResolution => {
    const cached = resolutionCache.get(query);
    if (cached) {
      return cached;
    }
    const resolved = resolveLogicalNameFromDictionary(query, {
      termByName: termByNameMap,
      domainById: domainMap,
      wordMatchIndex,
    });
    resolutionCache.set(query, resolved);
    return resolved;
  };

  return {
    domainMap,
    termMap,
    termByNameMap,
    domainByNameMap,
    wordMap,
    wordMatchIndex,
    searchTerms,
    findTermById,
    findDomainById,
    findWordById,
    getTermWithType,
    resolveLogicalName,
  };
}
```

Then replace the hook's derivation block (from `const domainMap = useMemo...` through the `resolveLogicalName` useCallback) with:

```ts
  const view = useMemo(
    () => buildErdDictionaryView(terms, domains, words),
    [terms, domains, words],
  );
```

And update the hook's return to spread the view:

```ts
  return {
    terms,
    domains,
    words,
    isDictionaryReady,
    isDictionaryFetching,
    dictionaryRevision,
    ...view,
  };
```

Remove now-unused imports only if unused (`useCallback` may become unused — check and remove; `resolveLogicalNameFromDictionary`, `LogicalNameResolution`, `buildWordMatchIndex` stay used by the builder).

- [ ] **Step 2: Typecheck + regression tests**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npm run test:unit -- diagram-dictionary-reconciliation dictionary-search-ranking dsl-physical-name-hints`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/erd/erdDictionaryData.ts
git commit -m "refactor: extract pure buildErdDictionaryView shared by server and local"
```

---

### Task 3: Local Store Hook + Provider + Context Wiring

**Files:**
- Create: `client/src/pages/erd-local/useErdLocalDictionary.ts`
- Create: `client/src/pages/erd-local/ErdLocalDictionaryProvider.tsx`
- Modify: `client/src/components/erd/ErdDictionaryContext.tsx`

**Interfaces:**
- Consumes: Task 1 helpers/types, `buildErdDictionaryView` (Task 2).
- Produces: `useErdLocalDictionary()` returning `{ terms, domains, words, revision, createTerm, createDomain, createWord, updateTerm, updateDomain, updateWord, deleteTerm, deleteDomain, deleteWord, replaceAll, resetAll }`, `ErdLocalDictionaryProvider({ children })`, context value gains optional `localWriter?: ErdDictionaryLocalWriter`.

Store shape: `useState<ErdLocalDictionaryFile>` initialized from `readErdLocalDictionary(localStorage) ?? { version: 1, ...empty }`, persisted on every change via `useEffect` + `writeErdLocalDictionary` (failure → `toast.error(t('erdLocal.storageFull'))`).

CRUD rules:
- Create: `nextErdLocalId` for id, `teamId: 0`, `dictionarySetId: null`, ISO timestamps, duplicate `logicalName` (case-sensitive exact) within the same kind → return `null` (caller toasts `erdLocalDictionary.duplicateLogicalName`). Term `domainId` validated against local domains (unknown → null); `domainLogicalName` resolved from domain. `wordIds` ignored (not stored, mirrors server).
- Update: by id, same duplicate rule excluding self, timestamps bumped.
- Delete domain: terms with that `domainId` get `domainId: null, domainLogicalName: null` (caller toasts `erdLocalDictionary.domainUnlinked` when any were unlinked — return count).
- `replaceAll(data)`: swap whole payload (file import path). `resetAll()`: empty payload + removeItem.
- `revision`: `useMemo` counter — incrementing number state bumped on every mutation (`[terms, domains, words]` join is fine too; use a `revision` number state for exactness with server `dictionaryRevision` string shape: `String(revision)`).

Writer (stable via `useMemo` on CRUD fns): `suggest(keyword)`: exact `logicalName` match in terms → `{ physicalName, domainId, domainLogicalName, matches: [{ keyword, matched: true, physicalName, source: null }] }`, else `null`.

- [ ] **Step 1: Write the store hook**

Create `client/src/pages/erd-local/useErdLocalDictionary.ts`. Imports (exact):

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  readErdLocalDictionary,
  writeErdLocalDictionary,
  nextErdLocalId,
} from '@/lib/erd-local-dictionary-storage';
import type { ErdLocalDictionaryFile } from '@/lib/erd-local-dictionary-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import type {
  Domain,
  DomainFormData,
  ErdDictionaryLocalWriter,
  SuggestResponse,
  Term,
  TermFormData,
  Word,
  WordFormData,
} from '@/types/dictionary';
```

Then the `ErdLocalDictionaryMutations` / `ErdLocalDictionaryStore` interfaces and implementation per patterns below.

Key signatures (exact):

```ts
export interface ErdLocalDictionaryMutations {
  /** 로컬 용어 생성 (중복 논리명이면 null). */
  createTerm: (data: TermFormData) => Term | null;
  /** 로컬 도메인 생성 (중복 논리명이면 null). */
  createDomain: (data: DomainFormData) => Domain | null;
  /** 로컬 단어 생성 (중복 논리명이면 null). */
  createWord: (data: WordFormData) => Word | null;
  /** 로컬 용어 수정 (없거나 중복이면 null). */
  updateTerm: (id: number, data: TermFormData) => Term | null;
  /** 로컬 도메인 수정 (없거나 중복이면 null). */
  updateDomain: (id: number, data: DomainFormData) => Domain | null;
  /** 로컬 단어 수정 (없거나 중복이면 null). */
  updateWord: (id: number, data: WordFormData) => Word | null;
  /** 용어 삭제. */
  deleteTerm: (id: number) => void;
  /** 도메인 삭제. @returns 연결 해제된 용어 수 */
  deleteDomain: (id: number) => number;
  /** 단어 삭제. */
  deleteWord: (id: number) => void;
  /** 전체 교체 (파일 열기용). */
  replaceAll: (data: ErdLocalDictionaryFile) => void;
  /** 전체 초기화. */
  resetAll: () => void;
}

export interface ErdLocalDictionaryStore extends ErdLocalDictionaryMutations {
  /** 용어 목록 */
  terms: Term[];
  /** 도메인 목록 */
  domains: Domain[];
  /** 단어 목록 */
  words: Word[];
  /** 변경 revision (문자열) */
  revision: string;
  /** Quick 다이얼로그용 로컬 writer (생성 성공 보장형 — 중복이면 기존 항목 반환). */
  writer: ErdDictionaryLocalWriter;
}
```

`writer.createTerm` never returns null: on duplicate logicalName it returns the existing term (Quick flow continues with the registered term). Same for domain/word.

Core implementation (exact — persistence, id/timestamp factory, delete-unlink, writer):

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { readErdLocalDictionary, writeErdLocalDictionary } from '@/lib/erd-local-dictionary-storage';
import type { ErdLocalDictionaryFile } from '@/lib/erd-local-dictionary-storage';
import { nextErdLocalId } from '@/lib/erd-local-dictionary-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import type {
  Domain,
  DomainFormData,
  ErdDictionaryLocalWriter,
  SuggestResponse,
  Term,
  TermFormData,
  Word,
  WordFormData,
} from '@/types/dictionary';

/** 빈 사전 페이로드. */
const EMPTY_DICTIONARY: ErdLocalDictionaryFile = {
  version: 1,
  domains: [],
  terms: [],
  words: [],
};

/** 로컬 엔티티 공통 필드 (서버 전송 없음 선언). */
function localBaseFields() {
  const now = new Date().toISOString();
  return { teamId: 0, dictionarySetId: null, createdAt: now, updatedAt: now };
}
```

Persistence effect (exact):

```tsx
  const [data, setData] = useState<ErdLocalDictionaryFile>(
    () => readErdLocalDictionary(localStorage) ?? EMPTY_DICTIONARY,
  );
  const [revision, setRevision] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    const ok = writeErdLocalDictionary(localStorage, data);
    if (!ok) {
      toast.error(t('erdLocal.storageFull'));
    }
  }, [data, t]);

  /** 페이로드를 교체하고 revision을 올린다. @param next 다음 페이로드 */
  const commit = useCallback((next: ErdLocalDictionaryFile) => {
    setData(next);
    setRevision((prev) => prev + 1);
  }, []);
```

Representative mutations use a ref mirror (StrictMode-safe; never side-effecting setState updaters). Exact pattern:

```tsx
  /** 동기 읽기용 미러 (setState 비동기성 회피). */
  const dataRef = useRef(data);

  /**
   * 페이로드를 교체하고 미러·revision을 동기화한다.
   *
   * @param next 다음 페이로드
   */
  const commit = useCallback((next: ErdLocalDictionaryFile) => {
    dataRef.current = next;
    setData(next);
    setRevision((prev) => prev + 1);
  }, []);

  const createTerm = useCallback(
    (form: TermFormData): Term | null => {
      const prev = dataRef.current;
      const logicalName = form.logicalName.trim();
      if (prev.terms.some((term) => term.logicalName === logicalName)) {
        return null;
      }
      const domain =
        form.domainId != null ? prev.domains.find((d) => d.id === form.domainId) : undefined;
      const term: Term = {
        id: nextErdLocalId(prev.terms.map((t) => t.id)),
        logicalName,
        physicalName: form.physicalName.trim(),
        description: form.description?.trim() || null,
        domainId: domain ? domain.id : null,
        domainLogicalName: domain ? domain.logicalName : null,
        ...localBaseFields(),
      };
      commit({ ...prev, terms: [...prev.terms, term] });
      return term;
    },
    [commit],
  );

  const deleteDomain = useCallback(
    (id: number): number => {
      const prev = dataRef.current;
      let unlinked = 0;
      const terms = prev.terms.map((term) => {
        if (term.domainId !== id) {
          return term;
        }
        unlinked += 1;
        return { ...term, domainId: null, domainLogicalName: null };
      });
      commit({ ...prev, domains: prev.domains.filter((d) => d.id !== id), terms });
      return unlinked;
    },
    [commit],
  );

  const suggest = useCallback(
    (keyword: string): SuggestResponse | null => {
      const { terms, domains } = dataRef.current;
      const term = terms.find((t) => t.logicalName === keyword.trim());
      if (!term) {
        return null;
      }
      const domain = term.domainId != null ? domains.find((d) => d.id === term.domainId) : undefined;
      return {
        physicalName: term.physicalName,
        domainId: term.domainId,
        domainLogicalName: domain ? domain.logicalName : term.domainLogicalName,
        matches: [
          { keyword: keyword.trim(), matched: true, physicalName: term.physicalName, source: null },
        ],
      };
    },
    [],
  );
```

`createDomain`/`createWord`/`update*`/`deleteTerm`/`deleteWord`/`replaceAll`/`resetAll` mirror these (`resetAll` also calls `localStorage.removeItem(STORAGE_KEYS.ERD_LOCAL_DICTIONARY)` before committing `EMPTY_DICTIONARY`). `writer` memo (duplicates return the existing entry so Quick flow continues):

```tsx
  const writer = useMemo<ErdDictionaryLocalWriter>(
    () => ({
      createTerm: (form) =>
        dataRef.current.terms.find((t) => t.logicalName === form.logicalName.trim()) ??
        (createTerm(form) as Term),
      createDomain: (form) =>
        dataRef.current.domains.find((d) => d.logicalName === form.logicalName.trim()) ??
        (createDomain(form) as Domain),
      createWord: (form) =>
        dataRef.current.words.find((w) => w.logicalName === form.logicalName.trim()) ??
        (createWord(form) as Word),
      suggest,
    }),
    [createTerm, createDomain, createWord, suggest, revision],
  );
```

(`?? (x as Term)` is safe: find-miss implies create succeeds. `SuggestResponse` type import from `@/types/dictionary`.)

- [ ] **Step 2: Extend the shared context (minimal diff)**

In `client/src/components/erd/ErdDictionaryContext.tsx`:
1. Import the writer type: `import type { ErdDictionaryLocalWriter } from '@/types/dictionary';`
2. Extend the value type:

```ts
type ErdDictionaryContextValue = ReturnType<typeof useErdDictionaryData> & {
  /** 팀 ID (non-null 보장) */
  teamId: string;
  /** 사전 세트 ID (non-null 보장) */
  setId: string;
  /** 로컬 사전 writer (로컬 모드에서만 존재) */
  localWriter?: ErdDictionaryLocalWriter;
};
```

3. Export the context object so the local provider can supply the same shape. Change:

```ts
const ErdDictionaryContext = createContext<ErdDictionaryContextValue | null>(null);
```

to:

```ts
// eslint-disable-next-line react-refresh/only-export-components
export const ErdDictionaryContext = createContext<ErdDictionaryContextValue | null>(null);
```

If eslint reports otherwise, keep the disable comment as written (it is the standard suppression for context exports).

- [ ] **Step 3: Write the local provider**

Create `client/src/pages/erd-local/ErdLocalDictionaryProvider.tsx`:

```tsx
import { useMemo, type ReactNode } from 'react';
import { ErdDictionaryContext } from '@/components/erd/ErdDictionaryContext';
import { buildErdDictionaryView } from '@/components/erd/erdDictionaryData';
import { useErdLocalDictionary } from './useErdLocalDictionary';

/** 로컬 사전 스코프 식별자 (context teamId/setId 자리표시자). */
export const ERD_LOCAL_DICTIONARY_SCOPE_ID = 'local';

/** ErdLocalDictionaryProvider props. */
interface ErdLocalDictionaryProviderProps {
  /** 자식 요소 */
  children: ReactNode;
}

/**
 * ERD 로컬 모드용 사전 Provider.
 *
 * 서버 조회 대신 로컬 저장소를 읽어 기존 `useErdDictionary()` 계약과
 * 동일한 모양으로 공급한다. `localWriter`가 있어 Quick 다이얼로그는
 * 서버 대신 로컬 분기로 동작한다.
 *
 * @param props.children 자식 요소
 * @returns Provider JSX
 */
export function ErdLocalDictionaryProvider({ children }: ErdLocalDictionaryProviderProps) {
  const store = useErdLocalDictionary();
  const view = useMemo(
    () => buildErdDictionaryView(store.terms, store.domains, store.words),
    [store.terms, store.domains, store.words],
  );

  const value = useMemo(
    () => ({
      teamId: ERD_LOCAL_DICTIONARY_SCOPE_ID,
      setId: ERD_LOCAL_DICTIONARY_SCOPE_ID,
      terms: store.terms,
      domains: store.domains,
      words: store.words,
      isDictionaryReady: true,
      isDictionaryFetching: false,
      dictionaryRevision: store.revision,
      ...view,
      localWriter: store.writer,
    }),
    [store, view],
  );

  return <ErdDictionaryContext.Provider value={value}>{children}</ErdDictionaryContext.Provider>;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/erd-local/useErdLocalDictionary.ts client/src/pages/erd-local/ErdLocalDictionaryProvider.tsx client/src/components/erd/ErdDictionaryContext.tsx
git commit -m "feat: add erd-local dictionary store and provider"
```

---

### Task 4: Quick Dialog Local Branches

**Files:**
- Modify: `client/src/components/erd/QuickTermDialog.tsx`
- Modify: `client/src/components/erd/QuickDomainDialog.tsx`

**Interfaces:**
- Consumes: `localWriter` from `useErdDictionary()` (Task 3).
- Produces: same component contracts; server path byte-identical behavior when `localWriter` is absent.

`useDictionarySuggest` and `useCreateWordMutation` are hooks — always call them, gate by `enabled`/branch at use site. When `localWriter` exists, no server request may fire (no `createTerm/createDomain/createWord/fetchSuggestion`).

QuickTermDialog edits:
1. Destructure: `const { teamId, setId, domains, words, findDomainById, localWriter } = useErdDictionary();`
2. Suggest hook enabled: `open && composition.isCompleteMatch && !localWriter`.
3. After the hook, resolve: `const suggestion = localWriter ? localWriter.suggest(logicalName.trim()) : remoteSuggestion;` — this requires renaming the hook's `suggestion` to `remoteSuggestion`: `const { suggestion: remoteSuggestion, isLoading: suggestLoading } = useDictionarySuggest(...)`. `suggestLoading` stays from the hook (false when disabled). `hintText = buildSuggestHintText(suggestion, t)` unchanged.
4. `createTermMutation`: branch inside:

```ts
  const createTermMutation = useMutation({
    mutationFn: () => {
      const payload = {
        logicalName: logicalName.trim(),
        physicalName,
        domainId: domainId !== NONE_VALUE ? Number(domainId) : null,
        description: description || undefined,
        wordIds: composition.matchedWordIds,
      };
      if (localWriter) {
        return Promise.resolve(localWriter.createTerm(payload));
      }
      return createTerm(teamId, setId, payload);
    },
    onSuccess: (term) => {
      if (!localWriter) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId, setId) });
      }
      onApply(buildColumnUpdatesFromTerm(term, findDomainById));
      toast.success(t('erd.quickTerm.success'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickTerm.failed'))),
  });
```

5. Word quick-create submit: replace

```ts
        onSubmit={(data) => createWordMutation.mutateAsync(data).then(() => undefined)}
```

with

```ts
        onSubmit={(data) => handleWordSubmit(data)}
```

and add above the return:

```ts
  /**
   * 단어 폼 제출 — 로컬 모드면 로컬 writer로 생성한다.
   *
   * @param data 단어 폼 데이터
   */
  const handleWordSubmit = async (data: WordFormData): Promise<void> => {
    if (localWriter) {
      localWriter.createWord(data);
      toast.success(t('erd.quickTerm.wordCreated'));
      setQuickWordOpen(false);
      setDraftWord(null);
      return;
    }
    await createWordMutation.mutateAsync(data);
  };
```

`WordFormData` type import: add to the existing type import from `@/types/dictionary` (check current import line — it imports `WordFormData` already as `Partial<WordFormData>` is used at line 58; if not imported, extend the import).

QuickDomainDialog edits:
1. Destructure: `const { teamId, setId, localWriter } = useErdDictionary();`
2. `mutation`:

```ts
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        logicalName,
        physicalType,
        description: description || undefined,
      };
      if (localWriter) {
        return Promise.resolve(localWriter.createDomain(payload));
      }
      return createDomain(teamId, setId, payload);
    },
    onSuccess: (domain) => {
      if (!localWriter) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId, setId) });
      }
      toast.success(t('erd.quickDomain.success'));
      onCreated(domain);
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, t('erd.quickDomain.failed'))),
  });
```

`Domain` type import already present (line 20). `logicalName`/`physicalType` raw (not trimmed) matches existing behavior — keep as-is (no behavior change).

- [ ] **Step 1: Apply QuickTermDialog edits**
- [ ] **Step 2: Apply QuickDomainDialog edits**
- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npx eslint src/components/erd/QuickTermDialog.tsx src/components/erd/QuickDomainDialog.tsx src/components/erd/ErdDictionaryContext.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/erd/QuickTermDialog.tsx client/src/components/erd/QuickDomainDialog.tsx
git commit -m "feat: support local dictionary writer in quick dialogs"
```

---

### Task 5: Management UI + Page Wiring

**Files:**
- Create: `client/src/pages/erd-local/ErdLocalTermDialog.tsx`
- Create: `client/src/pages/erd-local/ErdLocalDictionaryDialog.tsx`
- Modify: `client/src/pages/erd-local/ErdLocalPage.tsx`

**Interfaces:**
- Consumes: `useErdLocalDictionary` (Task 3), `ErdLocalDictionaryProvider` (Task 3), `DomainFormDialog`/`WordFormDialog` (pure, `components/dictionary/`), `ConfirmDialog`, `Tabs` (shadcn), `Table` (shadcn).
- Produces: dictionary management dialog + page wiring. `ErdLocalPage` mounts `ErdLocalDictionaryProvider` around the canvas and adds one header button.

`ErdLocalTermDialog` (TermFormDialog is server-bound, so local replacement): named export `export function ErdLocalTermDialog`, props `{ open, onOpenChange, onSubmit: (data: TermFormData) => Promise<void>, initialData?: Term | null, domains: Domain[], words: Word[] }`. Fields: logicalName (required), physicalName (required, prefilled from `analyzeWordComposition(logicalName, buildWordMatchIndex(words))` derived value when complete match and untouched — needs `words` prop too: add `words: Word[]`), domain select (native `<select>` with none option — DomainSearchSelect is pure-props but check its internals before reuse; native select avoids the risk, use native), description. Same Dialog/Input/Label/Button primitives + maxLengths (100/100/500) as QuickTermDialog. JSDoc everything.

`ErdLocalDictionaryDialog`: named export `export function ErdLocalDictionaryDialog`, props `{ open, onOpenChange }`. Uses `useErdLocalDictionary()` directly (it is rendered inside the provider). Tabs (도메인/용어/단어, shadcn `Tabs`): each tab a compact table (논리명/물리명·타입/설명 + 수정/삭제 버튼) + 추가 button + empty state (`erdLocalDictionary.empty`). Create/edit submit handlers call store mutations; `null` return → `toast.error(t('erdLocalDictionary.duplicateLogicalName'))`. Delete → `ConfirmDialog` (`erdLocalDictionary.deleteTitle/description`); domain delete unlinks count > 0 → `toast.info(t('erdLocalDictionary.domainUnlinked'))`. File row: save (`triggerJsonFileDownload`-equivalent inline blob download, filename `erd-local-dictionary.json`) + open (hidden file input, `parseErdLocalDictionaryFile` via `replaceAll`; failure → `erdLocalDictionary.importError` toast, existing kept).

Page wiring in `ErdLocalPage.tsx` (exact diff):

```tsx
import { ErdLocalDictionaryProvider } from './ErdLocalDictionaryProvider';
import { ErdLocalDictionaryDialog } from './ErdLocalDictionaryDialog';
```

```tsx
  /** 로컬 사전 관리 다이얼로그 열림 여부 */
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
```

Header buttons, after the open-file button:

```tsx
          <Button variant="outline" size="sm" onClick={() => setDictionaryOpen(true)}>
            {t('erdLocalDictionary.manage')}
          </Button>
```

Canvas wrap:

```tsx
        <ReactFlowProvider>
          <ErdLocalDictionaryProvider>
            <ErdPermissionProvider canEdit>
              <ERDCanvas diagramName="erd-local" />
            </ErdPermissionProvider>
          </ErdLocalDictionaryProvider>
        </ReactFlowProvider>
```

Dialog render (after the file `<input>`, before `ConfirmDialog`):

```tsx
      <ErdLocalDictionaryDialog open={dictionaryOpen} onOpenChange={setDictionaryOpen} />
```

Update the page JSDoc second line to: `로컬 Y.Doc + localStorage 자동저장 + JSON 파일 저장/열기 + 로컬 사전으로 동작하며` and third line to: `서버·협업 기능은 포함하지 않는다.`

- [ ] **Step 1: Write ErdLocalTermDialog**
- [ ] **Step 2: Write ErdLocalDictionaryDialog**
- [ ] **Step 3: Wire ErdLocalPage**
- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npx eslint src/pages/erd-local/`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/erd-local/ErdLocalTermDialog.tsx client/src/pages/erd-local/ErdLocalDictionaryDialog.tsx client/src/pages/erd-local/ErdLocalPage.tsx
git commit -m "feat: add erd-local dictionary management UI and page wiring"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit -- erd-local-dictionary-storage erd-local-storage erd-local-constants export-quality export-executors diagram-dictionary-reconciliation dictionary-search-ranking`
Expected: all PASS, fail 0.

- [ ] **Step 2: Typecheck + format check**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npx prettier --check "src/pages/erd-local/**/*.{ts,tsx}" "src/lib/erd-local-*.ts" "src/types/dictionary.ts" "src/constants/storage.ts" "src/components/erd/erdDictionaryData.ts" "src/components/erd/ErdDictionaryContext.tsx" "src/components/erd/Quick*.tsx"`
Expected: all pass; else `--write` and re-check.

- [ ] **Step 3: Verify isolation (local + shared)**

Run: `grep -rn "from '@/api/\|from \"@/api/" src/pages/erd-local/ || echo "erd-local isolation ok"`
Expected: `erd-local isolation ok`.

Run: `npm run dev` (background), `curl -s -o /dev/null -w "%{http_code}" http://localhost:4503/erd-local`
Expected: 200. Stop the server afterwards.

- [ ] **Step 4: Manual verification checklist (browser)**

  - 무로그인 `/erd-local` 진입 → 사전 버튼 → 용어/도메인/단어 등록 → localStorage 저장.
  - 컬럼 논리명 입력 시 자동완성·물리명 추천·검증 matched 확인.
  - TableNode Quick 용어 등록 (미등록어) → 로컬 생성, 서버 호출 없음 (네트워크 탭에 `/api/` 요청 없어야 함).
  - 새로고침 후 사전·캔버스 복원.
  - 사전 파일 저장 → 초기화 → 파일 열기 → 복원. 손상 파일 → 토스트, 기존 유지.
  - 도메인 삭제 → 연결 용어 해제 토스트.
  - 기존 팀 ERD 화면 회귀: 사전 CRUD·Quick 다이얼로그 정상 (서버 경로).
