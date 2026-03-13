import { expect, test } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

test('quick term registration in diagram requires word composition and supports inline word creation @smoke', async ({
  page,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });

  const target = fixture.target;
  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 30_000);

  await page.getByRole('button', { name: /테이블 추가|add table/i }).click();

  const node = page.locator('.react-flow__node-table').first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.getByText('Table 1', { exact: true }).dblclick();

  const columnLogicalNameInput = node.getByLabel(/컬럼 논리명|column logical name/i).nth(1);
  await columnLogicalNameInput.click();
  await columnLogicalNameInput.fill('사용자');

  await page.getByText(/신규 용어 등록|단어\/용어 등록|register new term|register words\/term/i).click();

  const quickTermDialog = page.getByRole('dialog', { name: /빠른 용어 등록|quick term registration/i });
  await expect(quickTermDialog).toBeVisible();
  await expect(
    quickTermDialog.getByText(/등록되지 않은 단어가 포함되어 있습니다|Some words are missing/i),
  ).toBeVisible();
  await expect(
    quickTermDialog.getByRole('textbox', { name: /논리명|logical name/i }),
  ).toHaveValue('사용자');

  const submitButton = quickTermDialog.getByRole('button', { name: /등록 및 적용|register & apply/i });
  await expect(submitButton).toBeDisabled();

  await quickTermDialog.getByRole('button', { name: /새 단어|new word/i }).click();

  const wordDialog = page.getByRole('dialog', { name: /단어 추가|add word/i });
  await expect(wordDialog).toBeVisible();
  await expect(wordDialog.getByLabel(/논리명|logical name/i)).toHaveValue('');
  await wordDialog.getByLabel(/논리명|logical name/i).fill('사용자');
  await wordDialog.getByLabel(/물리명|physical name/i).fill('user');
  await wordDialog.getByRole('button', { name: /생성|create/i }).click();

  await expect(wordDialog).toHaveCount(0);
  await expect(quickTermDialog.getByRole('textbox', { name: /논리명|logical name/i })).toHaveValue(
    '사용자',
  );
  await expect(quickTermDialog.getByRole('textbox', { name: /물리명|physical name/i })).toHaveValue(
    'user',
  );
  await expect(submitButton).toBeEnabled();

  await submitButton.evaluate((element: HTMLButtonElement) => element.click());

  await expect(quickTermDialog).toHaveCount(0);
  await expect(node.getByLabel(/컬럼 논리명|column logical name/i).nth(1)).toHaveValue('사용자');
  await expect(node.getByLabel(/컬럼 이름|column name/i).first()).toHaveValue('user');

  test
    .info()
    .annotations.push(
      { type: 'target-team', description: `${target.teamId}:${target.teamName}` },
      { type: 'target-project', description: `${target.projectId}:${target.projectName}` },
      { type: 'target-diagram', description: `${target.diagramId}:${target.diagramName}` },
    );
});

test('diagram derives physical name from words and keeps warning until the full term is registered @smoke', async ({
  page,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });

  await page.goto(`${config.baseUrl}/teams/${fixture.target.teamId}/dictionary`, {
    waitUntil: 'networkidle',
  });

  await page.getByRole('button', { name: /단어 추가|add word/i }).first().click();
  const firstWordDialog = page.getByRole('dialog', { name: /단어 추가|add word/i });
  await firstWordDialog.getByLabel(/논리명|logical name/i).fill('사용자');
  await firstWordDialog.getByLabel(/물리명|physical name/i).fill('user');
  await firstWordDialog.getByRole('button', { name: /생성|create/i }).click();
  await expect(firstWordDialog).toHaveCount(0);

  await page.getByRole('button', { name: /단어 추가|add word/i }).first().click();
  const secondWordDialog = page.getByRole('dialog', { name: /단어 추가|add word/i });
  await secondWordDialog.getByLabel(/논리명|logical name/i).fill('아이디');
  await secondWordDialog.getByLabel(/물리명|physical name/i).fill('id');
  await secondWordDialog.getByRole('button', { name: /생성|create/i }).click();
  await expect(secondWordDialog).toHaveCount(0);

  const target = fixture.target;
  await page.goto(diagramUrl(config, target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, target);
  await waitForEditableDiagram(page, 30_000);

  await page.getByRole('button', { name: /테이블 추가|add table/i }).click();

  const node = page.locator('.react-flow__node-table').first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.getByText('Table 1', { exact: true }).dblclick();

  const columnLogicalNameInput = node.getByLabel(/컬럼 논리명|column logical name/i).nth(1);
  const columnNameInput = node.getByLabel(/컬럼 이름|column name/i).first();

  await columnLogicalNameInput.click();
  await columnLogicalNameInput.fill('사용자 아이디');
  await expect(columnNameInput).toHaveValue('user_id');
  await expect(
    node.getByLabel(/사전 불일치 경고|dictionary mismatch warning/i).first(),
  ).toBeVisible();

  await page
    .getByText(/신규 용어 등록|단어\/용어 등록|register new term|register words\/term/i)
    .click();

  const quickTermDialog = page.getByRole('dialog', {
    name: /빠른 용어 등록|quick term registration/i,
  });
  await expect(quickTermDialog).toBeVisible();
  await expect(quickTermDialog.getByRole('textbox', { name: /물리명|physical name/i })).toHaveValue(
    'user_id',
  );

  const submitButton = quickTermDialog.getByRole('button', {
    name: /등록 및 적용|register & apply/i,
  });
  await expect(submitButton).toBeEnabled();
  await submitButton.evaluate((element: HTMLButtonElement) => element.click());

  await expect(quickTermDialog).toHaveCount(0);
  await expect(columnNameInput).toHaveValue('user_id');
  await expect(node.getByLabel(/사전 불일치 경고|dictionary mismatch warning/i)).toHaveCount(0);
});
