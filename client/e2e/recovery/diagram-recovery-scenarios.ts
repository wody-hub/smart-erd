import { expect, type Page } from '@playwright/test';
import {
  captureDiagramReady,
  clickBackupAndWaitForPersistedDiagramSave,
  diagramUrl,
  dragNodeByScreenDelta,
  expectDiagramHeaderVisible,
  getE2EConfig,
  getNodeModelPosition,
  loginViaUi,
  resolveTargetDiagram,
  waitForDiagramNode,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';
import type { DiagramTarget, E2EConfig } from '../shared/diagram-e2e';

export interface DiagramRecoveryAnnotation {
  type: string;
  description: string;
}

export async function ensureRecoveryDiagramNode(
  page: Page,
  config: E2EConfig,
  target: DiagramTarget,
): Promise<{ node: Awaited<ReturnType<typeof waitForDiagramNode>>; visibleMs: number }> {
  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  const startedAt = Date.now();
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 45_000);

  const existingNodes = page.locator('.react-flow__node-table');
  if ((await existingNodes.count()) === 0) {
    await page.getByRole('button', { name: /테이블 추가|add table/i }).click();
    const createdNode = await waitForDiagramNode(page, '.react-flow__node-table');
    await clickBackupAndWaitForPersistedDiagramSave(page, target);
    return {
      node: createdNode,
      visibleMs: Date.now() - startedAt,
    };
  }

  return {
    node: await waitForDiagramNode(page, '.react-flow__node-table'),
    visibleMs: Date.now() - startedAt,
  };
}

export async function runDiagramSaveReloadReconnectScenario(
  page: Page,
): Promise<DiagramRecoveryAnnotation[]> {
  const dragDeltaX = 96;
  const dragDeltaY = 48;
  const config = getE2EConfig();
  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);

  const firstLoad = await ensureRecoveryDiagramNode(page, config, target);
  const firstNode = firstLoad.node;

  const nodeId = await firstNode.getAttribute('data-id');
  expect(nodeId).toBeTruthy();
  const node = page.locator(`[data-id="${nodeId}"]`).first();

  const before = await getNodeModelPosition(node);
  await dragNodeByScreenDelta(page, node, dragDeltaX, dragDeltaY);
  const moved = await getNodeModelPosition(node);
  await clickBackupAndWaitForPersistedDiagramSave(page, target);

  const reloadStartedAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  const reloadedNode = await waitForDiagramNode(page, `[data-id="${nodeId}"]`);
  const reloadVisibleMs = Date.now() - reloadStartedAt;
  await waitForEditableDiagram(page, 45_000);
  const afterReload = await getNodeModelPosition(reloadedNode);

  const movedDx = moved.x - before.x;
  const movedDy = moved.y - before.y;
  const persistedDx = afterReload.x - before.x;
  const persistedDy = afterReload.y - before.y;

  expect(Math.abs(persistedDx - movedDx)).toBeLessThanOrEqual(5);
  expect(Math.abs(persistedDy - movedDy)).toBeLessThanOrEqual(5);

  await dragNodeByScreenDelta(page, reloadedNode, -dragDeltaX, -dragDeltaY);
  await clickBackupAndWaitForPersistedDiagramSave(page, target);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  const restoredNode = await waitForDiagramNode(page, `[data-id="${nodeId}"]`);
  await waitForEditableDiagram(page, 45_000);
  const restored = await getNodeModelPosition(restoredNode);

  expect(Math.abs(restored.x - before.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(restored.y - before.y)).toBeLessThanOrEqual(5);

  return [
    { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
    { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
    { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
    { type: 'first-visible-ms', description: String(firstLoad.visibleMs) },
    { type: 'reload-visible-ms', description: String(reloadVisibleMs) },
  ];
}
