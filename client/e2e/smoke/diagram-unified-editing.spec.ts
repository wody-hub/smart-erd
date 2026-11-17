import { expect, test, type Browser, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '../../src/constants/storage';
import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import type { ERDEdge, TableNode } from '../../src/types/erd';
import {
  diagramUrl,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  provisionTeamMember,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

/** 내부 플래그 전용 테스트. 일반 smoke에서는 실행하지 않는다. */
const UNIFIED_ENABLED = process.env.SMART_ERD_E2E_UNIFIED === '1';
/** 실제 투영 에디터를 읽는다. production 전역 노출에는 의존하지 않는다. */
async function readPanel(page: Page) {
  return page.evaluate(() => {
    const monaco = window.monaco as unknown as typeof Monaco;
    const editor = monaco.editor
      .getEditors()
      .find(
        (item) =>
          item.getModel()?.uri.scheme === 'erd-unified-edit' ||
          item.getModel()?.uri.scheme === 'erd-live-projection',
      );
    const model = editor?.getModel();
    if (!editor || !model) throw new Error('Unified editor missing');
    return {
      text: model.getValue(),
      readOnly: editor.getOption(monaco.editor.EditorOption.readOnly),
      selection: editor.getSelection(),
      markers: monaco.editor.getModelMarkers({ resource: model.uri }),
      version: model.getVersionId(),
    };
  });
}
/** 실제 사용자 키 입력으로 토큰을 교체한다. */
async function editPanel(page: Page, from: string, to: string) {
  await page.evaluate((token) => {
    const monaco = window.monaco as unknown as typeof Monaco;
    const editor = monaco.editor
      .getEditors()
      .find((item) => item.getModel()?.uri.scheme === 'erd-unified-edit');
    const model = editor?.getModel();
    if (!editor || !model) throw new Error('Editable model missing');
    const offset = model.getValue().indexOf(token);
    if (offset < 0) throw new Error(`Token missing: ${token}`);
    const start = model.getPositionAt(offset),
      end = model.getPositionAt(offset + token.length);
    editor.focus();
    editor.setSelection(
      new monaco.Selection(start.lineNumber, start.column, end.lineNumber, end.column),
    );
  }, from);
  if (to) await page.keyboard.insertText(to);
  else await page.keyboard.press('Backspace');
}
/** 캔버스 렌더 결과와 별개로 authoritative 문서의 ID·필드를 읽는다. */
async function readDocument(page: Page) {
  return page.evaluate(async () => {
    const storePath = '/src/stores/erd/useCanvasStore.ts';
    const bridgePath = '/src/collaboration/yjsBridge.ts';
    const { default: store } = (await import(/* @vite-ignore */ storePath)) as {
      default: { getState: () => { ydoc: Y.Doc | null } };
    };
    const bridge = (await import(/* @vite-ignore */ bridgePath)) as {
      getTablesMap: (doc: Y.Doc) => Y.Map<Y.Map<unknown>>;
      getEdgesMap: (doc: Y.Doc) => Y.Map<Y.Map<unknown>>;
      yTablesMapToNodes: (map: Y.Map<Y.Map<unknown>>) => TableNode[];
      yEdgesMapToEdges: (map: Y.Map<Y.Map<unknown>>) => ERDEdge[];
    };
    const doc = store.getState().ydoc;
    if (!doc) throw new Error('Document missing');
    return {
      nodes: bridge.yTablesMapToNodes(bridge.getTablesMap(doc)),
      edges: bridge.yEdgesMapToEdges(bridge.getEdgesMap(doc)),
    };
  });
}
/** 두 브라우저에 안정 ID와 관계가 있는 동일 fixture를 연다. */
async function setup(browser: Browser) {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const ownerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const peerContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const owner = await ownerContext.newPage(),
    peer = await peerContext.newPage();
  try {
    const token = await loginViaUi(owner, { ...config, ...fixture });
    await loginViaUi(peer, { ...config, ...fixture });
    const target = fixture.target;
    const response = await owner.request.put(
      `${config.apiBaseUrl}/teams/${target.teamId}/projects/${target.projectId}/diagrams/${target.diagramId}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'X-Smart-Erd-Client-Protocol': '3' },
        data: {
          content: JSON.stringify({
            nodes: [
              {
                id: 'a',
                type: 'table',
                position: { x: 80, y: 120 },
                data: {
                  label: 'users',
                  columns: [
                    { id: 'id', name: 'user_id', type: 'BIGINT', pk: true, nullable: false },
                    { id: 'value', name: 'value', type: 'INT', nullable: true },
                  ],
                },
              },
              {
                id: 'b',
                type: 'table',
                position: { x: 420, y: 120 },
                data: {
                  label: 'orders',
                  columns: [
                    { id: 'order-id', name: 'order_id', type: 'BIGINT', pk: true, nullable: false },
                    { id: 'user-fk', name: 'owner_id', type: 'BIGINT', nullable: true },
                  ],
                },
              },
            ],
            edges: [
              {
                id: 'stable-edge',
                source: 'a',
                target: 'b',
                sourceHandle: 'a-id-source-right',
                targetHandle: 'b-user-fk-target-left',
                type: 'erdRelation',
                data: { relationType: 'non-identifying', routingType: 'straight' },
              },
            ],
            groups: [],
          }),
        },
      },
    );
    expect(response.ok()).toBe(true);
    for (const page of [owner, peer]) {
      await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
      await waitForEditableDiagram(page, 30000);
      await expect(page.getByTestId('dsl-live-projection')).toHaveAttribute('data-status', 'ready');
      await expect.poll(async () => (await readPanel(page)).text).toContain('value ::INT');
      expect((await readPanel(page)).readOnly).toBe(false);
    }
    return {
      owner,
      peer,
      config,
      fixture,
      token,
      close: async () => {
        await ownerContext.close();
        await peerContext.close();
      },
    };
  } catch (error) {
    await ownerContext.close();
    await peerContext.close();
    throw error;
  }
}

test.describe('unified existing-field editing @smoke', () => {
  test.skip(
    !UNIFIED_ENABLED || process.env.SMART_ERD_E2E_UNIFIED_OFF === '1',
    'Requires VITE_ERD_UNIFIED_EDIT_MODE=internal and all allowlist',
  );
  for (const [name, from, to, field, expected] of [
    ['column rename', 'value ::INT', 'changed_value ::INT', 'name', 'changed_value'],
    ['type', 'value ::INT', 'value ::TEXT', 'type', 'TEXT'],
    ['PK/NN', 'value ::INT', 'value ::INT [PK]', 'pk', true],
    ['NN', 'value ::INT', 'value ::INT [NN]', 'nullable', false],
  ] as const)
    test(`${name} reaches owner canvas and peer without changing any edge IDs`, async ({
      browser,
    }) => {
      const h = await setup(browser);
      try {
        const baseline = await readDocument(h.owner);
        await editPanel(h.owner, from, to);
        for (const page of [h.owner, h.peer]) {
          await expect
            .poll(
              async () =>
                (await readDocument(page)).nodes
                  .find((node) => node.id === 'a')
                  ?.data.columns.find((column) => column.id === 'value')?.[field],
            )
            .toBe(expected);
          await expect.poll(async () => (await readPanel(page)).text).toContain(to);
          await expect(page.locator('.react-flow__node[data-id="a"]')).toContainText(
            String(expected === true ? 'PK' : field === 'nullable' ? 'NN' : expected),
          );
          const after = await readDocument(page);
          expect(after.edges).toEqual(baseline.edges);
          expect(after.edges.map((edge) => edge.id)).toEqual(['stable-edge']);
          expect(
            after.nodes.find((node) => node.id === 'a')?.data.columns.map((column) => column.id),
          ).toEqual(['id', 'value']);
        }
      } finally {
        await h.close();
      }
    });
  test('table rename and undo/redo each revert exactly one commit on both browsers', async ({
    browser,
  }) => {
    const h = await setup(browser);
    try {
      await editPanel(h.owner, 'users', 'people');
      await expect
        .poll(
          async () =>
            (await readDocument(h.peer)).nodes.find((node) => node.id === 'a')?.data.label,
        )
        .toBe('people');
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('Table people');
      await h.owner.keyboard.press('Control+z');
      for (const page of [h.owner, h.peer])
        await expect
          .poll(
            async () =>
              (await readDocument(page)).nodes.find((node) => node.id === 'a')?.data.label,
          )
          .toBe('users');
      await h.owner.keyboard.press('Control+Shift+z');
      for (const page of [h.owner, h.peer])
        await expect
          .poll(
            async () =>
              (await readDocument(page)).nodes.find((node) => node.id === 'a')?.data.label,
          )
          .toBe('people');
    } finally {
      await h.close();
    }
  });
  for (const mode of ['invalid', 'unsupported'] as const)
    test(`${mode} keeps local text with marker and zero document changes`, async ({ browser }) => {
      const h = await setup(browser);
      try {
        const before = await readDocument(h.owner);
        const to = mode === 'invalid' ? 'value ::!' : '';
        await editPanel(h.owner, mode === 'invalid' ? 'value ::INT' : '  value ::INT\n', to);
        await expect.poll(async () => (await readPanel(h.owner)).markers.length).toBeGreaterThan(0);
        await expect(h.owner.getByTestId('dsl-block-status')).toHaveAttribute(
          'data-state',
          mode === 'invalid' ? 'INVALID' : 'UNSUPPORTED',
        );
        // 초기 타이머와 max-wait를 모두 지나도 잘못된 블록은 쓰지 않는다.
        await h.owner.waitForTimeout(5200);
        expect(await readDocument(h.owner)).toEqual(before);
        expect(await readDocument(h.peer)).toEqual(before);
        if (to) expect((await readPanel(h.owner)).text).toContain(to);
        else expect((await readPanel(h.owner)).text).not.toContain('value ::INT');
      } finally {
        await h.close();
      }
    });
  test('different blocks and different fields in the same block merge', async ({ browser }) => {
    const h = await setup(browser);
    try {
      await Promise.all([
        editPanel(h.owner, 'value ::INT', 'mine ::INT'),
        editPanel(h.peer, 'orders', 'purchases'),
      ]);
      await expect.poll(async () => (await readPanel(h.peer)).text).toContain('mine ::INT');
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('Table purchases');
      await h.owner.evaluate(() =>
        (window.monaco as unknown as typeof Monaco).editor
          .getEditors()
          .find((item) => item.getModel()?.uri.scheme === 'erd-unified-edit')
          ?.focus(),
      );
      await editPanel(h.owner, 'mine ::INT', 'mine ::TEXT');
      await editPanel(h.peer, 'users', 'members');
      for (const page of [h.owner, h.peer]) {
        await expect.poll(async () => (await readPanel(page)).text).toContain('mine ::TEXT');
        await expect.poll(async () => (await readPanel(page)).text).toContain('Table members');
        await expect(page.getByTestId('dsl-block-conflict')).toHaveCount(0);
      }
    } finally {
      await h.close();
    }
  });
  for (const choice of ['mine', 'remote'] as const)
    test(`same-field remote change preserves cursor/text until ${choice} choice`, async ({
      browser,
    }) => {
      const h = await setup(browser);
      try {
        // 동료가 먼저 편집을 시작(DIRTY)하고, 소유자는 같은 필드를 편집한 뒤 blur로 즉시 커밋한다.
        await editPanel(h.peer, 'value ::INT', 'value ::TEXT');
        const before = await readPanel(h.peer);
        await editPanel(h.owner, 'value ::INT', 'value ::BIGINT');
        await h.owner.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } });
        await expect(h.peer.getByTestId('dsl-block-conflict')).toBeVisible();
        const after = await readPanel(h.peer);
        // 충돌이 보여도 사용자의 로컬 텍스트와 커서는 그대로여야 한다.
        expect(after.text).toBe(before.text);
        expect(after.selection).toEqual(before.selection);
        await h.peer
          .getByRole('button', {
            name: choice === 'mine' ? /내 값 적용|Apply mine/ : /원격 값 유지|Keep remote/,
          })
          .click();
        const expected = choice === 'mine' ? 'TEXT' : 'BIGINT';
        for (const page of [h.owner, h.peer])
          await expect
            .poll(
              async () =>
                (await readDocument(page)).nodes
                  .find((node) => node.id === 'a')
                  ?.data.columns.find((column) => column.id === 'value')?.type,
            )
            .toBe(expected);
        await expect(h.peer.getByTestId('dsl-block-conflict')).toHaveCount(0);
      } finally {
        await h.close();
      }
    });
  test('VIEWER uses the original readonly model', async ({ browser }) => {
    const h = await setup(browser);
    const context = await browser.newContext();
    try {
      const account = await provisionTeamMember(
        h.config,
        h.token,
        h.fixture.target.teamId,
        'VIEWER',
      );
      const viewer = await context.newPage();
      await loginViaUi(viewer, { ...h.config, ...account });
      await viewer.goto(diagramUrl(h.config, h.fixture.target), { waitUntil: 'domcontentloaded' });
      // Monaco는 지연 로드되므로 전역과 패널이 준비될 때까지 기다린다.
      await viewer.waitForFunction(
        () =>
          Boolean(
            (window as unknown as { monaco?: typeof Monaco }).monaco?.editor.getEditors().length,
          ),
        null,
        { timeout: 30000 },
      );
      await expect.poll(async () => (await readPanel(viewer)).readOnly).toBe(true);
      const before = await readPanel(viewer);
      await viewer.getByTestId('dsl-live-projection').locator('textarea').focus();
      await viewer.keyboard.insertText('forbidden');
      expect((await readPanel(viewer)).text).toBe(before.text);
    } finally {
      await context.close();
      await h.close();
    }
  });
});

test('flag-off keeps the existing work-mode page @smoke', async ({ page }) => {
  test.skip(
    !UNIFIED_ENABLED || process.env.SMART_ERD_E2E_UNIFIED_OFF !== '1',
    'Run separately against a flag-off Vite build',
  );
  const config = getE2EProvisioningConfig(),
    fixture = await provisionCollaborationFixture(config);
  await loginViaUi(page, { ...config, ...fixture });
  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await waitForEditableDiagram(page, 30000);
  await expect(page.getByTestId('dsl-live-projection')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /작업 모드|work mode/i })).toBeVisible();
});

/** 복구 저널만 조회하여 공유 문서 저장과 구분한다. */
async function recoveryRecords(page: Page) {
  return page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(`${prefix}:`))
        .flatMap(
          (key) =>
            (
              JSON.parse(localStorage.getItem(key)!) as {
                records: { tableId: string; text: string }[];
              }
            ).records,
        ),
    STORAGE_KEYS.CODE_BLOCK_RECOVERY_PREFIX,
  );
}

test.describe('unified local recovery journal @smoke', () => {
  test.skip(
    !UNIFIED_ENABLED || process.env.SMART_ERD_E2E_UNIFIED_OFF === '1',
    'Requires VITE_ERD_UNIFIED_EDIT_MODE=internal and all allowlist',
  );

  test('invalid edit survives reload with banner; Discard removes the journal and restored text', async ({
    browser,
  }) => {
    const h = await setup(browser);
    try {
      await editPanel(h.owner, 'value ::INT', 'value ::?');
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('value ::?');
      await h.owner.reload({ waitUntil: 'domcontentloaded' });
      await expect(h.owner.getByTestId('dsl-live-projection')).toHaveAttribute(
        'data-status',
        'ready',
      );
      await expect(h.owner.getByTestId('dsl-recovery-banner')).toBeVisible();
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('value ::?');
      expect(
        (await readDocument(h.owner)).nodes
          .find((n) => n.id === 'a')!
          .data.columns.find((c) => c.id === 'value')!.type,
      ).toBe('INT');
      await h.owner
        .getByTestId('dsl-recovery-banner')
        .getByRole('button', { name: /버리기|Discard/ })
        .click();
      await expect(h.owner.getByTestId('dsl-recovery-banner')).toHaveCount(0);
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('value ::INT');
      await expect.poll(() => recoveryRecords(h.owner)).toEqual([]);
      await h.owner.reload({ waitUntil: 'domcontentloaded' });
      await expect(h.owner.getByTestId('dsl-live-projection')).toHaveAttribute(
        'data-status',
        'ready',
      );
      await expect(h.owner.getByTestId('dsl-recovery-banner')).toHaveCount(0);
    } finally {
      await h.close();
    }
  });

  test('committed edits leave no recovery record or reload banner', async ({ browser }) => {
    const h = await setup(browser);
    try {
      await editPanel(h.owner, 'value ::INT', 'value ::TEXT');
      await expect
        .poll(
          async () =>
            (await readDocument(h.owner)).nodes
              .find((n) => n.id === 'a')!
              .data.columns.find((c) => c.id === 'value')!.type,
        )
        .toBe('TEXT');
      await expect.poll(() => recoveryRecords(h.owner)).toEqual([]);
      await h.owner.reload({ waitUntil: 'domcontentloaded' });
      await expect(h.owner.getByTestId('dsl-live-projection')).toHaveAttribute(
        'data-status',
        'ready',
      );
      await expect.poll(async () => (await readPanel(h.owner)).text).toContain('value ::TEXT');
      await expect(h.owner.getByTestId('dsl-recovery-banner')).toHaveCount(0);
      expect(await recoveryRecords(h.owner)).toEqual([]);
    } finally {
      await h.close();
    }
  });
});
