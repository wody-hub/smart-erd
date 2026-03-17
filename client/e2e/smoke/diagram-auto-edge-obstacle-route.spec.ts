import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

async function apiJson<T>(
  request: APIRequestContext,
  method: 'PUT',
  url: string,
  token: string,
  body: unknown,
): Promise<T> {
  const response = await request.put(url, {
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

test('smoothstep auto edge avoids passing under an intermediate table @smoke', async ({
  page,
  request,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  const token = await loginViaUi(page, { ...config, ...fixture });

  await apiJson<void>(
    request,
    'PUT',
    `${config.apiBaseUrl}/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams/${fixture.target.diagramId}`,
    token,
    {
      content: JSON.stringify({
        nodes: [
          {
            id: 'table-source',
            type: 'table',
            position: { x: 80, y: 60 },
            data: {
              label: 'source_tbl',
              columns: [
                {
                  id: 'col-source-id',
                  logicalName: 'source id',
                  name: 'source_id',
                  type: 'BIGINT',
                  nullable: false,
                  pk: true,
                },
              ],
            },
          },
          {
            id: 'table-blocker',
            type: 'table',
            position: { x: 110, y: 280 },
            data: {
              label: 'blocker_tbl',
              columns: [
                {
                  id: 'col-blocker-id',
                  logicalName: 'blocker id',
                  name: 'blocker_id',
                  type: 'BIGINT',
                  nullable: false,
                  pk: true,
                },
                {
                  id: 'col-blocker-name',
                  logicalName: 'blocker name',
                  name: 'blocker_name',
                  type: 'VARCHAR(100)',
                  nullable: false,
                },
                {
                  id: 'col-blocker-desc',
                  logicalName: 'blocker desc',
                  name: 'blocker_desc',
                  type: 'TEXT',
                  nullable: true,
                },
                {
                  id: 'col-blocker-created',
                  logicalName: 'blocker created',
                  name: 'blocker_created_at',
                  type: 'TIMESTAMP',
                  nullable: false,
                },
                {
                  id: 'col-blocker-updated',
                  logicalName: 'blocker updated',
                  name: 'blocker_updated_at',
                  type: 'TIMESTAMP',
                  nullable: false,
                },
              ],
            },
          },
          {
            id: 'table-target',
            type: 'table',
            position: { x: 160, y: 560 },
            data: {
              label: 'target_tbl',
              columns: [
                {
                  id: 'col-target-id',
                  logicalName: 'target id',
                  name: 'target_id',
                  type: 'BIGINT',
                  nullable: false,
                  pk: true,
                },
              ],
            },
          },
        ],
        edges: [
          {
            id: 'edge-obstacle',
            source: 'table-source',
            target: 'table-target',
            sourceHandle: 'table-source-col-source-id-source-right',
            targetHandle: 'table-target-col-target-id-target-right',
            type: 'erdRelation',
            data: {
              relationType: 'non-identifying',
              routingType: 'smoothstep',
            },
          },
        ],
        groups: [],
      }),
    },
  );

  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  const sourceNode = page.locator('.react-flow__node-table', { hasText: 'source_tbl' }).first();
  const blockerNode = page.locator('.react-flow__node-table', { hasText: 'blocker_tbl' }).first();
  const targetNode = page.locator('.react-flow__node-table', { hasText: 'target_tbl' }).first();
  const edgePath = page
    .locator('.react-flow__edge[data-id="edge-obstacle"] .react-flow__edge-path')
    .first();

  await expect(sourceNode).toBeVisible();
  await expect(blockerNode).toBeVisible();
  await expect(targetNode).toBeVisible();
  await expect(edgePath).toHaveAttribute('d', /.+/);

  const intersectsBlocker = await page.evaluate(
    ({ edgeSelector, blockerText }) => {
      const edge = document.querySelector<SVGPathElement>(edgeSelector);
      const blocker = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node-table')).find(
        (candidate) => candidate.textContent?.includes(blockerText),
      );
      if (!edge || !blocker) {
        throw new Error('Target edge or blocker node not found');
      }

      const blockerRect = blocker.getBoundingClientRect();
      const ctm = edge.getScreenCTM();
      if (!ctm) {
        throw new Error('Edge screen transform not available');
      }

      const length = edge.getTotalLength();
      const sampleCount = 80;
      for (let index = 0; index <= sampleCount; index += 1) {
        const point = edge.getPointAtLength((length * index) / sampleCount);
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(ctm);
        if (
          screenPoint.x > blockerRect.left + 6 &&
          screenPoint.x < blockerRect.right - 6 &&
          screenPoint.y > blockerRect.top + 6 &&
          screenPoint.y < blockerRect.bottom - 6
        ) {
          return true;
        }
      }

      return false;
    },
    {
      edgeSelector: '.react-flow__edge[data-id="edge-obstacle"] .react-flow__edge-path',
      blockerText: 'blocker_tbl',
    },
  );

  expect(intersectsBlocker).toBe(false);
});
