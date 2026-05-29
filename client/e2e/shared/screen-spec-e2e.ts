import fs from 'node:fs/promises';
import {
  expect,
  type BrowserContext,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';
import { diagramUrl, loginViaUi, type DiagramTarget, type E2EConfig } from './diagram-e2e';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SCREEN_SPEC_LIBRARY_ITEM_TEST_ID_PREFIX = 'screen-spec-library-item-';
const SCREEN_DESIGN_LIBRARY_DRAG_MIME = 'application/x-smart-erd-screen-library-item';
const SCREEN_SPEC_COLLABORATION_TIMEOUT_MS = 20_000;
const SCREEN_SPEC_INSTANCE_MOVE_STEP = 8;

export async function openScreenSpecDocumentSession(
  context: BrowserContext,
  config: E2EConfig,
  loginId: string,
  password: string,
  target: DiagramTarget,
): Promise<Page> {
  const page = await context.newPage();
  await loginViaUi(page, { ...config, loginId, password });
  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('button', { name: /문서로 돌아가기|back to documents/i }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/화면 캔버스|screen canvas/i).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/캔버스 연결됨|canvas (connected|live)/i).first()).toBeVisible({
    timeout: 30_000,
  });
  await waitForScreenSpecEditorReady(page);
  return page;
}

export async function waitForScreenSpecEditorReady(page: Page): Promise<void> {
  await expect(page.getByTestId('screen-spec-editor-shell')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/화면 목록|screens|screen list/i).first()).toBeVisible();
  await expect(page.getByText(/빌딩 블록|building blocks/i).first()).toBeVisible();
  await expect(page.getByText(/인스펙터|inspector/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /저장|save/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /내보내기|export/i })).toBeVisible();
}

export async function addScreen(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /추가|add/i })
    .first()
    .click();
}

export async function renameSelectedScreen(page: Page, name: string): Promise<void> {
  const input = page.getByTestId('screen-spec-screen-name-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await input.press('Enter');
  await expectScreenNameVisible(page, name);
}

export async function createMaster(page: Page, name: string): Promise<void> {
  await page.getByTestId('screen-spec-master-create').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/마스터 컴포넌트 이름|master component name/i).fill(name);
  await dialog.getByRole('button', { name: /생성|create/i }).click();
  await expect(
    page.getByTestId(/^screen-spec-master-card-/).filter({ hasText: name }),
  ).toBeVisible();
}

export async function updateMasterLabel(
  page: Page,
  currentName: string,
  nextName: string,
): Promise<void> {
  await page
    .getByTestId(/^screen-spec-master-card-/)
    .filter({ hasText: currentName })
    .getByRole('button')
    .first()
    .click();
  const input = page.getByTestId('screen-spec-master-label-input');
  await expect(input).toBeVisible();
  await input.fill(nextName);
  await input.press('Enter');
  await expect(
    page.getByTestId(/^screen-spec-master-card-/).filter({ hasText: nextName }),
  ).toBeVisible();
}

export async function updateMasterColor(
  page: Page,
  masterName: string,
  color: string,
): Promise<void> {
  await page
    .getByTestId(/^screen-spec-master-card-/)
    .filter({ hasText: masterName })
    .getByRole('button')
    .first()
    .click();
  const input = page.getByTestId('screen-spec-master-color-input');
  await expect(input).toBeVisible();
  await input.fill(color);
  await expect(input).toHaveValue(color);
}

export async function deleteMaster(page: Page, masterName: string): Promise<void> {
  const masterCard = page.getByTestId(/^screen-spec-master-card-/).filter({ hasText: masterName });
  await masterCard.getByRole('button').first().click();
  await page
    .getByRole('button', { name: /삭제|delete/i })
    .last()
    .click();
  await expect(masterCard).toHaveCount(0);
}

export async function dragFirstLibraryItemToCanvas(page: Page): Promise<void> {
  const firstItem = page.getByTestId(/^screen-spec-library-item-/).first();
  await expect(firstItem).toBeVisible();
  await dragLibraryItemToCanvas(page, firstItem);
}

export async function dragMasterToCanvas(page: Page, masterName: string): Promise<void> {
  const item = page
    .getByTestId(/^screen-spec-master-card-/)
    .filter({ hasText: masterName })
    .getByTestId(/^screen-spec-library-item-/);
  await dragLibraryItemToCanvas(page, item);
}

export async function selectFirstInstance(page: Page): Promise<void> {
  await page.keyboard.press('Tab');
  await expect(page.getByText(/마스터 기본값|master default/i)).toBeVisible();
}

export async function moveSelectedInstanceByKeyboard(
  page: Page,
  dxSteps: number,
  dySteps: number,
): Promise<void> {
  const xInput = page.getByTestId('screen-spec-instance-x-input');
  const yInput = page.getByTestId('screen-spec-instance-y-input');
  if ((await xInput.isVisible()) && (await yInput.isVisible())) {
    const currentX = Number.parseInt(await xInput.inputValue(), 10);
    const currentY = Number.parseInt(await yInput.inputValue(), 10);
    const nextX = currentX + dxSteps * SCREEN_SPEC_INSTANCE_MOVE_STEP;
    const nextY = currentY + dySteps * SCREEN_SPEC_INSTANCE_MOVE_STEP;
    await xInput.fill(String(nextX));
    await expect(xInput).toHaveValue(String(nextX));
    await yInput.fill(String(nextY));
    await expect(yInput).toHaveValue(String(nextY));
    return;
  }

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const horizontalKey = dxSteps >= 0 ? 'ArrowRight' : 'ArrowLeft';
  const verticalKey = dySteps >= 0 ? 'ArrowDown' : 'ArrowUp';
  for (let index = 0; index < Math.abs(dxSteps); index += 1) {
    await page.keyboard.press(horizontalKey);
  }
  for (let index = 0; index < Math.abs(dySteps); index += 1) {
    await page.keyboard.press(verticalKey);
  }
}

export async function resizeSelectedInstance(
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  const widthInput = page.getByTestId('screen-spec-instance-width-input');
  const heightInput = page.getByTestId('screen-spec-instance-height-input');
  await expect(widthInput).toBeVisible();
  await widthInput.fill(String(width));
  await expect(widthInput).toHaveValue(String(width));
  await expect(heightInput).toBeVisible();
  await heightInput.fill(String(height));
  await expect(heightInput).toHaveValue(String(height));
}

export async function triggerExportDownload(page: Page, format: 'png' | 'pdf'): Promise<Download> {
  const exportButton = page.getByRole('button', { name: /내보내기|export/i });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('menuitem', { name: format.toUpperCase() }).click(),
  ]);
  return download;
}

export async function saveScreenSpecDocument(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: /저장|save/i });
  await expect(saveButton).toBeEnabled();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/ydoc-snapshot') &&
        response.status() >= 200 &&
        response.status() < 300,
      { timeout: 30_000 },
    ),
    saveButton.click(),
  ]);
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
}

export async function expectScreenNameVisible(page: Page, name: string): Promise<void> {
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
    timeout: SCREEN_SPEC_COLLABORATION_TIMEOUT_MS,
  });
}

export async function selectScreenByName(page: Page, name: string): Promise<void> {
  await page
    .getByTestId(/^screen-spec-screen-card-/)
    .filter({ hasText: name })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByTestId('screen-spec-screen-name-input')).toHaveValue(name);
}

export async function expectInstanceCountVisible(page: Page, count: number): Promise<void> {
  await expect(
    page.getByText(new RegExp(`인스턴스 ${count}개|${count} instance`, 'i')).first(),
  ).toBeVisible({
    timeout: SCREEN_SPEC_COLLABORATION_TIMEOUT_MS,
  });
}

export async function getSelectedInstancePositionText(page: Page): Promise<string> {
  const positionRow = page
    .locator('dl div')
    .filter({ has: page.getByText(/위치|position/i) })
    .first();
  await expect(positionRow).toBeVisible();
  return (await positionRow.textContent())?.trim() ?? '';
}

export async function expectSelectedInstanceSize(
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  await expect(page.getByTestId('screen-spec-instance-width-input')).toHaveValue(String(width), {
    timeout: SCREEN_SPEC_COLLABORATION_TIMEOUT_MS,
  });
  await expect(page.getByTestId('screen-spec-instance-height-input')).toHaveValue(String(height));
}

export async function expectCollaborationStatus(
  page: Page,
  expected: RegExp,
  timeout = 20_000,
): Promise<void> {
  await expect(page.getByTestId('screen-spec-collaboration-status')).toContainText(expected, {
    timeout,
  });
}

export async function expectSelectedInstanceOrphaned(page: Page): Promise<void> {
  await expect(page.getByText(/삭제된 마스터|deleted master/i).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function assertPngDownload(download: Download): Promise<void> {
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const path = await download.path();
  if (!path) {
    throw new Error('PNG download path was not available');
  }
  const buffer = await fs.readFile(path);
  expect(buffer.byteLength).toBeGreaterThan(0);
  expect(buffer.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)).toBe(true);
}

export async function assertPdfDownload(download: Download): Promise<void> {
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const path = await download.path();
  if (!path) {
    throw new Error('PDF download path was not available');
  }
  const buffer = await fs.readFile(path);
  expect(buffer.byteLength).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
  const pdfBody = buffer.toString('latin1');
  expect(pdfBody).toMatch(/\/Type\s*\/Page|\/Count\s+\d+|startxref/);
}

async function dragLibraryItemToCanvas(page: Page, item: Locator): Promise<void> {
  const dropzone = page.getByTestId('screen-spec-canvas-dropzone');
  await expect(dropzone).toBeVisible();
  const testId = await item.getAttribute('data-testid');
  const itemId = testId?.startsWith(SCREEN_SPEC_LIBRARY_ITEM_TEST_ID_PREFIX)
    ? testId.slice(SCREEN_SPEC_LIBRARY_ITEM_TEST_ID_PREFIX.length)
    : null;
  if (!itemId) {
    throw new Error(`Unable to resolve screen-spec library item id from ${testId ?? 'null'}`);
  }
  await dropzone.evaluate(
    (element, { dragMime, masterId }) => {
      const rect = element.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(dragMime, masterId);
      const eventInit = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 360,
        clientY: rect.top + 240,
        dataTransfer,
      };
      element.dispatchEvent(new DragEvent('dragover', eventInit));
      element.dispatchEvent(new DragEvent('drop', eventInit));
    },
    {
      dragMime: SCREEN_DESIGN_LIBRARY_DRAG_MIME,
      masterId: itemId,
    },
  );
  await selectFirstInstance(page);
}
