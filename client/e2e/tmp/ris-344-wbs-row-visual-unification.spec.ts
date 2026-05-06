import { expect, test } from '@playwright/test';
import {
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

interface WbsItemSummary {
  id: number;
}

const ALPHA_TOLERANCE = 0.2;
const FLOAT_EPSILON = 1e-6;

function parseRgba(value: string): { r: number; g: number; b: number; a: number } {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Unexpected color format: ${value}`);
  }
  const parts = match[1].split(',').map((part) => part.trim());
  const [r, g, b] = parts.slice(0, 3).map((part) => Number(part));
  const a = parts[3] == null ? 1 : Number(parts[3]);
  return { r, g, b, a };
}

async function apiPost<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'ko',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

test('RIS-344: dedicated WBS row visual unification check in viewport', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config, { pluginId: 'erd' });
  const token = await loginViaUi(page, { ...config, ...fixture });
  const { teamId, projectId } = fixture.target;

  await apiPost<WbsItemSummary>(`${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`, token, {
    name: '기획',
  });
  await apiPost<WbsItemSummary>(`${config.apiBaseUrl}/teams/${teamId}/projects/${projectId}/wbs`, token, {
    name: '개발',
  });

  await page.goto(`${config.baseUrl}/teams/${teamId}/projects/${projectId}/wbs`, {
    waitUntil: 'networkidle',
  });

  const row = page.locator('tr', { has: page.getByText('기획', { exact: true }) }).first();
  await expect(row).toBeVisible();
  await row.click();
  await row.hover();

  const styleCheck = await row.evaluate((el) => {
    const cells = Array.from(el.querySelectorAll('td'));
    const stickyCell = cells.find((cell) => cell.className.includes('sticky'));
    const bodyCell = cells.find((cell) => !cell.className.includes('sticky')) ?? null;
    if (!stickyCell || !bodyCell) {
      return { ok: false as const, reason: 'missing-cells' };
    }
    const stickyStyle = window.getComputedStyle(stickyCell);
    const bodyStyle = window.getComputedStyle(bodyCell);
    const rowStyle = window.getComputedStyle(el);
    return {
      ok: true as const,
      stickyBackground: stickyStyle.backgroundColor,
      rowBackground: rowStyle.backgroundColor,
      bodyBackground: bodyStyle.backgroundColor,
      stickyShadow: stickyStyle.boxShadow,
      bodyShadow: bodyStyle.boxShadow,
    };
  });

  expect(styleCheck.ok).toBeTruthy();
  if (!styleCheck.ok) {
    throw new Error(styleCheck.reason);
  }
  const sticky = parseRgba(styleCheck.stickyBackground);
  const rowBg = parseRgba(styleCheck.rowBackground);
  expect([sticky.r, sticky.g, sticky.b]).toEqual([rowBg.r, rowBg.g, rowBg.b]);
  expect(Math.abs(sticky.a - rowBg.a)).toBeLessThanOrEqual(ALPHA_TOLERANCE + FLOAT_EPSILON);
  expect(styleCheck.bodyBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styleCheck.stickyShadow).toContain('inset');
  expect(styleCheck.bodyShadow).toContain('inset');

  await row.screenshot({ path: 'test-results/ris-344-row-viewport-check.png' });
});
