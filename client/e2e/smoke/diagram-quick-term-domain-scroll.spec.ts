import { expect, test } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  openCodeEditor,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ko',
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ko',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

test('quick term domain dropdown scrolls inside the diagram code flow @smoke', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  const token = await loginViaUi(page, { ...config, ...fixture });
  const dictionarySets = await fetchJson<DictionarySetSummary[]>(
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets`,
    token,
  );
  const dictionarySetId =
    dictionarySets.find((candidate) => candidate.isDefault)?.id ?? dictionarySets[0]?.id;

  if (!dictionarySetId) {
    throw new Error('Dictionary set was not provisioned');
  }

  for (let index = 1; index <= 12; index += 1) {
    await postJson(
      `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${dictionarySetId}/domains`,
      token,
      {
        logicalName: `스크롤도메인${String(index).padStart(2, '0')}`,
        physicalType: `VARCHAR(${80 + index})`,
        description: `scroll domain ${index}`,
      },
    );
  }

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  await openCodeEditor(page);

  await page.evaluate(() => {
    const model = window.monaco?.editor?.getModels?.()[0];
    if (!model) {
      throw new Error('Monaco model not found');
    }
    model.setValue('Table 사용자 {\n  신규컬럼\n}');
  });

  const errorGuideButton = page.getByRole('button', {
    name: /DSL 오류 가이드 열기|Open DSL error guide/i,
  });
  await expect(errorGuideButton).toContainText('2');
  await errorGuideButton.click();

  await page
    .getByRole('button', {
      name: /ERROR 2행 사전에 없는 논리명: 신규컬럼|ERROR 2 .*Unknown term: 신규컬럼/i,
    })
    .click();
  await page
    .getByRole('button', {
      name: /'신규컬럼' 용어 등록|Register term '신규컬럼'/i,
    })
    .click();
  await page.getByRole('combobox', { name: /도메인|domain/i }).click();

  const list = page.locator('[cmdk-list]');
  await expect(list).toBeVisible();

  const beforeScroll = await page.evaluate(() => {
    const node = document.querySelector('[cmdk-list]');
    if (!node) {
      throw new Error('Command list not found');
    }
    return {
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    };
  });

  expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight);

  await list.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const node = document.querySelector('[cmdk-list]');
          return node ? node.scrollTop : 0;
        }),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
});
