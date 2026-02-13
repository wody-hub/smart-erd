import { contextBridge, ipcRenderer } from 'electron';

/**
 * Context Bridge를 통해 renderer에 노출하는 안전한 API.
 * allowlist 방식으로 특정 IPC 채널만 매핑한다.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Electron 환경 식별 플래그. */
  isElectron: true as const,

  /**
   * 저장된 서버 URL을 반환한다.
   *
   * @returns 서버 URL (빈 문자열이면 미설정)
   */
  getServerUrl: (): Promise<string> => ipcRenderer.invoke('settings:getServerUrl'),

  /**
   * 서버 URL을 저장한다.
   *
   * @param url 서버 URL
   * @returns 저장 성공 여부
   */
  setServerUrl: (url: string): Promise<boolean> => ipcRenderer.invoke('settings:setServerUrl', url),

  /**
   * 네이티브 "다른 이름으로 저장" 다이얼로그를 열고 파일을 저장한다.
   *
   * @param options 파일 저장 옵션
   * @returns 저장 성공 여부 (취소 시 false)
   */
  saveFileAs: (options: {
    data: ArrayBuffer;
    defaultName: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<boolean> => ipcRenderer.invoke('file:saveAs', options),

  /**
   * 앱 버전을 반환한다.
   *
   * @returns 앱 버전 문자열
   */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
});
