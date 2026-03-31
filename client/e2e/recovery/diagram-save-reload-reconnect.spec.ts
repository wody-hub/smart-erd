import { test } from '@playwright/test';
import { withDiagramRecoveryLock } from './diagram-recovery-lock';
import { runDiagramSaveReloadReconnectScenario } from './diagram-recovery-scenarios';

test('diagram node position survives save and page reload reconnect @recovery', async ({ page }) => {
  test.slow();
  test
    .info()
    .annotations.push(
      ...(await withDiagramRecoveryLock(() => runDiagramSaveReloadReconnectScenario(page))),
    );
});
