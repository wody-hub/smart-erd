import { expect, test, type Page } from '@playwright/test';
import {
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EProvisioningConfig,
  loginViaUi,
  provisionCollaborationFixture,
  waitForEditableDiagram,
} from '../shared/diagram-e2e';

/** 에러 심각도(Monaco MarkerSeverity.Error). */
const MARKER_ERROR_SEVERITY = 8;
/** 지연 로드되는 Monaco 청크를 늦춰 파싱 결과가 에디터 마운트보다 먼저 도착하게 만든다. */
const MONACO_LOAD_DELAY_MS = 4000;

/** DSL 편집기의 에러 마커 개수를 읽는다. 에디터가 아직 없으면 -1. */
async function readErrorMarkerCount(page: Page): Promise<number> {
  return page.evaluate((severity) => {
    const monaco = (
      window as unknown as {
        monaco?: {
          editor: {
            getEditors: () => { getModel: () => { uri: unknown } | null }[];
            getModelMarkers: (filter: { resource: unknown }) => { severity: number }[];
          };
        };
      }
    ).monaco;
    const model = monaco?.editor.getEditors()[0]?.getModel();
    if (!monaco || !model) return -1;
    return monaco.editor
      .getModelMarkers({ resource: model.uri })
      .filter((marker) => marker.severity === severity).length;
  }, MARKER_ERROR_SEVERITY);
}

test('code editor shows error markers even when Monaco loads after the parse result @smoke', async ({
  page,
}) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  await loginViaUi(page, { ...config, ...fixture });
  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await waitForEditableDiagram(page, 30_000);

  await page.getByRole('combobox', { name: /작업 모드|work mode/i }).click();
  await page.getByRole('option', { name: /코드 위주|code-first/i }).click();
  await page.waitForSelector('.monaco-editor', { timeout: 30_000 });
  await page.evaluate(() => {
    const monaco = (
      window as unknown as {
        monaco: {
          editor: {
            getEditors: () => {
              focus: () => void;
              getModel: () => { setValue: (v: string) => void };
            }[];
          };
        };
      }
    ).monaco;
    const editor = monaco.editor.getEditors()[0];
    editor.focus();
    editor
      .getModel()
      .setValue('Table 사전에없는테이블 {\n  사전에없는컬럼 ::VARCHAR(50) [NN]\n}\n');
  });
  await expect.poll(() => readErrorMarkerCount(page)).toBeGreaterThan(0);

  // 새로고침 후 Monaco 청크를 늦게 받아도(진단이 에디터 마운트보다 먼저 계산돼도) 마커가 표시돼야 한다.
  await page.route(/monaco/i, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MONACO_LOAD_DELAY_MS));
    await route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.monaco-editor', { timeout: 60_000 });
  await expect.poll(() => readErrorMarkerCount(page), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('diagram header has a button that returns to the document list @smoke', async ({ page }) => {
  const config = getE2EProvisioningConfig();
  const fixture = await provisionCollaborationFixture(config);
  await loginViaUi(page, { ...config, ...fixture });
  await page.goto(diagramUrl(config, fixture.target), { waitUntil: 'domcontentloaded' });
  await expectDiagramHeaderVisible(page, fixture.target);
  await waitForEditableDiagram(page, 30_000);

  await page.getByRole('button', { name: /문서 허브로|back to documents/i }).click();
  await expect(page).toHaveURL(
    new RegExp(`/teams/${fixture.target.teamId}/projects/${fixture.target.projectId}/diagrams$`),
  );
});
