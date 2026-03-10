import { expect, test } from '@playwright/test';
import {
  captureDiagramReady,
  clickBackup,
  diagramUrl,
  dragNodeByScreenDelta,
  dragNodeToModelPosition,
  expectDiagramHeaderVisible,
  getE2EConfig,
  getNodeModelPosition,
  loginViaUi,
  resolveTargetDiagram,
  restartBackend,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

test('diagram node position survives graceful backend restart @recovery', async ({ page }) => {
  test.slow();

  const config = getE2EConfig();
  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);

  const firstLoad = await captureDiagramReady(page, diagramUrl(config, target));
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 45_000);

  const nodeId = await firstLoad.node.getAttribute('data-id');
  expect(nodeId).toBeTruthy();
  const node = page.locator(`[data-id="${nodeId}"]`).first();

  const before = await getNodeModelPosition(node);
  await dragNodeByScreenDelta(page, node, 80, 40);
  const moved = await getNodeModelPosition(node);
  await clickBackup(page);
  await page.waitForTimeout(7_000);

  await restartBackend(config);

  const reload = await captureDiagramReady(
    page,
    diagramUrl(config, target),
    `[data-id="${nodeId}"]`,
  );
  await expectDiagramHeaderVisible(page, target);
  const reloadedNode = reload.node;
  const afterReload = await getNodeModelPosition(reloadedNode);

  const movedDx = moved.x - before.x;
  const movedDy = moved.y - before.y;
  const persistedDx = afterReload.x - before.x;
  const persistedDy = afterReload.y - before.y;

  expect(Math.abs(persistedDx - movedDx)).toBeLessThanOrEqual(5);
  expect(Math.abs(persistedDy - movedDy)).toBeLessThanOrEqual(5);

  await dragNodeToModelPosition(page, reloadedNode, before);
  await clickBackup(page);
  await page.waitForTimeout(7_000);

  const restored = await getNodeModelPosition(reloadedNode);
  expect(Math.abs(restored.x - before.x)).toBeLessThanOrEqual(5);
  expect(Math.abs(restored.y - before.y)).toBeLessThanOrEqual(5);

  test
    .info()
    .annotations.push(
      { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
      { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
      { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
      { type: 'first-visible-ms', description: String(firstLoad.visibleMs) },
      { type: 'reload-visible-ms', description: String(reload.visibleMs) },
    );
});
