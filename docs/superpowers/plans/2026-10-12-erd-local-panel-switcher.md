# ERD Local Panel Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/erd-local`에서 테이블 목록과 코드 에디터를 왼쪽 패널 상단 탭으로 전환한다.

**Architecture:** `ErdLocalPage`의 기존 `leftPanel` 상태를 Radix 기반 공용 Tabs 컴포넌트의 controlled value로 연결한다. 테이블 목록과 코드 에디터는 탭 콘텐츠로 유지하고, `/erd-local` 화면에서는 캔버스 툴바의 코드 전환 callback을 전달하지 않는다. 일반 다이어그램 화면과 코드 자동 반영·로컬 저장 동작은 변경하지 않는다.

**Tech Stack:** React 19, TypeScript 5.6, `@radix-ui/react-tabs` 기반 `@/components/ui/tabs`, react-i18next.

## Global Constraints

- 변경 범위는 `/erd-local` 화면으로 한정한다.
- 기존 `DiagramSidebar`, `DdlCodeEditorPanel`, 자동 반영 및 localStorage 저장 흐름을 재사용한다.
- 공용 `CanvasToolbar` API와 일반 다이어그램 화면의 전환 UI는 수정하지 않는다.
- 새 의존성과 새 테스트 하네스를 추가하지 않는다.
- 사용자에게 보이는 탭 라벨은 한국어/영어 번역 키를 사용한다.
- 구현 전부터 남아 있던 수정 파일을 되돌리거나 다른 변경과 함께 커밋하지 않는다.

---

### Task 1: ERD 로컬 좌측 패널 탭 전환

**Files:**

- Modify: `client/src/pages/erd-local/ErdLocalPage.tsx`
- Modify: `client/src/i18n/locales/ko/translation.json`
- Modify: `client/src/i18n/locales/en/translation.json`

**Interfaces:**

- Consumes: `Tabs`, `TabsList`, `TabsTrigger` from `@/components/ui/tabs`; the existing `leftPanel: 'sidebar' | 'code'` state; existing `DiagramSidebar` and `DdlCodeEditorPanel` components.
- Produces: translated `erdLocal.panelTables` and `erdLocal.panelCode` labels; a persistent, keyboard-accessible two-tab selector in the left panel.

- [x] **Step 1: Add matching tab labels to both locales**

In the existing `erdLocal` objects, add:

```json
"panelTables": "테이블",
"panelCode": "코드"
```

and in English:

```json
"panelTables": "Tables",
"panelCode": "Code"
```

- [x] **Step 2: Replace the toggle-only control with controlled panel tabs**

Import `Tabs`, `TabsList`, `TabsContent`, and `TabsTrigger` from `@/components/ui/tabs`. Keep the existing `ErdLocalLeftPanel` union and `leftPanel` state. Replace the left panel wrapper's conditional child with a controlled `Tabs` root and the following structure:

```tsx
<Tabs
    value={leftPanel}
    onValueChange={(value) => {
        if (value === 'sidebar' || value === 'code') {
            setLeftPanel(value);
        }
    }}
    className="flex h-full min-h-0 flex-col"
>
    <TabsList className="mx-3 mt-3 h-9 w-fit sm:w-fit sm:justify-start">
        <TabsTrigger value="sidebar" className="px-3 py-1.5 text-xs">
            {t('erdLocal.panelTables')}
        </TabsTrigger>
        <TabsTrigger value="code" className="px-3 py-1.5 text-xs">
            {t('erdLocal.panelCode')}
        </TabsTrigger>
    </TabsList>
    <TabsContent value="sidebar" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <DiagramSidebar canEdit />
    </TabsContent>
    <TabsContent value="code" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<Spinner />}>
            <DdlCodeEditorPanel canEdit />
        </Suspense>
    </TabsContent>
</Tabs>
```

Remove `handleToggleCodeEditor` and stop passing `codeEditorActive` and `onToggleCodeEditor` to this page's `ERDCanvas`. Leave `ERDCanvas` and `CanvasToolbar` shared APIs untouched; without the callback, the local page's canvas toolbar no longer renders its code-panel toggle.

- [x] **Step 3: Run static validation**

Run from `client/`:

```bash
npx prettier --check src/pages/erd-local/ErdLocalPage.tsx src/i18n/locales/ko/translation.json src/i18n/locales/en/translation.json
npm run build
npm run lint
```

Expected: formatting, TypeScript/Vite build, ESLint, and function documentation verification all pass.

- [x] **Step 4: Verify the live local ERD flow**

Open `http://127.0.0.1:4501/erd-local` so browser storage is isolated from the user's `localhost` origin. Confirm the two translated tabs stay visible while switching in both directions; the table list and groups render under Tables; the DSL/SQL editor renders under Code; the canvas toolbar has no Code toggle while its other controls remain; keyboard focus and arrow-key tab navigation work. Enter `CREATE TABLE panel_switcher_smoke (id INTEGER PRIMARY KEY);`, wait for auto-apply, and verify `panel_switcher_smoke` appears in the canvas/sidebar and survives a page reload on the isolated origin.

No new automated UI test is planned: the change only wires existing Radix Tabs around existing panel components, and the repository has no dedicated ERD-local page interaction test harness. Build/lint plus isolated-origin browser verification cover the changed layout and preserved end-to-end behavior.
