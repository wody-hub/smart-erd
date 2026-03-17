import Store from 'electron-store';

/** 앱 설정 스키마. */
interface SettingsSchema {
  /** 서버 URL (빈 문자열 = 미설정) */
  serverUrl: string;
  /** 창 위치·크기 */
  windowBounds?: { width: number; height: number; x?: number; y?: number };
}

const store = new Store<SettingsSchema>({
  defaults: {
    serverUrl: '',
  },
  clearInvalidConfig: true,
});

/**
 * 저장된 서버 URL을 반환한다.
 *
 * @returns 서버 URL (빈 문자열이면 미설정)
 */
export function getServerUrl(): string {
  try {
    return store.get('serverUrl');
  } catch {
    return '';
  }
}

/**
 * 서버 URL을 저장한다.
 *
 * @param url 서버 URL
 * @returns 저장 성공 여부
 */
export function setServerUrl(url: string): boolean {
  try {
    store.set('serverUrl', url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 창 위치·크기를 반환한다.
 *
 * @returns 저장된 창 위치·크기. 없으면 undefined
 */
export function getWindowBounds():
  | { width: number; height: number; x?: number; y?: number }
  | undefined {
  try {
    return store.get('windowBounds');
  } catch {
    return undefined;
  }
}

/**
 * 창 위치·크기를 저장한다.
 *
 * @param bounds 창 위치·크기
 */
export function setWindowBounds(bounds: {
  width: number;
  height: number;
  x?: number;
  y?: number;
}): void {
  try {
    store.set('windowBounds', bounds);
  } catch {
    // 저장 실패 시 무시
  }
}
