import { ipcMain, dialog, app } from 'electron';
import { writeFile } from 'node:fs/promises';
import { getServerUrl, setServerUrl } from './settings-store';

/**
 * IPC 핸들러를 등록한다.
 * 앱 시작 시 1회 호출.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('settings:getServerUrl', () => {
    return getServerUrl();
  });

  ipcMain.handle('settings:setServerUrl', (_event, url: string) => {
    return setServerUrl(url);
  });

  ipcMain.handle(
    'file:saveAs',
    async (
      _event,
      options: {
        data: ArrayBuffer;
        defaultName: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      },
    ) => {
      const result = await dialog.showSaveDialog({
        defaultPath: options.defaultName,
        filters: options.filters,
      });

      if (result.canceled || !result.filePath) {
        return false;
      }

      await writeFile(result.filePath, Buffer.from(options.data));
      return true;
    },
  );

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });
}
