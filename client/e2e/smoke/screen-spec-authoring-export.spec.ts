import { expect, test } from '@playwright/test';
import {
  assertPdfDownload,
  assertPngDownload,
  createMaster,
  dragMasterToCanvas,
  expectInstanceCountVisible,
  expectScreenNameVisible,
  getSelectedInstancePositionText,
  moveSelectedInstanceByKeyboard,
  openScreenSpecDocumentSession,
  renameSelectedScreen,
  saveScreenSpecDocument,
  selectFirstInstance,
  selectScreenByName,
  triggerExportDownload,
  updateMasterColor,
  updateMasterLabel,
  waitForScreenSpecEditorReady,
} from '../shared/screen-spec-e2e';
import { getE2EProvisioningConfig, provisionCollaborationFixture } from '../shared/diagram-e2e';

test('screen-spec master authoring propagates across screens and exports PNG/PDF @smoke', async ({
  browser,
}) => {
  const config = getE2EProvisioningConfig();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixture = await provisionCollaborationFixture(config, {
    pluginId: 'screen-spec',
    diagramName: `Screen Spec E2E ${suffix}`,
  });
  const target = fixture.target;
  const masterName = `Primary Button ${suffix}`;
  const updatedMasterLabel = `Primary CTA ${suffix}`;
  const landingScreen = `Landing ${suffix}`;
  const checkoutScreen = `Checkout ${suffix}`;
  const inheritedColor = '#2563eb';

  const context = await browser.newContext({ acceptDownloads: true });

  try {
    const page = await openScreenSpecDocumentSession(
      context,
      config,
      fixture.loginId,
      fixture.password,
      target,
    );

    await renameSelectedScreen(page, landingScreen);
    await createMaster(page, masterName);
    await dragMasterToCanvas(page, masterName);
    await expectInstanceCountVisible(page, 1);
    await expect(page.getByText(masterName, { exact: true }).first()).toBeVisible();

    await addAndRenameSecondScreen(page, checkoutScreen);
    await dragMasterToCanvas(page, masterName);
    await expectInstanceCountVisible(page, 1);
    await expect(page.getByText(masterName, { exact: true }).first()).toBeVisible();

    await updateMasterLabel(page, masterName, updatedMasterLabel);
    await updateMasterColor(page, updatedMasterLabel, inheritedColor);

    await assertInheritedInstanceState(page, landingScreen, updatedMasterLabel, inheritedColor);
    await assertInheritedInstanceState(page, checkoutScreen, updatedMasterLabel, inheritedColor);

    const beforePosition = await getSelectedInstancePositionText(page);
    await moveSelectedInstanceByKeyboard(page, 2, 1);
    await expect.poll(() => getSelectedInstancePositionText(page)).not.toBe(beforePosition);

    await saveScreenSpecDocument(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForScreenSpecEditorReady(page);

    await expectScreenNameVisible(page, landingScreen);
    await expectScreenNameVisible(page, checkoutScreen);
    await assertInheritedInstanceState(page, landingScreen, updatedMasterLabel, inheritedColor);
    await assertInheritedInstanceState(page, checkoutScreen, updatedMasterLabel, inheritedColor);

    const pngDownload = await triggerExportDownload(page, 'png');
    await assertPngDownload(pngDownload);
    const pdfDownload = await triggerExportDownload(page, 'pdf');
    await assertPdfDownload(pdfDownload);

    test
      .info()
      .annotations.push(
        { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
        { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
        { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
        { type: 'screen-spec-master', description: masterName },
      );
  } finally {
    await context.close();
  }
});

async function addAndRenameSecondScreen(page: import('@playwright/test').Page, name: string) {
  await page
    .getByRole('button', { name: /추가|add/i })
    .first()
    .click();
  await renameSelectedScreen(page, name);
}

async function assertInheritedInstanceState(
  page: import('@playwright/test').Page,
  screenName: string,
  masterLabel: string,
  expectedColor: string,
) {
  await selectScreenByName(page, screenName);
  await selectFirstInstance(page);
  await expect(page.getByText(masterLabel, { exact: true }).first()).toBeVisible();
  await expect(page.locator('#screen-spec-instance-accent')).toHaveValue(expectedColor);
  await expect(
    page.getByText(/마스터 기본값을 그대로 사용 중입니다|inherited from the master/i).first(),
  ).toBeVisible();
}
