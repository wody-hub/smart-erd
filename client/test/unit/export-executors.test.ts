import test from 'node:test';
import assert from 'node:assert/strict';

import { exportImageDiagram } from '../../src/lib/export/export-executors.js';
import type { CaptureOptions, ExportProgressController } from '../../src/lib/export/export-types.js';

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
