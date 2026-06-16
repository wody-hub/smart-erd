# ERD Code Mode Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ERD code-first DSL autocomplete reliably appear while typing and when the user presses `Ctrl+Space`.

**Architecture:** Treat the custom DSL assist popup as the product autocomplete surface. Add a browser-level regression test around Monaco in code-first mode, then stabilize popup callbacks and timers so React parsing/render cycles do not tear down active keyboard handlers or scheduled auto-open timers. Register a Monaco command for manual autocomplete and keep the current `onKeyDown` path as a fallback.

**Tech Stack:** React 19, TypeScript, Monaco via `@monaco-editor/react`, Playwright E2E, `node:test` unit test runner, Vite.

---

## File Structure

- Create `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`
  - End-to-end regression for code-first DSL autocomplete.
  - Covers `Ctrl+Space`, idle typing popup, visible option content, and popup stability after a short wait.
- Modify `client/src/hooks/useAssistPopup.ts`
  - Keep latest completion builder and execution callbacks in refs.
  - Keep `openAssistPopup` and `executeAssistPopupItem` stable across parser result changes.
  - Add a Monaco `addAction` binding for `Ctrl+Space` / `Cmd+Space`, plus Mac control fallback when Monaco exposes `WinCtrl`.
- Modify `client/src/hooks/useIdleCursorAction.ts`
  - Keep latest `openAssistPopup`, `closeAssistPopup`, and `isSyncing` callbacks in a ref.
  - Prevent scheduled idle autocomplete timers from being cleared solely because React recreated callback identities.
- Test with `cd client && npm run test:unit`
- Test with `cd client && npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0`

## Relevant Existing Code

- Code-first mode forces the DSL editor: `client/src/lib/diagram-work-mode.ts`
- The code panel renders `DslCodeEditorPanel`: `client/src/components/erd/DdlCodeEditorPanel.tsx`
- DSL assist items are built in `client/src/hooks/useDslEditorCompletion.ts`
- Popup UI renders as `role="listbox"` in `client/src/components/erd/DslAssistPopup.tsx`
- Popup state and key handling live in `client/src/hooks/useAssistPopup.ts`
- Idle typing/focus/hover popup scheduling lives in `client/src/hooks/useIdleCursorAction.ts`

---

### Task 1: Add E2E Regression For DSL Assist Popup

**Files:**
- Create: `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`

- [ ] **Step 1: Write the failing Playwright test**

Create `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts` with this complete content:

```ts
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
  waitForMonacoModelValueContains,
} from '../shared/diagram-e2e';

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response =
    method === 'GET'
      ? await request.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ko',
          },
        })
      : method === 'POST'
        ? await request.post(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': 'ko',
              'Content-Type': 'application/json',
            },
            data: body,
          })
        : await request.put(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': 'ko',
              'Content-Type': 'application/json',
            },
            data: body,
          });

  if (!response.ok()) {
    throw new Error(`Request failed ${response.status()} for ${url}`);
  }

  if (response.status() === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function switchWorkMode(page: Page, label: RegExp): Promise<void> {
  await page.getByRole('combobox', { name: /작업 모드|work mode/i }).click();
  await page.getByRole('option', { name: label }).click();
}

async function seedDslEditor(page: Page, text: string): Promise<void> {
  await page.evaluate((nextText) => {
    const editor = window.monaco?.editor?.getEditors?.()[0];
    const model = editor?.getModel();
    if (!editor || !model) {
      throw new Error('Monaco editor not found');
    }

    model.setValue(nextText);
    const lineNumber = model.getLineCount();
    const column = model.getLineMaxColumn(lineNumber);
    editor.setPosition({ lineNumber, column });
    editor.focus();
  }, text);
}

async function provisionDictionaryTerms(
  request: APIRequestContext,
  apiBaseUrl: string,
  teamId: number,
  token: string,
): Promise<void> {
  const dictionarySets = await apiJson<DictionarySetSummary[]>(
    request,
    'GET',
    `${apiBaseUrl}/teams/${teamId}/dictionary-sets`,
    token,
  );
  const dictionarySetId =
    dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;
  if (!dictionarySetId) {
    throw new Error('Dictionary set was not provisioned');
  }

  for (const word of [
    { logicalName: '사용자', physicalName: 'user' },
    { logicalName: '식별자', physicalName: 'id' },
    { logicalName: '주문', physicalName: 'order' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${apiBaseUrl}/teams/${teamId}/dictionary-sets/${dictionarySetId}/words`,
      token,
      word,
    );
  }

  for (const term of [
    { logicalName: '사용자', physicalName: 'user' },
    { logicalName: '사용자 식별자', physicalName: 'user_id' },
    { logicalName: '주문', physicalName: 'order' },
  ]) {
    await apiJson(
      request,
      'POST',
      `${apiBaseUrl}/teams/${teamId}/dictionary-sets/${dictionarySetId}/terms`,
      token,
      term,
    );
  }
}

test('code-first DSL autocomplete opens via Ctrl+Space and idle typing @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });

  await provisionDictionaryTerms(request, config.apiBaseUrl, fixture.target.teamId, token);

  await apiJson<void>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    token,
    {
      content: JSON.stringify({
        nodes: [
          {
            id: 'table-users',
            type: 'table',
            position: { x: 180, y: 120 },
            data: {
              label: 'users',
              logicalTableName: '사용자',
              columns: [
                {
                  id: 'col-users-id',
                  logicalName: '사용자 식별자',
                  name: 'user_id',
                  type: 'BIGINT',
                  nullable: false,
                  pk: true,
                },
              ],
            },
          },
        ],
        edges: [],
        groups: [],
      }),
    },
  );

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);
  await switchWorkMode(page, /코드 우선|code-first/i);
  await waitForMonacoModelValueContains(page, 'Table');

  await seedDslEditor(page, 'Table 사');
  await page.keyboard.press('Control+Space');

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('option', { name: /사용자/ })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(listbox).toHaveCount(0);

  await seedDslEditor(page, 'Table ');
  await page.keyboard.type('사');

  await expect(listbox).toBeVisible({ timeout: 2_500 });
  await expect(page.getByRole('option', { name: /사용자/ })).toBeVisible();

  await page.waitForTimeout(400);
  await expect(listbox).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E test to verify current failure**

Run:

```bash
cd client && npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0
```

Expected: FAIL before implementation. The failure should be one of:

```text
Timed out ... waiting for getByRole('listbox') to be visible
```

or:

```text
Timed out ... waiting for getByRole('option', { name: /사용자/ }) to be visible
```

If the test passes on the first run, run it five times to check for the reported intermittent behavior:

```bash
cd client && for i in 1 2 3 4 5; do npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0 || exit 1; done
```

Expected in the flaky case: at least one run fails before the implementation.

---

### Task 2: Stabilize Assist Popup Callback Identities

**Files:**
- Modify: `client/src/hooks/useAssistPopup.ts`
- Test: `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`

- [ ] **Step 1: Add refs for latest builder and callbacks**

In `client/src/hooks/useAssistPopup.ts`, after `assistPopupListRef` is declared, insert this code:

```ts
  /** 최신 자동완성 빌더를 안정 콜백에서 참조한다. */
  const buildAssistItemsRef = useRef(buildAssistItems);
  /** 최신 외부 콜백을 안정 콜백에서 참조한다. */
  const callbacksRef = useRef({
    getCurrentText,
    onSyncInsertedText,
    onRegisterTerm,
    onRegisterDomain,
  });

  useEffect(() => {
    buildAssistItemsRef.current = buildAssistItems;
  }, [buildAssistItems]);

  useEffect(() => {
    callbacksRef.current = {
      getCurrentText,
      onSyncInsertedText,
      onRegisterTerm,
      onRegisterDomain,
    };
  }, [getCurrentText, onRegisterDomain, onRegisterTerm, onSyncInsertedText]);
```

- [ ] **Step 2: Read completions through the ref**

In `openAssistPopup`, replace this block:

```ts
      const items = filterAssistItemsForTrigger(
        buildAssistItems(model, position, true, trigger),
        trigger,
      );
```

with:

```ts
      const items = filterAssistItemsForTrigger(
        buildAssistItemsRef.current(model, position, true, trigger),
        trigger,
      );
```

Then change the `openAssistPopup` dependency list from:

```ts
    [buildAssistItems, closeAssistPopup, editorRef, setAssistPopupSync],
```

to:

```ts
    [closeAssistPopup, editorRef, setAssistPopupSync],
```

- [ ] **Step 3: Read execution callbacks through the ref**

In `executeAssistPopupItem`, replace the full function body with this body:

```ts
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const callbacks = callbacksRef.current;
      if (!editor) {
        return;
      }

      if (item.type === 'registerTerm') {
        closeAssistPopup();
        callbacks.onRegisterTerm(item.name ?? '', item.lineNumber);
        return;
      }
      if (item.type === 'registerDomain') {
        closeAssistPopup();
        callbacks.onRegisterDomain(item.name ?? '');
        return;
      }

      if (!monaco || !item.insertText) {
        return;
      }
      const insertText = item.insertText;
      editor.executeEdits('dsl-assist', [
        {
          range: new monaco.Range(
            item.lineNumber,
            item.startColumn,
            item.lineNumber,
            item.endColumn,
          ),
          text: insertText,
          forceMoveMarkers: true,
        },
      ]);
      const nextModelText = editor.getModel()?.getValue();
      if (nextModelText != null) {
        queueMicrotask(() => {
          const latestCallbacks = callbacksRef.current;
          if (
            latestCallbacks.getCurrentText &&
            latestCallbacks.onSyncInsertedText &&
            latestCallbacks.getCurrentText() !== nextModelText
          ) {
            latestCallbacks.onSyncInsertedText(nextModelText);
          }
        });
      }
      editor.focus();
      closeAssistPopup();
```

Change the `executeAssistPopupItem` dependency list to:

```ts
    [closeAssistPopup, editorRef, monacoRef],
```

- [ ] **Step 4: Run TypeScript and unit tests**

Run:

```bash
cd client && npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Run the autocomplete E2E test**

Run:

```bash
cd client && npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0
```

Expected after this task: the idle typing half may pass more often, but `Ctrl+Space` can still fail if Monaco/browser key handling consumes the shortcut.

---

### Task 3: Register Manual Autocomplete As A Monaco Command

**Files:**
- Modify: `client/src/hooks/useAssistPopup.ts`
- Test: `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`

- [ ] **Step 1: Add a Monaco action for manual popup open**

In the effect that creates `dslAssistPopupVisible`, after this line:

```ts
    assistPopupVisibleKeyRef.current.set(Boolean(assistPopupRef.current));
```

insert:

```ts
    const keyModWithWinCtrl = monaco.KeyMod as typeof monaco.KeyMod & { WinCtrl?: number };
    const manualOpenKeybindings = [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space];
    if (typeof keyModWithWinCtrl.WinCtrl === 'number') {
      manualOpenKeybindings.push(keyModWithWinCtrl.WinCtrl | monaco.KeyCode.Space);
    }
```

Then add this action as the first entry of the `disposables` array:

```ts
      editor.addAction({
        id: 'dsl-assist-popup-open',
        label: 'DSL Assist Popup Open',
        keybindings: manualOpenKeybindings,
        run: () => openAssistPopup({ trigger: 'manual' }),
      }),
```

The `disposables` declaration should begin like this:

```ts
    const disposables: Monaco.IDisposable[] = [
      editor.addAction({
        id: 'dsl-assist-popup-open',
        label: 'DSL Assist Popup Open',
        keybindings: manualOpenKeybindings,
        run: () => openAssistPopup({ trigger: 'manual' }),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-up',
        label: 'DSL Assist Popup Up',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.UpArrow],
        run: () => moveSelection(-1),
      }),
```

- [ ] **Step 2: Update the Monaco action effect dependencies**

Change the effect dependency list from:

```ts
  }, [
    canEdit,
    closeAssistPopup,
    editorRef,
    executeAssistPopupItem,
    monacoRef,
    setAssistPopupSelectedIndex,
  ]);
```

to:

```ts
  }, [
    canEdit,
    closeAssistPopup,
    editorRef,
    executeAssistPopupItem,
    monacoRef,
    openAssistPopup,
    setAssistPopupSelectedIndex,
  ]);
```

- [ ] **Step 3: Keep the existing `onKeyDown` fallback**

Leave this existing branch in place:

```ts
      const isCtrlSpace =
        event.keyCode === monaco.KeyCode.Space && (browserEvent.ctrlKey || browserEvent.metaKey);
      if (isCtrlSpace) {
        consume();
        openAssistPopup({ trigger: 'manual' });
        return;
      }
```

This fallback keeps behavior for environments where Monaco command dispatch does not receive the browser shortcut.

- [ ] **Step 4: Run TypeScript and unit tests**

Run:

```bash
cd client && npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Run the focused E2E test**

Run:

```bash
cd client && npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0
```

Expected: PASS for the `Ctrl+Space` assertion.

---

### Task 4: Prevent Idle Autocomplete Timer Reset On React Renders

**Files:**
- Modify: `client/src/hooks/useIdleCursorAction.ts`
- Test: `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`

- [ ] **Step 1: Store latest callbacks in a ref**

In `client/src/hooks/useIdleCursorAction.ts`, after `suppressHoverUntilMoveRef` is declared, insert:

```ts
  /** 최신 외부 콜백을 이벤트 리스너와 타이머에서 참조한다. */
  const callbacksRef = useRef({
    openAssistPopup,
    closeAssistPopup,
    isSyncing,
  });

  useEffect(() => {
    callbacksRef.current = {
      openAssistPopup,
      closeAssistPopup,
      isSyncing,
    };
  }, [closeAssistPopup, isSyncing, openAssistPopup]);
```

- [ ] **Step 2: Use the ref inside the effect**

Replace each call inside the main `useEffect` as follows:

```ts
      callbacksRef.current.closeAssistPopup();
```

for every current `closeAssistPopup()` call.

Replace:

```ts
          openAssistPopup({ position: current.position, trigger });
```

with:

```ts
          callbacksRef.current.openAssistPopup({ position: current.position, trigger });
```

Replace:

```ts
        openAssistPopup({ position: currentPos, trigger });
```

with:

```ts
        callbacksRef.current.openAssistPopup({ position: currentPos, trigger });
```

Replace:

```ts
      if (isSyncing()) {
```

with:

```ts
      if (callbacksRef.current.isSyncing()) {
```

- [ ] **Step 3: Narrow the main effect dependencies**

Change the main `useEffect` dependency list from:

```ts
  }, [canEdit, clearAutoAssistTimer, closeAssistPopup, editorRef, isSyncing, openAssistPopup]);
```

to:

```ts
  }, [canEdit, clearAutoAssistTimer, editorRef]);
```

- [ ] **Step 4: Run TypeScript and unit tests**

Run:

```bash
cd client && npm run test:unit
```

Expected: PASS.

- [ ] **Step 5: Run the focused E2E test five times**

Run:

```bash
cd client && for i in 1 2 3 4 5; do npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0 || exit 1; done
```

Expected: PASS five consecutive runs.

---

### Task 5: Cleanup, Full Verification, And Commit

**Files:**
- Verify: `client/src/hooks/useAssistPopup.ts`
- Verify: `client/src/hooks/useIdleCursorAction.ts`
- Verify: `client/e2e/smoke/diagram-dsl-autocomplete.spec.ts`

- [ ] **Step 1: Search for temporary debug instrumentation**

Run:

```bash
rg -n "\\[DEBUG-|console\\.log|debugger" client/src/hooks/useAssistPopup.ts client/src/hooks/useIdleCursorAction.ts client/e2e/smoke/diagram-dsl-autocomplete.spec.ts
```

Expected: no output.

- [ ] **Step 2: Run frontend unit tests**

Run:

```bash
cd client && npm run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run focused autocomplete E2E**

Run:

```bash
cd client && npx playwright test e2e/smoke/diagram-dsl-autocomplete.spec.ts --browser=chromium --workers=1 --retries=0
```

Expected: PASS.

- [ ] **Step 4: Run adjacent code editor E2E checks**

Run:

```bash
cd client && npx playwright test e2e/smoke/diagram-code-editor-refresh-guard.spec.ts e2e/smoke/diagram-table-to-code-navigation.spec.ts --browser=chromium --workers=1 --retries=0
```

Expected: PASS.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- client/src/hooks/useAssistPopup.ts client/src/hooks/useIdleCursorAction.ts client/e2e/smoke/diagram-dsl-autocomplete.spec.ts
```

Expected: diff only contains the regression test, stable callback refs, and Monaco manual open action.

- [ ] **Step 6: Commit**

Run:

```bash
git add client/src/hooks/useAssistPopup.ts client/src/hooks/useIdleCursorAction.ts client/e2e/smoke/diagram-dsl-autocomplete.spec.ts
git commit -m "fix: stabilize ERD code mode autocomplete"
```

Expected:

```text
[dev ...] fix: stabilize ERD code mode autocomplete
```

---

## Self-Review

**Spec coverage:** The plan covers both reported symptoms: missing/flickering automatic autocomplete and unreliable `Ctrl+Space`. The E2E test exercises the same user surface: ERD 작성 화면, 코드 우선 모드, Monaco DSL editor, custom assist popup.

**Boundary check:** Changes stay inside ERD/code editor hooks and a new ERD E2E spec. The plan does not import dictionary management UI into ERD code paths.

**Deferred item scan:** No deferred implementation items remain in the plan. Every code-changing step includes concrete code and exact file paths.

**Type consistency:** The plan uses existing exported types and callback names from `useAssistPopup.ts` and `useIdleCursorAction.ts`. New code uses existing `AssistPopupTrigger`, `Monaco.IDisposable`, `editor.addAction`, and `editor.onKeyDown` APIs.
