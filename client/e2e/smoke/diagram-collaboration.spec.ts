import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

const PROPAGATION_TIMEOUT_MS = 15_000;

test('diagram changes propagate across isolated browser contexts @smoke', async ({ browser }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  const ownerContext = await browser.newContext();
  const peerContext = await browser.newContext();

  try {
    const ownerPage = await ownerContext.newPage();
    const peerPage = await peerContext.newPage();

    await loginViaUi(ownerPage, { ...config, ...fixture });
    const target = fixture.target;
    const targetUrl = diagramUrl(config, target);

    await loginViaUi(peerPage, { ...config, ...fixture });

    await ownerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await peerPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await expectDiagramHeaderVisible(ownerPage, target);
    await expectDiagramHeaderVisible(peerPage, target);
    await waitForEditableDiagram(ownerPage, 30_000);
    await waitForEditableDiagram(peerPage, 30_000);
    await delay(2_000);

    const ownerSidebar = ownerPage.getByRole('complementary');
    const peerSidebar = peerPage.getByRole('complementary');
    const tableItems = ownerSidebar.getByText(/^Table \d+$/);
    const beforeCount = await tableItems.count();

    await ownerPage.getByRole('button', { name: /테이블 추가|add table/i }).click();
    await expect(tableItems).toHaveCount(beforeCount + 1, { timeout: PROPAGATION_TIMEOUT_MS });

    const createdTableName = (await tableItems.last().textContent())?.trim();
    if (!createdTableName) {
      throw new Error('Created table name was not resolved');
    }

    await expect(ownerSidebar.getByText(createdTableName, { exact: true })).toBeVisible({
      timeout: PROPAGATION_TIMEOUT_MS,
    });
    await expect(peerSidebar.getByText(createdTableName, { exact: true })).toBeVisible({
      timeout: PROPAGATION_TIMEOUT_MS,
    });

    const undoButton = ownerPage.getByRole('button', { name: /되돌리기|undo/i });
    await expect(undoButton).toBeEnabled({ timeout: 10_000 });
    await undoButton.click();

    await expect(ownerSidebar.getByText(createdTableName, { exact: true })).toHaveCount(0, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });
    await expect(peerSidebar.getByText(createdTableName, { exact: true })).toHaveCount(0, {
      timeout: PROPAGATION_TIMEOUT_MS,
    });

    test
      .info()
      .annotations.push(
        { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
        { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
        { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
      );
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});
