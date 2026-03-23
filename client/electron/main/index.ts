import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { registerIpcHandlers } from './ipc-handlers';
import { setupMenu } from './menu';
import { getServerUrl, getWindowBounds, setWindowBounds } from './settings-store';

/** 메인 BrowserWindow 인스턴스. */
let mainWindow: BrowserWindow | null = null;

/** OS 테마에 따른 BrowserWindow 배경색을 반환한다. */
function getBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#020817' : '#ffffff';
}

/** 메인 윈도우를 생성한다. */
function createWindow(): void {
  const savedBounds = getWindowBounds();

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1400,
    height: savedBounds?.height ?? 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: getBackgroundColor(),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 흰 화면 깜빡임 방지: ready-to-show에서 표시
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 창 크기·위치 변경 시 저장
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      setWindowBounds(bounds);
    }
  });

  // 외부 링크는 시스템 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // CORS Origin 치환 (file:// → 서버 URL)
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    const serverUrl = getServerUrl();
    if (serverUrl) {
      try {
        requestHeaders['Origin'] = new URL(serverUrl).origin;
      } catch {
        // URL 파싱 실패 시 Origin 그대로 유지
      }
    }
    callback({ requestHeaders });
  });

  // CORS 응답 헤더 보정 — 서버가 반환한 Access-Control-Allow-Origin을 Electron Origin과 일치시킨다
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    const serverUrl = getServerUrl();
    if (serverUrl) {
      try {
        const origin = new URL(serverUrl).origin;
        responseHeaders['Access-Control-Allow-Origin'] = [origin];
        responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
      } catch {
        // URL 파싱 실패 시 원본 헤더 유지
      }
    }
    callback({ responseHeaders });
  });

  // Dev 환경: Vite dev server 로드 / Prod: 빌드된 HTML 로드
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// OS 테마 변경 감지 → BrowserWindow 배경색 갱신
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.setBackgroundColor(getBackgroundColor());
  }
});

// 앱 준비 완료 시 윈도우 생성
app.whenReady().then(() => {
  registerIpcHandlers();
  setupMenu();
  createWindow();

  // macOS: 독에서 앱 클릭 시 윈도우 없으면 재생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 윈도우 닫힘 시 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
