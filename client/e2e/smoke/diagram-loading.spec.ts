import { expect, test } from '@playwright/test';
import {
  captureDiagramReady,
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EConfig,
  loginViaUi,
  resolveTargetDiagram,
} from '../shared/diagram-e2e';

test('diagram first entry renders for a real project @smoke', async ({ page }) => {
  const config = getE2EConfig();
  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);

  const result = await captureDiagramReady(page, diagramUrl(config, target));
  await expectDiagramHeaderVisible(page, target);
  await expect(result.node).toBeVisible();

  test
    .info()
    .annotations.push(
      { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
      { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
      { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
      { type: 'first-visible-ms', description: String(result.visibleMs) },
    );

  expect(result.visibleMs).toBeLessThan(30_000);
});
