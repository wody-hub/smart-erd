import { expect, test, type Page } from '@playwright/test';
import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import { buildDiagramWorkModeStorageKey } from '../../src/lib/diagram-work-mode';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

/** 원격 변경이 Monaco에 도달할 때까지 허용하는 상한. */
const PROPAGATION_TIMEOUT_MS = 15_000;

/** 테스트가 브라우저에만 설치하는 공유 초안 변경 감시 상태. */
interface DraftWatchWindow extends Window {
  /** 관찰 시작 이후 공유 초안 트랜잭션 횟수. */
  __unifiedDraftWrites?: number;
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
    target.__unifiedDraftBaseline = JSON.stringify(roots.map((root) => root.toJSON()));
    const changed = () => {
      target.__unifiedDraftWrites = (target.__unifiedDraftWrites ?? 0) + 1;
    };
    roots.forEach((root) => root.observeDeep(changed));
    target.__stopUnifiedDraftWatch = () => {
      roots.forEach((root) => root.unobserveDeep(changed));
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
    await loginViaUi(owner, { ...config, ...fixture });
    await loginViaUi(peer, { ...config, ...fixture });
    const modeKey = buildDiagramWorkModeStorageKey({
      teamId: String(fixture.target.teamId),
      projectId: String(fixture.target.projectId),
      diagramId: String(fixture.target.diagramId),
    })!;
    // 저장된 code 모드를 무시하되 원래 저장 값은 보존해야 한다.
    for (const page of [owner, peer])
      await page.addInitScript((key) => localStorage.setItem(key, 'code'), modeKey);
    const url = diagramUrl(config, fixture.target);
    await owner.goto(url, { waitUntil: 'domcontentloaded' });
    await peer.goto(url, { waitUntil: 'domcontentloaded' });
    for (const page of [owner, peer]) {
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
    for (const index of [0, 1]) {
      const box = await owner.locator('.react-flow__node-table').nth(index).boundingBox();
      if (!box) throw new Error(`Table node ${index} has no bounding box`);
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

    const peerInput = peer.getByTestId('dsl-live-projection').locator('textarea');
    await peerInput.focus();
    await peer.keyboard.type('must_not_write');
    expect((await readProjection(peer)).text).toBe(after.text);
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
