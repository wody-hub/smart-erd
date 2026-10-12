# ERD Local Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 없이 `/erd-local`에서 ERD 편집·localStorage 자동저장·JSON 파일 저장/열기·이미지/PDF/SVG export가 동작한다.

**Architecture:** 단일 빌드 유지, 공개 라우트 1개 추가. `ErdLocalPage`가 로컬 `Y.Doc`을 직접 소유(`initYDoc` + `migrateJsonToYDoc` + `serialize`)하고, `ERDCanvas`는 `provider` 없이 재사용한다 (내부 협업 훅은 canvas-store fallback으로 동작). 서버·사전·협업 모듈 import 금지.

**Tech Stack:** React 19, TypeScript 5.6, @xyflow/react 12, Yjs 13.6, Zustand 5, react-i18next, sonner, node --test.

## Global Constraints

- All functions/components/interfaces/state have JSDoc (`@param` + `@returns` for functions, single-line `/** */` for fields/state).
- No hardcoded colors — semantic tokens only (`bg-card`, `text-foreground`, `border-border`, etc.).
- No hardcoded UI strings — `t('erdLocal.*')` via react-i18next, key convention `{domain}.{screen}.{usage}`.
- Server errors/toasts via `toast.error(getErrorMessage(err, t('erdLocal.*')))`; local failures via `toast.error(t('erdLocal.*'))`. No inline error text.
- No magic strings — route/storage keys via `ROUTES.*` / `STORAGE_KEYS.*`.
- Page code ordering: router hooks → i18n → local state → store selectors → derived → handlers → effects → early return → JSX.
- ESM only, `@/` alias imports, no `require()`.
- `erd-local` files must never import `api/*`, `stores/useAuthStore`, `*-document-session*`, `useTeamRole`, dictionary providers.
- Prettier: TS tabWidth 2, printWidth 100, singleQuote.

---

### Task 1: Route + Storage Constants + i18n Keys

**Files:**
- Modify: `client/src/constants/routes.ts`
- Modify: `client/src/constants/storage.ts`
- Modify: `client/src/i18n/locales/ko/translation.json`
- Modify: `client/src/i18n/locales/en/translation.json`
- Test: `client/test/unit/erd-local-constants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ROUTES.ERD_LOCAL: '/erd-local'`, `STORAGE_KEYS.ERD_LOCAL_DRAFT: 'smart-erd-erd-local-draft'`, `erdLocal.*` i18n keys (ko/en).

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES } from '../../src/constants/routes.js';
import { STORAGE_KEYS } from '../../src/constants/storage.js';

test('ROUTES exposes public ERD local path', () => {
  assert.equal(ROUTES.ERD_LOCAL, '/erd-local');
});

test('STORAGE_KEYS exposes ERD local draft key', () => {
  assert.equal(STORAGE_KEYS.ERD_LOCAL_DRAFT, 'smart-erd-erd-local-draft');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- erd-local-constants`
Expected: FAIL (`ERD_LOCAL` / `ERD_LOCAL_DRAFT` undefined).

- [ ] **Step 3: Add constants**

In `client/src/constants/routes.ts`, inside `ROUTES` after `GUIDE_ENTRY`:

```ts
  /** 로그인 불필요 ERD 단독 편집 페이지 */
  ERD_LOCAL: '/erd-local',
```

In `client/src/constants/storage.ts`, inside `STORAGE_KEYS` after `AI_CHAT_CONVERSATION_PREFIX`:

```ts
  /** 로그인 불필요 ERD 로컬 드래프트 */
  ERD_LOCAL_DRAFT: 'smart-erd-erd-local-draft',
```

- [ ] **Step 4: Add i18n keys (ko + en, same keys)**

In both `client/src/i18n/locales/ko/translation.json` and `en/translation.json`, add top-level object:

```json
"erdLocal": {
  "title": "ERD 로컬 편집",
  "backToGuide": "가이드로 돌아가기",
  "saveFile": "파일로 저장",
  "openFile": "파일 열기",
  "reset": "새로 시작",
  "resetTitle": "새로 시작할까요?",
  "resetDescription": "현재 캔버스 내용과 로컬 저장본이 모두 지워집니다.",
  "importError": "파일을 불러오지 못했습니다. ERD JSON 파일인지 확인해주세요.",
  "storageFull": "브라우저 저장 공간이 부족합니다. 파일로 저장해주세요."
}
```

```json
"erdLocal": {
  "title": "Local ERD Editor",
  "backToGuide": "Back to guide",
  "saveFile": "Save to file",
  "openFile": "Open file",
  "reset": "Start over",
  "resetTitle": "Start over?",
  "resetDescription": "The current canvas and the locally saved draft will be removed.",
  "importError": "Could not load the file. Please check it is an ERD JSON file.",
  "storageFull": "Browser storage is full. Please save to a file."
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- erd-local-constants`
Expected: PASS.

- [ ] **Step 6: Verify i18n keys present in both locales**

Run: `python3 -c "import json; [json.load(open(f'src/i18n/locales/{l}/translation.json'))['erdLocal']['title'] for l in ['ko','en']]; print('erdLocal keys ok')"`
Expected: prints `erdLocal keys ok`.

- [ ] **Step 7: Commit**

```bash
git add client/src/constants/routes.ts client/src/constants/storage.ts client/src/i18n/locales/ko/translation.json client/src/i18n/locales/en/translation.json client/test/unit/erd-local-constants.test.ts
git commit -m "feat: add erd-local route, storage, and i18n constants"
```

---

### Task 2: Pure Local Persistence Helpers

**Files:**
- Create: `client/src/lib/erd-local-storage.ts`
- Test: `client/test/unit/erd-local-storage.test.ts`

**Interfaces:**
- Consumes: `STORAGE_KEYS.ERD_LOCAL_DRAFT` (Task 1).
- Produces: `ErdLocalStorageLike` interface, `readErdLocalDraft(storage): string | null`, `writeErdLocalDraft(storage, json): boolean`, `parseErdLocalFileText(text): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- erd-local-storage`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `client/src/lib/erd-local-storage.ts`:

```ts
import { STORAGE_KEYS } from '@/constants/storage';

/** localStorage와 호환되는 최소 스토리지 인터페이스 (테스트 주입용). */
export interface ErdLocalStorageLike {
  /** 키로 값을 조회한다. 없으면 null을 반환한다. */
  getItem: (key: string) => string | null;
  /** 키에 값을 저장한다. 용량 초과 시 예외를 던질 수 있다. */
  setItem: (key: string, value: string) => void;
  /** 키의 값을 삭제한다. */
  removeItem: (key: string) => void;
}

/**
 * 로컬 드래프트 JSON을 읽는다.
 *
 * 저장된 값이 손상된 JSON이면 삭제하고 null을 반환한다.
 *
 * @param storage 읽기 대상 스토리지
 * @returns 저장된 드래프트 JSON, 없거나 손상됐으면 null
 */
export function readErdLocalDraft(storage: ErdLocalStorageLike): string | null {
  const raw = storage.getItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
  if (raw === null) {
    return null;
  }
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    storage.removeItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
    return null;
  }
}

/**
 * 로컬 드래프트 JSON을 저장한다.
 *
 * @param storage 저장 대상 스토리지
 * @param json    `serialize()` 결과 JSON 문자열
 * @returns 저장 성공 여부 (용량 초과 등 실패 시 false)
 */
export function writeErdLocalDraft(storage: ErdLocalStorageLike, json: string): boolean {
  try {
    storage.setItem(STORAGE_KEYS.ERD_LOCAL_DRAFT, json);
    return true;
  } catch {
    return false;
  }
}

/**
 * 사용자가 연 파일 텍스트를 ERD JSON으로 검증한다.
 *
 * @param text 파일 텍스트
 * @returns 유효한 ERD JSON이면 원문, 아니면 null
 */
export function parseErdLocalFileText(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- erd-local-storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/erd-local-storage.ts client/test/unit/erd-local-storage.test.ts
git commit -m "feat: add pure erd-local draft storage helpers"
```

---

### Task 3: Y.Doc Lifecycle + Autosave Hook

**Files:**
- Create: `client/src/pages/erd-local/useErdLocalPersistence.ts`

**Interfaces:**
- Consumes: `readErdLocalDraft` / `writeErdLocalDraft` / `parseErdLocalFileText` (Task 2), `useCanvasStore.initYDoc/destroyYDoc/serialize` (`stores/useCanvasStore.ts`), `migrateJsonToYDoc` (`collaboration/yjsBridge.ts`).
- Produces: `useErdLocalPersistence()` returning `{ exportFile, importFileText, resetAll }`.

Hook owns: `new Y.Doc()` 생성 → `initYDoc(doc)` → 드래프트 있으면 `migrateJsonToYDoc(doc, draft, 'erd-local-bootstrap')` → 5초 간격 autosave (`serialize()`가 마지막 저장값과 다를 때만 기록) → `beforeunload` 저장 → 언마운트 시 `destroyYDoc()` + `doc.destroy()`. 실패 시 `t('erdLocal.storageFull')` 토스트. React 훅이라 node 단위테스트 불가 — tsc + 수동 검증으로 커버한다.

- [ ] **Step 1: Write the hook**

Create `client/src/pages/erd-local/useErdLocalPersistence.ts`:

```tsx
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as Y from 'yjs';
import useCanvasStore from '@/stores/useCanvasStore';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import {
  parseErdLocalFileText,
  readErdLocalDraft,
  writeErdLocalDraft,
} from '@/lib/erd-local-storage';
import { getErrorMessage } from '@/lib/api-error';

/** 로컬 Y.Doc bootstrap 트랜잭션 origin. */
const ERD_LOCAL_BOOTSTRAP_ORIGIN = 'erd-local-bootstrap';
/** autosave 간격 (ms). */
const ERD_LOCAL_AUTOSAVE_INTERVAL_MS = 5000;
/** 파일 다운로드용 기본 파일명. */
const ERD_LOCAL_FILE_NAME = 'erd-local.json';

/** 파일 다운로드를 트리거하는 결과. */
interface ErdLocalFileTrigger {
  /** 다운로드한 파일명 */
  filename: string;
}

/**
 * 현재 캔버스 JSON을 파일로 다운로드한다.
 *
 * @param filename 다운로드 파일명
 * @param json     저장할 JSON 문자열
 * @returns 다운로드 결과
 */
function triggerJsonFileDownload(filename: string, json: string): ErdLocalFileTrigger {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename };
}

/**
 * ERD 로컬 모드의 Y.Doc 생명주기와 자동저장을 관리하는 훅.
 *
 * 마운트 시 로컬 Y.Doc을 생성하고 저장된 드래프트를 복원하며,
 * 5초 간격 + 탭 종료 시점에 변경분을 localStorage에 저장한다.
 *
 * @returns exportFile(파일 저장), importFileText(파일 열기), resetAll(초기화)
 */
export function useErdLocalPersistence() {
  const { t } = useTranslation();
  /** 마지막으로 저장한 직렬화 문자열 (불필요한 쓰기 방지용) */
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    useCanvasStore.getState().initYDoc(doc);
    const draft = readErdLocalDraft(localStorage);
    if (draft !== null) {
      migrateJsonToYDoc(doc, draft, ERD_LOCAL_BOOTSTRAP_ORIGIN);
    }
    lastSavedRef.current = useCanvasStore.getState().serialize();

    /** 변경분이 있으면 localStorage에 저장한다. @returns 없음 */
    const saveIfDirty = () => {
      const json = useCanvasStore.getState().serialize();
      if (json === lastSavedRef.current) {
        return;
      }
      const ok = writeErdLocalDraft(localStorage, json);
      if (ok) {
        lastSavedRef.current = json;
      } else {
        toast.error(t('erdLocal.storageFull'));
      }
    };

    const intervalId = window.setInterval(saveIfDirty, ERD_LOCAL_AUTOSAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', saveIfDirty);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', saveIfDirty);
      saveIfDirty();
      useCanvasStore.getState().destroyYDoc();
      doc.destroy();
    };
  }, [t]);

  /** 현재 캔버스를 JSON 파일로 다운로드한다. */
  const exportFile = useCallback(() => {
    const json = useCanvasStore.getState().serialize();
    triggerJsonFileDownload(ERD_LOCAL_FILE_NAME, json);
    const ok = writeErdLocalDraft(localStorage, json);
    if (ok) {
      lastSavedRef.current = json;
    }
  }, []);

  /**
   * 파일 텍스트를 검증하고 캔버스에 반영한다.
   *
   * @param text 사용자가 연 파일의 텍스트
   * @returns 반영 성공 여부
   */
  const importFileText = useCallback(
    (text: string): boolean => {
      const json = parseErdLocalFileText(text);
      if (json === null) {
        toast.error(t('erdLocal.importError'));
        return false;
      }
      try {
        const doc = new Y.Doc();
        useCanvasStore.getState().destroyYDoc();
        useCanvasStore.getState().initYDoc(doc);
        migrateJsonToYDoc(doc, json, ERD_LOCAL_BOOTSTRAP_ORIGIN);
        const ok = writeErdLocalDraft(localStorage, json);
        if (ok) {
          lastSavedRef.current = json;
        }
        return true;
      } catch (err) {
        toast.error(getErrorMessage(err, t('erdLocal.importError')));
        return false;
      }
    },
    [t],
  );

  /** 캔버스와 로컬 저장본을 모두 비운다. */
  const resetAll = useCallback(() => {
    const doc = new Y.Doc();
    useCanvasStore.getState().destroyYDoc();
    useCanvasStore.getState().initYDoc(doc);
    localStorage.removeItem('smart-erd-erd-local-draft');
    lastSavedRef.current = useCanvasStore.getState().serialize();
  }, []);

  return { exportFile, importFileText, resetAll };
}
```

Note: `localStorage.removeItem('smart-erd-erd-local-draft')` must use the constant — replace with `STORAGE_KEYS.ERD_LOCAL_DRAFT` via import. Final file must import `STORAGE_KEYS` from `@/constants/storage` and use it in `resetAll` (no magic strings).

- [ ] **Step 2: Fix the magic string**

In the created file, add import and replace the literal:

```tsx
import { STORAGE_KEYS } from '@/constants/storage';
```

```tsx
    localStorage.removeItem(STORAGE_KEYS.ERD_LOCAL_DRAFT);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/erd-local/useErdLocalPersistence.ts
git commit -m "feat: add erd-local Y.Doc lifecycle and autosave hook"
```

---

### Task 4: ErdLocalPage + Public Route

**Files:**
- Create: `client/src/pages/erd-local/ErdLocalPage.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `ROUTES.ERD_LOCAL` (Task 1), `useErdLocalPersistence` (Task 3), `ERDCanvas` (`components/erd/ERDCanvas.tsx`, props `diagramName?/canEdit?`), `ErdPermissionProvider` (`components/erd/ErdPermissionContext.tsx`), `ConfirmDialog`, `Button`, `ReactFlowProvider` (`@xyflow/react`).
- Produces: default-exported `ErdLocalPage`, public route `/erd-local` (웹 + Electron 미설정 분기 포함).

Page ordering: router hooks (`useNavigate`) → i18n (`useTranslation`) → local state (reset dialog, file input ref) → store selectors (없음 — hook이 소유) → handlers → JSX. `ERDCanvas`는 `useReactFlow()`를 쓰므로 반드시 `ReactFlowProvider` 안에서 렌더한다. `provider` 미전달(협업 없음), 엑셀 핸들러 미전달(서버 없음). 상단 바는 `bg-card/border-border` 토큰 + `Button` 사용.

- [ ] **Step 1: Write the page**

Create `client/src/pages/erd-local/ErdLocalPage.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ERDCanvas from '@/components/erd/ERDCanvas';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { ROUTES } from '@/constants/routes';
import { useErdLocalPersistence } from './useErdLocalPersistence';

/** 파일 입력 accept 속성값. */
const ERD_LOCAL_FILE_ACCEPT = '.json,application/json';

/**
 * 로그인 불필요 ERD 단독 편집 페이지.
 *
 * 로컬 Y.Doc + localStorage 자동저장 + JSON 파일 저장/열기로 동작하며
 * 서버·사전·협업 기능은 포함하지 않는다.
 *
 * @returns ERD 로컬 페이지 JSX
 */
export default function ErdLocalPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** 새로 시작 확인 다이얼로그 열림 여부 */
  const [resetOpen, setResetOpen] = useState(false);
  /** 숨겨진 파일 입력 참조 */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { exportFile, importFileText, resetAll } = useErdLocalPersistence();

  /** 파일 열기 버튼 클릭 시 숨겨진 입력을 연다. */
  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 선택된 파일을 읽어 캔버스에 반영한다.
   *
   * @param event 파일 입력 변경 이벤트
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    void file.text().then((text) => {
      importFileText(text);
    });
  };

  /** 새로 시작을 확정한다. */
  const handleConfirmReset = () => {
    resetAll();
    setResetOpen(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.GUIDE)}>
          {t('erdLocal.backToGuide')}
        </Button>
        <h1 className="text-sm font-semibold">{t('erdLocal.title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportFile}>
            {t('erdLocal.saveFile')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenFileClick}>
            {t('erdLocal.openFile')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            {t('erdLocal.reset')}
          </Button>
        </div>
      </header>
      <div className="relative flex-1">
        <ReactFlowProvider>
          <ErdPermissionProvider canEdit>
            <ERDCanvas diagramName="erd-local" />
          </ErdPermissionProvider>
        </ReactFlowProvider>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ERD_LOCAL_FILE_ACCEPT}
        className="hidden"
        aria-label={t('erdLocal.openFile')}
        onChange={handleFileChange}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('erdLocal.resetTitle')}
        description={t('erdLocal.resetDescription')}
        confirmLabel={t('erdLocal.reset')}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
```

Note: `Link` is imported but unused — remove that import in the final file (keep only `useNavigate` from react-router-dom). `navigate(ROUTES.GUIDE)` keeps the back action consistent with app routing.

- [ ] **Step 2: Remove the unused import**

Final file must have exactly one react-router-dom import:

```tsx
import { useNavigate } from 'react-router-dom';
```

No `Link` import.

- [ ] **Step 3: Register the public route in App.tsx**

Add lazy import after `GuidePage`:

```tsx
const ErdLocalPage = lazy(() => import('./pages/erd-local/ErdLocalPage'));
```

Add public route after the GUIDE route (main branch):

```tsx
              <Route path={ROUTES.ERD_LOCAL} element={<ErdLocalPage />} />
```

And in the `needsServerSetup` (Electron) branch after GUIDE:

```tsx
              <Route path={ROUTES.ERD_LOCAL} element={<ErdLocalPage />} />
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npx eslint src/pages/erd-local/ src/App.tsx src/constants/routes.ts src/constants/storage.ts src/lib/erd-local-storage.ts`
Expected: no errors.

- [ ] **Step 5: Manual verification (dev server)**

Run: `npm run dev`, then check each item:
  - 무로그인 `/erd-local` 진입 가능 (로그인 리다이렉트 없음).
  - 테이블 추가 → FK 연결 → undo/redo 동작.
  - 새로고침 후 캔버스 복원 (localStorage).
  - 파일로 저장 → JSON 다운로드 → 새로 시작 → 파일 열기 → 복원.
  - 손상된 파일 열기 → `erdLocal.importError` 토스트, 기존 캔버스 유지.
  - PNG/PDF/SVG export 동작.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/erd-local/ErdLocalPage.tsx client/src/App.tsx
git commit -m "feat: add public erd-local standalone editor page"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run affected unit tests**

Run: `npm run test:unit -- erd-local-constants erd-local-storage export-quality export-executors`
Expected: all PASS, fail 0.

- [ ] **Step 2: Typecheck + format check**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0.

Run: `npx prettier --check "src/pages/erd-local/**/*.{ts,tsx}" "src/lib/erd-local-storage.ts" "src/constants/*.ts" "src/App.tsx"`
Expected: all files pass; if not, run `npx prettier --write` on listed files and re-check.

- [ ] **Step 3: Verify no forbidden imports in erd-local**

Run: `grep -rn "api/\|useAuthStore\|document-session\|useTeamRole\|dictionary" src/pages/erd-local/ || echo "erd-local isolation ok"`
Expected: prints `erd-local isolation ok`.
