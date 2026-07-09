import test from 'node:test';
import assert from 'node:assert/strict';

import { exportImageDiagram, exportPdfDiagram } from '../../src/lib/export/export-executors.js';
import type {
  CaptureOptions,
  ExportProgressController,
  UpdateExportProgressOptions,
} from '../../src/lib/export/export-types.js';

const createProgressStub = (): ExportProgressController => ({
  beginExport: async () => true,
  updateExportProgress: async () => undefined,
  finishExportProgress: async () => undefined,
  failExportProgress: async () => undefined,
  resetExportProgress: () => undefined,
});

test('exportImageDiagram renders JPG with high quality image options', async () => {
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalWindow = globalThis.window;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const captured: {
    renderOptions?: { pixelRatio?: number; quality?: number; type?: string };
  } = {};
  let capturedBlobType: string | undefined;
  let capturedBlobQuality: number | undefined;

  globalThis.getComputedStyle = (() => ({
    getPropertyValue: () => '0 0% 100%',
  })) as unknown as typeof globalThis.getComputedStyle;
  globalThis.document = {
    documentElement: {},
    body: {
      appendChild: () => undefined,
      removeChild: () => undefined,
    },
    createElement: () => ({
      href: '',
      download: '',
      click: () => undefined,
    }),
  } as unknown as Document;
  globalThis.window = {
    setTimeout: () => 0,
  } as unknown as Window & typeof globalThis;
  URL.createObjectURL = () => 'blob:export-test';
  URL.revokeObjectURL = () => undefined;

  try {
    await exportImageDiagram({
      filename: 'diagram.jpg',
      opts: {
        viewportEl: {} as HTMLElement,
        imageWidth: 2000,
        imageHeight: 1200,
        viewport: { x: 0, y: 0, zoom: 1 },
      } satisfies CaptureOptions,
      format: 'jpg',
      mimeType: 'image/jpeg',
      progress: createProgressStub(),
      getHtmlToImageModule: async () =>
        ({
          toCanvas: async (
            _node: HTMLElement,
            options: { pixelRatio?: number; quality?: number; type?: string },
          ) => {
            captured.renderOptions = options;
            return {
              toBlob: (
                callback: BlobCallback,
                type?: string,
                quality?: number,
              ): void => {
                capturedBlobType = type;
                capturedBlobQuality = quality;
                callback(new Blob(['image'], { type }));
              },
            } as HTMLCanvasElement;
          },
        }) as unknown as typeof import('html-to-image'),
      getFontEmbedCss: async () => '',
    });
  } finally {
    globalThis.document = originalDocument;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }

  if (!captured.renderOptions) {
    assert.fail('Expected html-to-image render options to be captured.');
  }
  const renderOptions = captured.renderOptions;
  assert.equal(renderOptions.pixelRatio, 4);
  assert.equal(renderOptions.quality, 1);
  assert.equal(renderOptions.type, 'image/jpeg');
  assert.equal(capturedBlobType, 'image/jpeg');
  assert.equal(capturedBlobQuality, 1);
});

test('exportPdfDiagram reports high-resolution tile progress', async () => {
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;

  const progressUpdates: UpdateExportProgressOptions[] = [];
  const renderOptions: Array<{
    width?: number;
    height?: number;
    pixelRatio?: number;
    type?: string;
    style?: { transform?: string };
  }> = [];
  const saved: { filename?: string; imageCount: number } = { imageCount: 0 };

  globalThis.getComputedStyle = (() => ({
    getPropertyValue: () => '0 0% 100%',
  })) as unknown as typeof globalThis.getComputedStyle;
  globalThis.document = { documentElement: {} } as unknown as Document;

  try {
    const result = await exportPdfDiagram({
      filename: 'diagram.pdf',
      opts: {
        viewportEl: {} as HTMLElement,
        imageWidth: 5000,
        imageHeight: 1000,
        viewport: { x: 0, y: 0, zoom: 1 },
      } satisfies CaptureOptions,
      progress: {
        ...createProgressStub(),
        updateExportProgress: async (options) => {
          progressUpdates.push(options);
        },
      },
      getHtmlToImageModule: async () =>
        ({
          toCanvas: async (
            _node: HTMLElement,
            options: {
              width?: number;
              height?: number;
              pixelRatio?: number;
              type?: string;
              style?: { transform?: string };
            },
          ) => {
            renderOptions.push(options);
            return {
              toDataURL: () => 'data:image/png;base64,AAAA',
            } as HTMLCanvasElement;
          },
        }) as unknown as typeof import('html-to-image'),
      getJsPdfModule: async () =>
        ({
          jsPDF: class {
            addImage(): void {
              saved.imageCount += 1;
            }

            save(filename: string): void {
              saved.filename = filename;
            }
          },
        }) as unknown as typeof import('jspdf'),
      getFontEmbedCss: async () => '',
    });

    assert.equal(result.tiledPageCount, 2);
  } finally {
    globalThis.document = originalDocument;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }

  assert.deepEqual(renderOptions.map(({ width, height, pixelRatio, type }) => ({ width, height, pixelRatio, type })), [
    { width: 4096, height: 1000, pixelRatio: 3, type: 'image/png' },
    { width: 904, height: 1000, pixelRatio: 3, type: 'image/png' },
  ]);
  assert.match(renderOptions[0]?.style?.transform ?? '', /translate\(0px, 0px\)/);
  assert.match(renderOptions[1]?.style?.transform ?? '', /translate\(-4096px, 0px\)/);
  assert.equal(saved.imageCount, 2);
  assert.equal(saved.filename, 'diagram.pdf');
  assert.deepEqual(
    progressUpdates
      .filter((update) => update.detailKey === 'erd.export.progress.renderingTile')
      .map((update) => update.detailValues),
    [
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ],
  );
});
