import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { toPreviewSyncStatus } from '../../src/collaboration/core/collaboration-preview-sync-status.js';
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

test('preview가 없는 빈 문서도 초기화 지연 배너 상태를 노출한다', () => {
  assert.equal(toPreviewSyncStatus('degraded', false), 'degraded');
  assert.equal(toPreviewSyncStatus('live', false), 'inactive');
});

test('a stalled hydration banner invokes retry while the projection stays waiting', async () => {
  const { sourceHookHarness } = await import('../helpers/source-hook-harness.js');
  const { DiagramCodeProjectionState } =
    await import('../../src/collaboration/channel/diagram/diagram-code-projection-state.js');
  const state = new DiagramCodeProjectionState();
  let retries = 0;
  const harness = sourceHookHarness('src/components/erd/DiagramSyncStatusBanner.tsx', {
    'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
  });
  const banner = harness.exports.default as (props: unknown) => import('react').ReactElement;
  /** JSX에서 재시도 버튼의 실제 콜백을 찾는다. */
  function retryButton(node: import('react').ReactNode): (() => void) | undefined {
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const props = node.props as {
      onClick?: () => void;
      'aria-label'?: string;
      children?: import('react').ReactNode;
    };
    if (props['aria-label'] === 'diagram.previewSync.retrySnapshot') return props.onClick;
    const children = Array.isArray(props.children) ? props.children : [props.children];
    return children.map(retryButton).find(Boolean);
  }
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const tree = harness.render(() =>
        banner({
          connectionStatus: 'connected',
          previewSyncStatus: 'degraded',
          onRetry: () => {
            retries++;
            state.refreshReadiness();
          },
        }),
      );
      const retry = retryButton(tree);
      assert.equal(typeof retry, 'function');
      retry!();
      assert.equal(state.getSnapshot().status, 'hydrating');
      assert.equal(state.getSnapshot().text, '');
    }
    assert.equal(retries, 3);
  } finally {
    harness.cleanup();
    state.disconnect();
  }
});
