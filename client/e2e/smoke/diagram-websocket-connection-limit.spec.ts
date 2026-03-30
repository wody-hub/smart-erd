import { expect, test } from '@playwright/test';
import {
  diagramUrl,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

test.describe('diagram websocket connection limit banner', () => {
  test('shows connection-limit banner and recovers after closing another tab', async ({ browser }) => {
    const config = getE2EProvisioningConfig();
    const fixture = await provisionCollaborationFixture(config);
    const targetUrl = diagramUrl(config, fixture.target);

    const seedContext = await browser.newContext();
    const seedPage = await seedContext.newPage();
    await loginViaUi(seedPage, {
      ...config,
      loginId: fixture.loginId,
      password: fixture.password,
    });
    const storageState = await seedContext.storageState();

    const openContexts = [seedContext];
    for (let index = 0; index < 5; index += 1) {
      const page =
        index === 0
          ? seedPage
          : await (async () => {
              const context = await browser.newContext({ storageState });
              openContexts.push(context);
              return context.newPage();
            })();
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /Code|코드/i })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
    }

    const blockedContext = await browser.newContext({ storageState });
    const blockedPage = await blockedContext.newPage();
    await blockedPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const banner = blockedPage.getByRole('status').filter({
      hasText: /이 사용자로 열린 협업 탭이 너무 많습니다|Too many collaboration tabs are open for this user/i,
    });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(
      blockedPage.getByRole('button', { name: /다시 연결|Reconnect/i }),
    ).toBeVisible();

    await openContexts[0].close();
    await blockedPage.getByRole('button', { name: /다시 연결|Reconnect/i }).click();

    await expect(banner).toBeHidden({ timeout: 15_000 });
    await expect(blockedPage.getByRole('button', { name: /다시 연결|Reconnect/i })).toBeHidden({
      timeout: 15_000,
    });

    await blockedContext.close();
    for (const context of openContexts.slice(1)) {
      await context.close();
    }
  });
});
