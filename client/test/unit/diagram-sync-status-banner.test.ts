import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import DiagramSyncStatusBanner from '../../src/components/erd/DiagramSyncStatusBanner.js';

for (const language of ['ko', 'en']) {
  for (const connectionStatus of ['connected', 'disconnected'] as const) {
    test(`${language} ${connectionStatus} snapshot timeout shows retry and clears after hydration`, async () => {
      const i18n = createInstance();
      const translation = JSON.parse(
        readFileSync(`src/i18n/locales/${language}/translation.json`, 'utf8'),
      );
      await i18n.init({
        showSupportNotice: false,
        lng: language,
        resources: { [language]: { translation } },
      });
      const render = (previewSyncStatus: 'degraded' | 'live') =>
        renderToStaticMarkup(
          createElement(
            I18nextProvider,
            { i18n },
            createElement(DiagramSyncStatusBanner, {
              connectionStatus,
              previewSyncStatus,
              onRetry: () => undefined,
            }),
          ),
        );
      const delayed = render('degraded');
      assert.ok(i18n.exists('diagram.previewSync.snapshotDelayed'));
      assert.ok(i18n.exists('diagram.previewSync.retrySnapshot'));
      const message = i18n.t('diagram.previewSync.snapshotDelayed');
      assert.ok(delayed.includes(message));
      assert.match(delayed, /<button/);
      assert.ok(delayed.includes(`aria-label="${i18n.t('diagram.previewSync.retrySnapshot')}"`));
      assert.ok(!delayed.includes('animate-spin'));
      const live = render('live');
      assert.ok(!live.includes(message));
      assert.ok(!live.includes('<button'));
    });
  }
}
