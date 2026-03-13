import { expect, test } from '@playwright/test';
import {
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
} from '../shared/diagram-e2e';

test('term registration validates typed logical name against words without freezing @smoke', async ({
  page,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });

  await page.goto(`${config.baseUrl}/teams/${fixture.target.teamId}/dictionary`, {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('tab', { name: /단어 사전|words|word dictionary/i })).toBeVisible();
  await page.getByRole('button', { name: /단어 추가|add word/i }).first().click();

  const wordDialog = page.getByRole('dialog', { name: /단어 추가|add word/i });
  await expect(wordDialog).toBeVisible();
  await wordDialog.getByLabel(/논리명|logical name/i).fill('사용자');
  await wordDialog.getByLabel(/물리명|physical name/i).fill('user');
  await wordDialog.getByRole('button', { name: /생성|create/i }).click();
  await expect(wordDialog).toHaveCount(0);

  await expect(page.getByText('사용자', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /용어 사전|terms|term dictionary/i }).click();
  await expect(page.getByRole('button', { name: /용어 추가|add term/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /용어 추가|add term/i }).first().click();

  const termDialog = page.getByRole('dialog', { name: /용어 추가|add term/i });
  await expect(termDialog).toBeVisible();

  const logicalNameInput = termDialog.getByLabel(/논리명|logical name/i);
  await logicalNameInput.fill('사용자식별자');

  await expect(
    termDialog.getByText(/등록되지 않은 단어가 포함되어 있습니다|Some words are missing/i),
  ).toBeVisible();
  await expect(termDialog.getByText('사용자', { exact: true })).toBeVisible();
  await expect(termDialog.getByText('식별자', { exact: true })).toBeVisible();

  const createMissingWordButton = termDialog.getByRole('button', {
    name: /식별자.*단어 추가|Add word "식별자"/i,
  });
  await createMissingWordButton.click();

  const missingWordDialog = page.getByRole('dialog', { name: /단어 추가|add word/i });
  await expect(missingWordDialog).toBeVisible();
  await expect(missingWordDialog.getByLabel(/논리명|logical name/i)).toHaveValue('식별자');
  await missingWordDialog.getByLabel(/물리명|physical name/i).fill('identifier');
  await missingWordDialog.getByRole('button', { name: /생성|create/i }).click();
  await expect(missingWordDialog).toHaveCount(0);

  await expect(termDialog.getByRole('textbox', { name: /물리명|physical name/i })).toHaveValue(
    'user_identifier',
  );

  const submitButton = termDialog.getByRole('button', { name: /생성|create/i });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(termDialog).toHaveCount(0);
  await expect(page.getByText('사용자식별자', { exact: true })).toBeVisible();
  await expect(page.getByText('user_identifier', { exact: true })).toBeVisible();
});
