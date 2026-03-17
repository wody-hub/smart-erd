import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

interface DictionarySetSummary {
  id: number;
  isDefault: boolean;
}

interface DomainResponse {
  id: number;
  logicalName: string;
  physicalType: string;
}

interface TermResponse {
  id: number;
  logicalName: string;
  physicalName: string;
  domainId: number | null;
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response =
    method === 'GET'
      ? await request.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept-Language': 'ko',
          },
        })
      : method === 'POST'
        ? await request.post(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': 'ko',
              'Content-Type': 'application/json',
            },
            data: body,
          })
        : await request.put(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Accept-Language': 'ko',
              'Content-Type': 'application/json',
            },
            data: body,
          });

  if (!response.ok()) {
    throw new Error(`Request failed ${response.status()} for ${url}`);
  }

  if (response.status() === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

test('diagram re-entry reconciles latest term and domain changes from dictionary @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);

  await loginViaUi(page, { ...config, ...fixture });
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (!token) {
    throw new Error('Access token not found after login');
  }

  const dictionarySets = await apiJson<DictionarySetSummary[]>(
    request,
    'GET',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets`,
    token,
  );
  const defaultDictionarySet = dictionarySets.find((candidate) => candidate.isDefault) ?? dictionarySets[0];
  if (!defaultDictionarySet) {
    throw new Error('Default dictionary set was not found');
  }

  const domain = await apiJson<DomainResponse>(
    request,
    'POST',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${defaultDictionarySet.id}/domains`,
    token,
    {
      logicalName: '식별자',
      physicalType: 'BIGINT',
      description: '초기 도메인',
    },
  );

  const term = await apiJson<TermResponse>(
    request,
    'POST',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${defaultDictionarySet.id}/terms`,
    token,
    {
      logicalName: '사용자 아이디',
      physicalName: 'user_id',
      domainId: domain.id,
      description: '초기 용어',
    },
  );

  await apiJson<void>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    token,
    {
      content: JSON.stringify({
        nodes: [
          {
            id: 'table-1',
            type: 'table',
            position: { x: 120, y: 120 },
            data: {
              label: 'users',
              columns: [
                {
                  id: 'col-1',
                  logicalName: '사용자 아이디',
                  name: 'user_id',
                  type: 'BIGINT',
                  nullable: true,
                  termId: term.id,
                  domainId: domain.id,
                },
              ],
            },
          },
        ],
        edges: [],
        groups: [],
      }),
    },
  );

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  const node = page.locator('.react-flow__node-table').first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  await expect(node.getByText('사용자 아이디', { exact: true })).toBeVisible();
  await expect(node.getByText('user_id', { exact: true })).toBeVisible();
  await expect(node.getByText('BIGINT', { exact: true })).toBeVisible();
  await expect(node.getByText('식별자', { exact: true })).toBeVisible();

  await apiJson<DomainResponse>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${defaultDictionarySet.id}/domains/${domain.id}`,
    token,
    {
      logicalName: '회원식별자',
      physicalType: 'UUID',
      description: '변경된 도메인',
    },
  );

  await apiJson<TermResponse>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/dictionary-sets/${defaultDictionarySet.id}/terms/${term.id}`,
    token,
    {
      logicalName: '회원 아이디',
      physicalName: 'member_id',
      domainId: domain.id,
      description: '변경된 용어',
    },
  );

  await page.goto(`${config.baseUrl}/teams`, { waitUntil: 'networkidle' });
  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  const updatedNode = page.locator('.react-flow__node-table').first();
  await expect(updatedNode).toBeVisible({ timeout: 15_000 });
  await expect(updatedNode.getByText('회원 아이디', { exact: true })).toBeVisible();
  await expect(updatedNode.getByText('member_id', { exact: true })).toBeVisible();
  await expect(updatedNode.getByText('UUID', { exact: true })).toBeVisible();
  await expect(updatedNode.getByText('회원식별자', { exact: true })).toBeVisible();

  test.info().annotations.push(
    { type: 'target-team', description: `${fixture.target.teamId}:${fixture.target.teamName}` },
    {
      type: 'target-project',
      description: `${fixture.target.projectId}:${fixture.target.projectName}`,
    },
    {
      type: 'target-diagram',
      description: `${fixture.target.diagramId}:${fixture.target.diagramName}`,
    },
  );
});
