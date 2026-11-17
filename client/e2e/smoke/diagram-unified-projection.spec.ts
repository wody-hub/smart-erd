import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import { buildDiagramWorkModeStorageKey } from '../../src/lib/diagram-work-mode';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  provisionTeamMember,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

/** 원격 변경이 Monaco에 도달할 때까지 허용하는 상한. */
const PROPAGATION_TIMEOUT_MS = 15_000;

/** 테스트가 브라우저에만 설치하는 공유 초안 변경 감시 상태. */
interface DraftWatchWindow extends Window {
  /** 관찰 시작 이후 공유 초안 트랜잭션 횟수. */
  __unifiedDraftWrites?: number;
  /** 로컬 트랜잭션이 실제 Y.Doc 루트를 변경한 횟수. */
  __unifiedLocalDocWrites?: number;
  /** 현재 authoritative 문서의 직렬화 결과를 읽는다. */
  __readUnifiedDoc?: () => string;
  /** 초기 공유 초안 내용. */
  __unifiedDraftBaseline?: string;
  /** 테스트 종료 시 observer 해제. */
  __stopUnifiedDraftWatch?: () => void;
}

/**
 * 모델 URI로 전용 에디터를 찾아 텍스트·readonly·선택 엔티티를 읽는다.
 * @param page 브라우저 페이지
 * @returns 현재 읽기 전용 투영 상태
 */
async function readProjection(page: Page) {
  return page.evaluate(() => {
    const monaco = window.monaco as unknown as typeof Monaco | undefined;
    const codeEditor = monaco?.editor
      .getEditors()
      .find((editor) => editor.getModel()?.uri.scheme === 'erd-live-projection');
    const model = codeEditor?.getModel();
    if (!codeEditor || !model || !monaco) throw new Error('Dedicated projection model is missing');
    const selection = codeEditor.getSelection();
    /** 선택 끝점의 엔티티 ID와 엔티티 내 오프셋을 읽는다. */
    const anchorAt = (lineNumber: number, column: number) => {
      const position = { lineNumber, column };
      const decoration =
        model
          .getDecorationsInRange({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column,
          })
          .filter((item) => item.options.className?.startsWith('erd-projection-column-'))[0] ??
        model
          .getDecorationsInRange({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column,
          })
          .find((item) => item.options.className?.startsWith('erd-projection-table-'));
      return decoration
        ? {
            entity: decoration.options.className,
            offset:
              model.getOffsetAt(position) - model.getOffsetAt(decoration.range.getStartPosition()),
          }
        : null;
    };
    const draftWindow = window as DraftWatchWindow;
    return {
      text: model.getValue(),
      readOnly: codeEditor.getOption(monaco.editor.EditorOption.readOnly),
      domReadOnly: codeEditor.getOption(monaco.editor.EditorOption.domReadOnly),
      uri: model.uri.toString(),
      modelVersion: model.getVersionId(),
      localDocWrites: draftWindow.__unifiedLocalDocWrites ?? -1,
      anchor: selection
        ? anchorAt(selection.selectionStartLineNumber, selection.selectionStartColumn)
        : null,
      active: selection ? anchorAt(selection.positionLineNumber, selection.positionColumn) : null,
      draftWrites: draftWindow.__unifiedDraftWrites ?? -1,
      modelCount: monaco.editor
        .getModels()
        .filter((item) => item.uri.scheme === 'erd-live-projection').length,
    };
  });
}

/**
 * 실제 문서의 두 공유 draft 루트에 대한 쓰기를 계측한다. 애플리케이션 writer는 호출하지 않는다.
 * @param page 소유자 또는 동료 페이지
 * @returns 없음
 */
async function watchDraftWrites(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const storePath = '/src/stores/erd/useCanvasStore.ts';
    const { default: useCanvasStore } = (await import(/* @vite-ignore */ storePath)) as {
      default: { getState: () => { ydoc: Y.Doc | null } };
    };
    const doc = useCanvasStore.getState().ydoc;
    if (!doc) throw new Error('Authoritative Y.Doc is missing');
    const maps = [doc.getMap('sharedSchemaDraft'), doc.getMap('codeModeSharedDraft')];
    const text = doc.getText('codeModeSharedDraftText');
    const roots = [...maps, text];
    if (maps.some((root) => root.size > 0) || text.length > 0)
      throw new Error('Fresh projection wrote a draft before observation');
    const target = window as DraftWatchWindow;
    target.__unifiedDraftWrites = 0;
    target.__unifiedLocalDocWrites = 0;
    target.__readUnifiedDoc = () => JSON.stringify(doc.toJSON());
    const localChanged = (transaction: Y.Transaction) => {
      if (transaction.local && transaction.changedParentTypes.size)
        target.__unifiedLocalDocWrites = (target.__unifiedLocalDocWrites ?? 0) + 1;
    };
    doc.on('afterTransaction', localChanged);
    target.__unifiedDraftBaseline = JSON.stringify(roots.map((root) => root.toJSON()));
    const changed = () => {
      target.__unifiedDraftWrites = (target.__unifiedDraftWrites ?? 0) + 1;
    };
    roots.forEach((root) => root.observeDeep(changed));
    target.__stopUnifiedDraftWatch = () => {
      roots.forEach((root) => root.unobserveDeep(changed));
      doc.off('afterTransaction', localChanged);
      if (JSON.stringify(roots.map((root) => root.toJSON())) !== target.__unifiedDraftBaseline)
        throw new Error('Projection changed shared draft content');
    };
  });
}

/**
 * 첫 컬럼에 역방향 선택을 두어 ID와 양 끝의 상대 위치 보존을 검사한다.
 * @param page 동료 페이지
 * @returns 선택한 컬럼 엔티티와 오프셋
 */
async function selectPeerColumn(page: Page) {
  await page.evaluate(() => {
    const monaco = window.monaco as unknown as typeof Monaco;
    const codeEditor = monaco.editor
      .getEditors()
      .find((editor) => editor.getModel()?.uri.scheme === 'erd-live-projection');
    const model = codeEditor?.getModel();
    const column = model
      ?.getAllDecorations()
      .find((item) => item.options.className?.startsWith('erd-projection-column-'));
    if (!codeEditor || !model || !column)
      throw new Error('Projection column decoration is missing');
    const start = model.getPositionAt(model.getOffsetAt(column.range.getStartPosition()) + 2);
    const end = model.getPositionAt(model.getOffsetAt(column.range.getStartPosition()) + 4);
    codeEditor.setSelection(
      new monaco.Selection(end.lineNumber, end.column, start.lineNumber, start.column),
    );
    codeEditor.revealLineInCenter(start.lineNumber);
  });
  return readProjection(page);
}

test('internal live DSL follows persisted collaboration without editing or draft writes @smoke', async ({
  browser,
}) => {
  test.skip(
    process.env.SMART_ERD_E2E_UNIFIED !== '1',
    'Requires isolated Vite internal flag + all allowlist',
  );
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const ownerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const peerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const owner = await ownerContext.newPage();
    const peer = await peerContext.newPage();
    const secondTab = await ownerContext.newPage();
    await loginViaUi(owner, { ...config, ...fixture });
    await loginViaUi(peer, { ...config, ...fixture });
    const modeKey = buildDiagramWorkModeStorageKey({
      teamId: String(fixture.target.teamId),
      projectId: String(fixture.target.projectId),
      diagramId: String(fixture.target.diagramId),
    })!;
    // 저장된 code 모드를 무시하되 원래 저장 값은 보존해야 한다.
    for (const page of [owner, peer, secondTab])
      await page.addInitScript((key) => localStorage.setItem(key, 'code'), modeKey);
    const url = diagramUrl(config, fixture.target);
    await owner.goto(url, { waitUntil: 'domcontentloaded' });
    await peer.goto(url, { waitUntil: 'domcontentloaded' });
    await secondTab.goto(url, { waitUntil: 'domcontentloaded' });
    for (const page of [owner, peer, secondTab]) {
      await expectDiagramHeaderVisible(page, fixture.target);
      await waitForEditableDiagram(page, 30_000);
      await expect(page.getByTestId('dsl-live-projection')).toHaveAttribute('data-status', 'ready');
      await expect(page.getByTestId('dsl-live-projection').locator('.monaco-editor')).toBeVisible();
      await expect(page.getByRole('combobox', { name: /작업 모드|work mode/i })).toHaveCount(0);
      await watchDraftWrites(page);
    }

    await owner.getByRole('button', { name: /테이블 추가|add table/i }).click();
    const ownerNode = owner.locator('.react-flow__node-table').first();
    await expect(ownerNode).toBeVisible();
    await expect
      .poll(async () => (await readProjection(peer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('Table 1');
    const selected = await selectPeerColumn(peer);
    expect(selected.anchor?.entity).toMatch(/^erd-projection-column-/);

    // 실제 캔버스 컬럼 입력 경로로 이름을 변경한다.
    await ownerNode.getByText('Table 1', { exact: true }).dblclick();
    const name = ownerNode.getByLabel(/컬럼 이름|column name/i).first();
    await expect(name).toBeVisible();
    await name.fill('projection_owner_id');
    await name.press('Tab');
    await expect
      .poll(async () => (await readProjection(peer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('projection_owner_id');
    expect((await readProjection(peer)).anchor).toEqual(selected.anchor);
    expect((await readProjection(peer)).active).toEqual(selected.active);

    await owner.getByRole('button', { name: /테이블 추가|add table/i }).click();
    await expect(owner.locator('.react-flow__node-table')).toHaveCount(2);
    await expect
      .poll(async () => (await readProjection(peer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('Table 2');

    await owner.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
    // 기존 FK 연결 UI: 부모 클릭 → 자식 클릭 → 관계 유형 선택.
    await owner.getByRole('button', { name: /FK 연결|FK Connect/i }).click();
    // 헤더 영역을 좌표로 직접 클릭한다(노드가 겹치거나 FK 모드 오버레이가 있어도 안정적).
    for (const tableName of ['Table 1', 'Table 2']) {
      const box = await owner.locator(`[data-table-name="${tableName}"]`).boundingBox();
      if (!box) throw new Error(`Table ${tableName} has no bounding box`);
      await owner.mouse.click(box.x + box.width / 2, box.y + 24);
    }
    await owner
      .getByRole('dialog')
      .getByRole('button', { name: /비식별|Non-identifying/i })
      .click();
    await expect
      .poll(async () => (await readProjection(peer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toMatch(/> 'Table [12]'\.(id|projection_owner_id) ::BIGINT/);
    const after = await readProjection(peer);
    expect(after.anchor).toEqual(selected.anchor);
    expect(after.active).toEqual(selected.active);
    expect(after.readOnly).toBe(true);
    expect(after.modelCount).toBe(1);

    // 같은 사용자의 두 번째 탭에도 FK와 부모 이름 변경이 도달한다.
    const parent = owner.locator('[data-table-name="Table 1"]');
    await parent.getByText('Table 1', { exact: true }).dblclick();
    const tableName = parent.getByLabel(/테이블 이름|table name/i);
    await tableName.fill('projection_parent');
    await tableName.press('Enter');
    for (const page of [peer, secondTab]) {
      await expect
        .poll(async () => (await readProjection(page)).text, { timeout: PROPAGATION_TIMEOUT_MS })
        .toMatch(/> projection_parent\.(id|projection_owner_id) ::BIGINT/);
      await expect
        .poll(async () => (await readProjection(page)).text)
        .toBe((await readProjection(owner)).text);
      await expectReadOnlyInputPaths(page);
    }
    // 전체 reload 없이 같은 SPA 안에서 패널이 사라지고 다시 생겨도 모델이 남지 않는다.
    const timeOrigin = await secondTab.evaluate(() => performance.timeOrigin);
    for (let remount = 0; remount < 3; remount++) {
      const previousUri = (await readProjection(secondTab)).uri;
      await secondTab.evaluate(() => (window as DraftWatchWindow).__stopUnifiedDraftWatch?.());
      await secondTab.getByRole('button', { name: 'Smart ERD', exact: true }).click();
      await secondTab.waitForURL('**/teams');
      await expect(secondTab.getByTestId('dsl-live-projection')).toHaveCount(0);
      await expect
        .poll(() =>
          secondTab.evaluate(() => {
            const monaco = window.monaco as unknown as typeof Monaco;
            return monaco.editor
              .getModels()
              .filter((model) => model.uri.scheme === 'erd-live-projection').length;
          }),
        )
        .toBe(0);
      await secondTab.goBack();
      await expect(secondTab.getByTestId('dsl-live-projection')).toHaveAttribute(
        'data-status',
        'ready',
      );
      await expect(
        secondTab.getByTestId('dsl-live-projection').locator('.monaco-editor'),
      ).toBeVisible();
      await expect
        .poll(async () => (await readProjection(secondTab)).text)
        .toBe((await readProjection(owner)).text);
      const mounted = await readProjection(secondTab);
      expect(mounted.modelCount).toBe(1);
      expect(mounted.uri).not.toBe(previousUri);
      expect(await secondTab.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
      await watchDraftWrites(secondTab);
    }
    // 두 번째 탭을 닫아도 같은 사용자의 첫 탭은 계속 투영한다.
    await secondTab.evaluate(() => (window as DraftWatchWindow).__stopUnifiedDraftWatch?.());
    await secondTab.close();
    await owner.getByRole('button', { name: /테이블 추가|add table/i }).click();
    await expect
      .poll(async () => (await readProjection(peer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('Table 3');
    for (const page of [owner, peer]) {
      const state = await readProjection(page);
      expect(state.readOnly).toBe(true);
      expect(state.draftWrites).toBe(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), modeKey)).toBe('code');
      await page.evaluate(() => (window as DraftWatchWindow).__stopUnifiedDraftWatch?.());
    }
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});

/**
 * 클립보드·드롭·실제 Monaco 편집 액션이 모델과 Y.Doc을 바꾸지 않는지 검사한다.
 * @param page 수화가 끝난 읽기 전용 투영 페이지
 * @returns 없음
 */
async function expectReadOnlyInputPaths(page: Page): Promise<void> {
  const baseline = await readProjection(page);
  const documentBefore = await page.evaluate(() =>
    (window as DraftWatchWindow).__readUnifiedDoc?.(),
  );
  expect(documentBefore).toBeDefined();
  expect(baseline.readOnly).toBe(true);
  expect(baseline.domReadOnly).toBe(true);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => navigator.clipboard.writeText('must_not_paste'));
  const input = page.getByTestId('dsl-live-projection').locator('textarea');
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('must_not_type');
  await page.keyboard.press('ControlOrMeta+V');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+X');
  expect((await readProjection(page)).text).toBe(baseline.text);

  await input.evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'must_not_drop_or_paste');
    element.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }),
    );
    element.dispatchEvent(
      new ClipboardEvent('cut', { bubbles: true, cancelable: true, clipboardData: data }),
    );
    const surface = element.closest('.monaco-editor');
    if (!surface) throw new Error('Monaco drop surface is missing');
    for (const type of ['dragenter', 'dragover', 'drop'])
      surface.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  });
  expect((await readProjection(page)).text).toBe(baseline.text);

  // Playwright의 실제 마우스 드래그도 별도 DOM 소스에서 Monaco로 전달한다.
  await page.evaluate(() => {
    const source = document.createElement('div');
    source.dataset.testid = 'unified-drag-source';
    source.textContent = 'E2E drag';
    source.draggable = true;
    source.style.cssText =
      'position:fixed;left:8px;top:80px;z-index:99999;padding:8px;background:white;color:black';
    source.addEventListener('dragstart', (event) =>
      event.dataTransfer?.setData('text/plain', 'must_not_drag'),
    );
    document.body.append(source);
  });
  try {
    await page
      .getByTestId('unified-drag-source')
      .dragTo(page.getByTestId('dsl-live-projection').locator('.view-lines'), {
        targetPosition: { x: 20, y: 20 },
      });
  } finally {
    await page.getByTestId('unified-drag-source').evaluate((element) => element.remove());
  }
  expect((await readProjection(page)).text).toBe(baseline.text);

  const actions = await page.evaluate(async () => {
    const monaco = window.monaco as unknown as typeof Monaco;
    const codeEditor = monaco.editor
      .getEditors()
      .find((editor) => editor.getModel()?.uri.scheme === 'erd-live-projection');
    const model = codeEditor?.getModel();
    if (!codeEditor || !model) throw new Error('Projection editor is missing');
    const range = model.getFullModelRange();
    const edit = {
      resource: model.uri,
      versionId: model.getVersionId(),
      textEdit: { range, text: 'must_not_apply_action' },
    };
    // 실제 변경을 제공하는 provider를 설치해 언어 기능 부재로 인한 거짓 성공을 막는다.
    const providers = [
      monaco.languages.registerDocumentFormattingEditProvider(model.getLanguageId(), {
        provideDocumentFormattingEdits: () => [{ range, text: 'must_not_format' }],
      }),
      monaco.languages.registerRenameProvider(model.getLanguageId(), {
        provideRenameEdits: () => ({ edits: [edit] }),
        resolveRenameLocation: () => ({ range, text: 'must_not_rename' }),
      }),
      monaco.languages.registerCodeActionProvider(
        model.getLanguageId(),
        {
          provideCodeActions: () => ({
            actions: [{ title: 'Forbidden E2E fix', kind: 'quickfix', edit: { edits: [edit] } }],
            dispose() {},
          }),
        },
        { providedCodeActionKinds: ['quickfix'] },
      ),
    ];
    try {
      const result = [];
      for (const id of [
        'editor.action.formatDocument',
        'editor.action.rename',
        'editor.action.quickFix',
        'editor.action.deleteLines',
      ]) {
        const action = codeEditor.getAction(id);
        if (!action) throw new Error(`Monaco action is missing: ${id}`);
        const supported = action.isSupported();
        await action.run();
        result.push({ id, supported, text: model.getValue() });
      }
      codeEditor.trigger('e2e-readonly', 'paste', { text: 'must_not_trigger_paste' });
      return result;
    } finally {
      providers.forEach((provider) => provider.dispose());
    }
  });
  for (const action of actions) {
    expect(action.supported, action.id).toBe(false);
    expect(action.text, action.id).toBe(baseline.text);
  }
  // 비동기 편집과 구독 microtask까지 비운 뒤 문서·모델·초안을 모두 비교한다.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const after = await readProjection(page);
  expect(after.text).toBe(baseline.text);
  expect(after.uri).toBe(baseline.uri);
  expect(after.modelVersion).toBe(baseline.modelVersion);
  expect(after.modelCount).toBe(1);
  expect(after.localDocWrites).toBe(baseline.localDocWrites);
  expect(after.draftWrites).toBe(baseline.draftWrites);
  expect(await page.evaluate(() => (window as DraftWatchWindow).__readUnifiedDoc?.())).toBe(
    documentBefore,
  );
}

/**
 * 실패를 검사하며 fixture API를 호출한다.
 * @param request API 요청 컨텍스트
 * @param method HTTP 메서드
 * @param url 대상 API
 * @param token 소유자 토큰
 * @param data 요청 본문
 * @returns JSON 응답
 */
async function projectionApi<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  token: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ko' },
    data,
  });
  expect(response.ok(), `${method} ${url}: ${response.status()}`).toBe(true);
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
}

test('team VIEWER follows owner and refreshed dictionary without local doc writes or toast spam @smoke', async ({
  browser,
  request,
}) => {
  test.skip(
    process.env.SMART_ERD_E2E_UNIFIED !== '1',
    'Requires isolated Vite internal flag + all allowlist',
  );
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const ownerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const viewerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  try {
    const owner = await ownerContext.newPage();
    const token = await loginViaUi(owner, { ...config, ...fixture });
    const viewerAccount = await provisionTeamMember(config, token, fixture.target.teamId, 'VIEWER');
    const viewer = await viewerContext.newPage();
    const viewerToken = await loginViaUi(viewer, { ...config, ...viewerAccount });
    const teamUrl = `${config.apiBaseUrl}/teams/${fixture.target.teamId}`;
    // 역할과 문서 조회 권한을 API에서도 확인한다. 다른 계정이 단지 OWNER로 로그인한 경우를 잡는다.
    const members = await projectionApi<{ loginId: string; role: string }[]>(
      request,
      'GET',
      `${teamUrl}/members`,
      token,
    );
    expect(members.find((member) => member.loginId === viewerAccount.loginId)?.role).toBe('VIEWER');
    const documentUrl = `${teamUrl}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`;
    await projectionApi(request, 'GET', documentUrl, viewerToken);
    const sets = await projectionApi<{ id: number; isDefault: boolean }[]>(
      request,
      'GET',
      `${teamUrl}/dictionary-sets`,
      token,
    );
    const set = sets.find((entry) => entry.isDefault) ?? sets[0];
    expect(set).toBeDefined();
    const dictionaryUrl = `${teamUrl}/dictionary-sets/${set.id}`;
    const domain = await projectionApi<{ id: number }>(
      request,
      'POST',
      `${dictionaryUrl}/domains`,
      token,
      { logicalName: '초기식별자', physicalType: 'BIGINT' },
    );
    await projectionApi(request, 'POST', `${dictionaryUrl}/words`, token, {
      logicalName: '식별자',
      physicalName: 'identifier',
    });
    const term = await projectionApi<{ id: number }>(
      request,
      'POST',
      `${dictionaryUrl}/terms`,
      token,
      { logicalName: '식별자', physicalName: 'identifier', domainId: domain.id },
    );
    await projectionApi(request, 'PUT', documentUrl, token, {
      content: JSON.stringify({
        nodes: [
          {
            id: 'viewer-table',
            type: 'table',
            position: { x: 120, y: 120 },
            data: {
              label: 'viewer_seed',
              columns: [
                {
                  id: 'viewer-column',
                  logicalName: '식별자',
                  name: 'identifier',
                  type: 'BIGINT',
                  termId: term.id,
                  domainId: domain.id,
                },
              ],
            },
          },
        ],
        edges: [],
        groups: [],
      }),
    });
    const toasts: string[] = [];
    await viewer.exposeFunction('__recordUnifiedToast', (message: string) => toasts.push(message));
    await viewer.addInitScript(() => {
      const record = (window as unknown as { __recordUnifiedToast: (message: string) => void })
        .__recordUnifiedToast;
      const observer = new MutationObserver((records) => {
        for (const mutation of records)
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            const found = [
              ...(node.matches('[data-sonner-toast]') ? [node] : []),
              ...node.querySelectorAll('[data-sonner-toast]'),
            ];
            found.forEach((toast) => record(toast.textContent ?? ''));
          }
      });
      observer.observe(document, { childList: true, subtree: true });
      // 페이지를 닫으면 observer도 함께 해제된다.
    });
    const url = diagramUrl(config, fixture.target);
    for (const page of [owner, viewer]) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expectDiagramHeaderVisible(page, fixture.target);
      await expect(page.getByTestId('dsl-live-projection')).toHaveAttribute('data-status', 'ready');
      await expect(page.getByTestId('dsl-live-projection').locator('.monaco-editor')).toBeVisible();
      await expect.poll(async () => (await readProjection(page)).text).toContain(':초기식별자');
      await watchDraftWrites(page);
    }
    await waitForEditableDiagram(owner, 30_000);
    // VIEWER는 편집 가능 상태를 기다리지 않는다.
    const addTable = viewer.getByRole('button', { name: /테이블 추가|add table/i });
    if (await addTable.count()) await expect(addTable).toBeDisabled();
    await owner.getByRole('button', { name: /테이블 추가|add table/i }).click();
    await expect
      .poll(async () => (await readProjection(viewer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('Table 2');
    const parent = owner.locator('.react-flow__node-table').filter({ hasText: 'viewer_seed' });
    await parent.getByText('viewer_seed', { exact: true }).dblclick();
    const name = parent.getByLabel(/테이블 이름|table name/i);
    await name.fill('viewer_renamed');
    await name.press('Enter');
    await expect
      .poll(async () => (await readProjection(viewer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain('viewer_renamed');

    await projectionApi(request, 'PUT', `${dictionaryUrl}/domains/${domain.id}`, token, {
      logicalName: '변경식별자',
      physicalType: 'BIGINT',
    });
    // 팀 사전은 자동 push하지 않는다. 실제 query client로 읽기 캐시만 재조회하고 패널은 유지한다.
    const uri = (await readProjection(viewer)).uri;
    await viewer.evaluate(
      async ({ teamId, setId }) => {
        const path = '/src/lib/query-client.ts';
        const { queryClient } = (await import(/* @vite-ignore */ path)) as {
          queryClient: { invalidateQueries: (options: { queryKey: string[] }) => Promise<void> };
        };
        await queryClient.invalidateQueries({
          queryKey: ['teams', String(teamId), 'dictionary-sets', String(setId)],
        });
      },
      { teamId: fixture.target.teamId, setId: set.id },
    );
    await expect
      .poll(async () => (await readProjection(viewer)).text, { timeout: PROPAGATION_TIMEOUT_MS })
      .toContain(':변경식별자');
    expect((await readProjection(viewer)).uri).toBe(uri);
    await expectReadOnlyInputPaths(viewer);
    expect((await readProjection(viewer)).localDocWrites).toBe(0);
    expect((await readProjection(viewer)).draftWrites).toBe(0);
    expect(toasts).toEqual([]);
    for (const page of [owner, viewer])
      await page.evaluate(() => (window as DraftWatchWindow).__stopUnifiedDraftWatch?.());
  } finally {
    await ownerContext.close();
    await viewerContext.close();
  }
});
