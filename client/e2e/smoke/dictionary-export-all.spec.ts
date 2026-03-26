import { expect, test } from '@playwright/test';
import {
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

test('전체 엑셀 다운로드 클릭 시 서버가 엑셀을 정상 응답한다 @smoke', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });

  // 사전 페이지 진입
  await page.goto(`${config.baseUrl}/teams/${fixture.target.teamId}/dictionary`, {
    waitUntil: 'networkidle',
  });

  // 사전 세트 로딩 대기
  await expect(page.getByRole('tab', { name: /단어 사전|words|word dictionary/i })).toBeVisible();

  // "Export All" 버튼 확인
  const downloadButton = page.getByRole('button', {
    name: /전체 엑셀 다운로드|export all/i,
  });
  await expect(downloadButton).toBeVisible();
  await expect(downloadButton).toBeEnabled();

  // 네트워크 응답 대기 (download/excel 엔드포인트) 후 클릭
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/download/excel') && res.request().method() === 'GET',
      { timeout: 30_000 },
    ),
    downloadButton.click(),
  ]);

  // 서버 응답 검증
  expect(response.status()).toBe(200);

  const contentType = response.headers()['content-type'] ?? '';
  expect(contentType).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const contentDisposition = response.headers()['content-disposition'] ?? '';
  expect(contentDisposition).toMatch(/dictionary-all/i);

  // 성공 토스트 확인
  await expect(
    page.getByText(/전체 사전을 내려받았습니다|all dictionaries downloaded/i),
  ).toBeVisible({ timeout: 10_000 });
});

test('사전 세트 선택 상태에서 전체 엑셀 다운로드 버튼이 활성화된다 @smoke', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });

  await page.goto(`${config.baseUrl}/teams/${fixture.target.teamId}/dictionary`, {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('tab', { name: /단어 사전|words|word dictionary/i })).toBeVisible();

  const downloadButton = page.getByRole('button', {
    name: /전체 엑셀 다운로드|export all/i,
  });
  await expect(downloadButton).toBeVisible();
  await expect(downloadButton).toBeEnabled();
});
