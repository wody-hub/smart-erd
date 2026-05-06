/** Electron preload에서 contextBridge로 노출하는 API 인터페이스. */
interface ElectronAPI {
  /** Electron 환경 식별 플래그. */
  readonly isElectron: true;
  /** 저장된 서버 URL을 반환한다. */
  getServerUrl(): Promise<string>;
  /** 서버 URL을 저장한다. */
  setServerUrl(url: string): Promise<boolean>;
  /** 네이티브 "다른 이름으로 저장" 다이얼로그를 열고 파일을 저장한다. */
  saveFileAs(options: {
    data: ArrayBuffer;
    defaultName: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<boolean>;
  /** 앱 버전을 반환한다. */
  getAppVersion(): Promise<string>;
}

interface Window {
  /** Electron preload에서 노출한 API. 웹 환경에서는 undefined. */
  electronAPI?: ElectronAPI;
  /** Monaco editor handle exposed by the browser app during E2E flows. */
  monaco?: {
    editor?: {
      getEditors?: () => Array<unknown>;
      getModels?: () => Array<{
        getValue(): string;
      }>;
    };
  };
}
