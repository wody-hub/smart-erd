import { expect, test } from '@playwright/test';

test('guide deep link lands #erd-dsl directly under the sticky header @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/guide#erd-dsl', { waitUntil: 'domcontentloaded' });

  const guideHeader = page.locator('[data-guide-header]');
  const dslSection = page.locator('#erd-dsl');

  await expect(guideHeader).toBeVisible();
  await expect(dslSection).toBeVisible();

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const header = document.querySelector<HTMLElement>('[data-guide-header]');
          const section = document.getElementById('erd-dsl');
          if (!header || !section) {
            return null;
          }

          return Math.round(
            section.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
          );
        }),
      { timeout: 5_000 },
    )
    .toBeLessThanOrEqual(24);

  const landing = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-guide-header]');
    const section = document.getElementById('erd-dsl');
    if (!header || !section) {
      throw new Error('Guide header or #erd-dsl section not found');
    }

    return {
      gap: Math.round(section.getBoundingClientRect().top - header.getBoundingClientRect().bottom),
      hash: window.location.hash,
    };
  });

  expect(landing.hash).toBe('#erd-dsl');
  expect(landing.gap).toBeGreaterThanOrEqual(0);
  expect(landing.gap).toBeLessThanOrEqual(24);
});
