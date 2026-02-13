# Smart ERD — Electron 데스크탑 앱 전환 설계서

## Context

현재 Smart ERD는 Vite 프록시(`/api` → `localhost:8190`)에 의존하는 웹 전용 SPA이다.
macOS/Windows 데스크탑 앱을 제공하기 위해 **Electron**으로 래핑하되, 기존 웹 빌드도 그대로 유지하는 **듀얼 타겟(Web + Desktop)** 구조를 만든다.
백엔드(Spring Boot)는 외부 서버로 운영하며, 사용자가 앱 설정 화면에서 서버 URL을 변경할 수 있도록 한다.

---

## 디렉토리 구조

```
client/
├── electron/                          # [신규] Electron 전용 코드
│   ├── main/
│   │   ├── index.ts                   #   Main process 엔트리포인트
│   │   ├── ipc-handlers.ts            #   IPC 핸들러 (설정, 파일 저장)
│   │   ├── settings-store.ts          #   electron-store 래퍼 (서버 URL 등)
│   │   └── menu.ts                    #   네이티브 메뉴 (macOS/Windows)
│   └── preload/
│       └── index.ts                   #   contextBridge — 안전한 API 노출
├── src/                               # 기존 React 소스 (변경 최소화)
│   ├── lib/
│   │   └── platform.ts                #   [신규] 환경 분기 중앙화 (isElectron, getApiBaseUrl, redirectToLogin, updateServerUrl 등)
│   ├── types/
│   │   └── electron.d.ts              #   [신규] window.electronAPI 타입 선언
│   ├── pages/
│   │   └── settings/
│   │       └── SettingsPage.tsx        #   [신규] 서버 URL 설정 화면 (Electron 전용)
│   └── ...                            #   기존 파일들 (7개 수정)
├── build/                             # [신규] 앱 아이콘
│   ├── icon.icns                      #   macOS (1024x1024)
│   ├── icon.ico                       #   Windows (256x256)
│   └── icon.png                       #   fallback (512x512)
├── electron.vite.config.ts            # [신규] electron-vite 빌드 설정
├── electron-builder.yml               # [신규] 패키징 설정 (macOS + Windows)
├── tsconfig.node.json                 # [신규] Electron main/preload TS 설정
├── vite.config.ts                     # [유지] 웹 전용 빌드 (프록시 포함)
└── package.json                       # [수정] Electron 의존성 + 스크립트 추가
```

---

## STEP 1: 의존성 설치 및 프로젝트 설정

### 1-1. 패키지 추가 (`client/package.json`)

```
devDependencies:
  electron               — Electron 런타임
  electron-vite          — Vite + Electron 통합 빌드 도구
  electron-builder       — 크로스 플랫폼 패키징
  @electron-toolkit/preload  — preload 유틸리티
  @electron-toolkit/utils    — Electron 환경 감지 유틸리티

dependencies:
  electron-store         — 서버 URL 영속 저장 (JSON 파일 기반)
  monaco-editor          — Monaco Editor 로컬 번들 (CDN 제거, 오프라인 대응)
  vite-plugin-monaco-editor — Vite에서 Monaco Web Worker 처리
```

### 1-2. 스크립트 추가 (`client/package.json`)

```json
"main": "./out/main/index.js",
"scripts": {
  "dev": "vite --port 3000",
  "dev:electron": "electron-vite dev",
  "build": "tsc -b && vite build",
  "build:electron": "electron-vite build",
  "dist:mac": "electron-vite build && electron-builder --mac",
  "dist:win": "electron-vite build && electron-builder --win"
}
```

- 기존 `dev`, `build` 스크립트는 **웹 전용으로 그대로 유지**
- `dev:electron`은 Electron + Vite HMR 개발 모드
- `dist:mac` / `dist:win`은 최종 설치 파일 생성

### 1-3. 신규 설정 파일

| 파일 | 용도 |
|------|------|
| `client/electron.vite.config.ts` | main/preload/renderer 3개 빌드 타겟 설정 (아래 구체 코드 참조) |
| `client/electron-builder.yml` | macOS(dmg, universal) + Windows(nsis, portable) 패키징 옵션 |
| `client/tsconfig.node.json` | Electron main/preload 전용 TypeScript 설정 (`target: ES2022`) |

### 1-4. `electron.vite.config.ts` 구체 설정

```typescript
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    plugins: [react(), monacoEditorPlugin({})],
  },
});
```

- `externalizeDepsPlugin()`: main/preload에서 Node.js built-in 및 `node_modules`를 외부화
- renderer는 기존 `vite.config.ts`의 `@/` alias, React 플러그인을 동일하게 설정
- `proxy` 설정은 **포함하지 않음** — Electron에서는 직접 HTTP 요청하므로 프록시 불필요
- **PostCSS 설정**: `electron-vite`는 프로젝트 루트의 `postcss.config.js`를 자동으로 감지하므로 별도 설정 불필요. 만약 Tailwind CSS가 적용되지 않는 경우 renderer 섹션에 `css: { postcss: resolve('postcss.config.js') }`를 명시적으로 추가한다

### 1-5. `main` 필드와 기존 웹 빌드 공존

`package.json`에 `"main": "./out/main/index.js"`를 추가하면 이 파일이 `electron-vite build` 후에만 존재한다. Vite, ESLint, TypeScript는 이 필드를 무시하므로 기존 웹 빌드(`npm run dev`, `npm run build`, `npm run lint`)에 영향 없다.

**검증:** Electron 의존성 추가 후 `npm run dev`, `npm run build`가 정상 동작하는지 반드시 확인한다.

---

## STEP 2: Electron Main Process

### 신규 파일: `client/electron/main/index.ts`

BrowserWindow 생성 및 앱 라이프사이클 관리:

- **창 크기**: 1400×900 (최소 1024×700)
- **보안 설정** (`webPreferences`):
  - `contextIsolation: true` — renderer와 Node.js 환경 완전 분리
  - `nodeIntegration: false` — renderer에서 `require()` 차단
  - `sandbox: true` — 샌드박스 활성화
- **콘텐츠 로드**:
  - Dev: `ELECTRON_RENDERER_URL`(Vite dev server)로 로드
  - Prod: `loadFile('out/renderer/index.html')`
- **플랫폼 대응**:
  - macOS `activate` 이벤트에서 창이 없으면 재생성
  - 외부 링크는 `shell.openExternal()`로 시스템 브라우저에서 열기
- **CORS 처리**: `session.webRequest.onBeforeSendHeaders`로 `Origin` 헤더를 서버 URL로 치환
- **창 표시 최적화**: `show: false`로 생성 → `ready-to-show` 이벤트에서 `show()` 호출 (흰 화면 깜빡임 방지)
- **배경색**: `backgroundColor: nativeTheme.shouldUseDarkColors ? '#020817' : '#ffffff'` — Electron의 `nativeTheme`으로 OS 테마 감지 후 동적 설정. CSS가 로드되기 전 BrowserWindow 배경에 노출되는 색상이므로, 각 테마의 `--background` 토큰 값과 일치시킨다
- **OS 테마 변경 감지**: `nativeTheme.on('updated', ...)` 리스너로 OS 다크/라이트 전환 시 `mainWindow.setBackgroundColor()`을 갱신한다. HTML `<html>` 태그의 `.dark` 클래스 토글은 renderer 측 기존 테마 로직이 담당하므로 main process에서는 BrowserWindow 배경색만 처리한다

### 타이틀바 전략

macOS/Windows에서 OS 네이티브 타이틀바와 기존 Header(`h-12`)의 관계를 정의한다.

**선택: 기본 프레임 유지 (`frame: true`)**

- OS 네이티브 타이틀바(~28px)가 Header 위에 표시되어 총 ~76px 상단 공간 차지 (이중 바)
- 구현이 간단하고, OS 네이티브 창 조작(드래그, 리사이즈, 트래픽 라이트)이 기본 동작
- 트레이드오프: 약간의 공간 낭비가 있으나, 커스텀 타이틀바 대비 구현 복잡도가 크게 줄어듦

> **향후 개선 옵션**: 네이티브 느낌을 강화하려면 macOS `titleBarStyle: 'hiddenInset'` + Header 좌측 `pl-[70px]` 패딩 + `-webkit-app-region: drag` 적용을 검토한다. 이 경우 Header 레이아웃 변경이 필요하므로 별도 작업으로 분리한다.

### 신규 파일: `client/electron/main/settings-store.ts`

`electron-store` 기반 앱 설정 영속 저장:

```typescript
interface SettingsSchema {
  serverUrl: string;                   // 기본값: ''
  windowBounds?: { width: number; height: number; x?: number; y?: number };
}
```

- `getServerUrl()` / `setServerUrl(url)` export
- `defaults` 옵션으로 기본값 설정: `{ serverUrl: '' }` (빈 문자열 = 미설정)
- 데이터 저장 위치: OS별 앱 데이터 디렉토리 (자동)
  - macOS: `~/Library/Application Support/Smart ERD/`
  - Windows: `%APPDATA%/Smart ERD/`

**에러 핸들링:**
- `ipc-handlers.ts`에서 모든 electron-store 호출을 try/catch로 감싸고, 실패 시 기본값 반환 또는 에러 전파
- JSON 파일 손상 시 `electron-store`가 자동으로 기본값으로 초기화 (`clearInvalidConfig: true` 옵션)
- `setServerUrl()` 실패 시 renderer에 `false` 반환 → SettingsPage에서 `toast.error()` 표시

**저장소 보안 정책:**
- `electron-store`는 JSON 파일로 평문 저장한다. 서버 URL 자체는 민감 정보가 아니므로 허용한다.
- 인증 토큰(Access Token, Refresh Token)은 **`electron-store`에 저장하지 않는다**. 기존과 동일하게 `localStorage`에 저장한다 (Electron renderer의 `localStorage`는 앱별 격리 저장).
- 향후 민감 정보(API Key 등)를 저장해야 할 경우 `safeStorage.encryptString()` (Electron 내장 OS 키체인 암호화) 사용을 검토한다.

### 신규 파일: `client/electron/main/ipc-handlers.ts`

| IPC 채널 | 방향 | 용도 |
|----------|------|------|
| `settings:getServerUrl` | renderer → main | 저장된 서버 URL 반환 |
| `settings:setServerUrl` | renderer → main | 서버 URL 저장 |
| `file:saveAs` | renderer → main | 네이티브 "다른 이름으로 저장" 다이얼로그 + 파일 쓰기 |
| `app:getVersion` | renderer → main | 앱 버전 조회 |

`ipcMain.handle()`을 사용하여 Promise 기반 양방향 통신으로 구현한다.

### 신규 파일: `client/electron/main/menu.ts`

- **macOS**: 앱 이름 메뉴(About, Quit) + Edit(Undo/Redo/Copy/Paste) + View + Window + Help
- **Windows**: 메뉴바 숨김 처리 (`autoHideMenuBar: true`)

---

## STEP 3: Preload Script (보안 브릿지)

### 신규 파일: `client/electron/preload/index.ts`

`contextBridge.exposeInMainWorld('electronAPI', ...)` 으로 allowlist 방식 API 노출:

```typescript
const electronAPI = {
  isElectron: true,
  getServerUrl: () => ipcRenderer.invoke('settings:getServerUrl'),
  setServerUrl: (url: string) => ipcRenderer.invoke('settings:setServerUrl', url),
  saveFileAs: (options: { data: ArrayBuffer; defaultName: string; filters?: ... }) =>
    ipcRenderer.invoke('file:saveAs', options),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
};
```

**보안 원칙:**
- `ipcRenderer.send/on`을 직접 노출하지 않음 — 임의 채널 실행 불가
- 각 함수가 특정 IPC 채널에만 매핑 — 공격 면적 최소화
- `contextIsolation: true`이므로 renderer의 `window` 객체와 preload 스코프가 완전 분리

---

## STEP 4: 타입 선언 + 환경 감지 유틸리티

### 신규 파일: `client/src/types/electron.d.ts`

```typescript
interface Window {
  electronAPI?: {
    isElectron: true;
    getServerUrl(): Promise<string>;
    setServerUrl(url: string): Promise<boolean>;
    saveFileAs(options: {
      data: ArrayBuffer;
      defaultName: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<boolean>;
    getAppVersion(): Promise<string>;
  };
}
```

### 신규 파일: `client/src/lib/platform.ts`

듀얼 타겟(Web/Electron) 분기를 **한 곳에서** 처리하는 유틸리티. 개별 파일에서 `if (isElectron())` 분기를 직접 작성하지 않고, 이 모듈의 함수를 호출하여 분기를 위임한다 (Shotgun Surgery 방지):

```typescript
import { ROUTES } from '@/constants/routes';

/** 모듈 스코프 캐시 — bootstrap() 완료 후에만 유효한 값을 가진다 */
let cachedServerUrl = '';

/**
 * Electron 데스크톱 환경인지 확인한다.
 *
 * @returns Electron 환경이면 true, 웹 환경이면 false
 */
export function isElectron(): boolean {
  return window.electronAPI?.isElectron === true;
}

/**
 * 서버 URL을 캐시에 저장한다. main.tsx의 bootstrap()에서 1회 호출.
 *
 * @param url 서버 URL (예: 'http://localhost:8190')
 */
export function initServerUrl(url: string): void {
  cachedServerUrl = url;
}

/**
 * 서버 URL 변경 시 호출 — 캐시 갱신 + 앱 상태 전면 초기화.
 *
 * 서버가 바뀌면 기존 인증 토큰, React Query 캐시가 모두 무효하므로
 * 이전 서버에 logout을 best-effort로 시도한 후,
 * 전체 상태를 초기화하고 로그인 페이지로 이동한다.
 *
 * @param url       새 서버 URL
 * @param deps      앱 상태 초기화에 필요한 콜백
 * @param deps.clearCache  React Query 캐시 전면 삭제 (queryClient.clear)
 * @param deps.clearAuth   인증 상태 초기화 (localStorage 토큰 + Zustand 상태)
 * @param deps.logoutFromServer  이전 서버에 logout API 호출 (실패 시 무시)
 */
export async function updateServerUrl(
  url: string,
  deps: {
    clearCache: () => void;
    clearAuth: () => void;
    logoutFromServer: () => Promise<void>;
  },
): Promise<void> {
  // 이전 서버에 logout 시도 (Refresh Token 폐기). 네트워크 실패 시 무시.
  await deps.logoutFromServer().catch(() => {});

  const api = window.electronAPI;
  if (api) {
    await api.setServerUrl(url);
  }
  cachedServerUrl = url;
  deps.clearCache();
  deps.clearAuth();
  redirectToLogin();
}

/**
 * API base URL을 반환한다.
 *
 * @returns Web: '/api', Electron: '{serverUrl}/api'
 */
export function getApiBaseUrl(): string {
  if (!isElectron()) return '/api';
  if (!cachedServerUrl) {
    throw new Error('Server URL not initialized. Call initServerUrl() first.');
  }
  return `${cachedServerUrl}/api`;
}

/**
 * WebSocket base URL을 반환한다.
 *
 * @returns Web: window.location 기반 ws/wss URL, Electron: 캐시 URL 기반
 */
export function getWsBaseUrl(): string {
  if (!isElectron()) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  if (!cachedServerUrl) {
    throw new Error('Server URL not initialized. Call initServerUrl() first.');
  }
  const url = new URL(cachedServerUrl);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}`;
}

/**
 * 로그인 페이지로 리다이렉트한다.
 * Electron(HashRouter)과 Web(BrowserRouter) 분기를 내부에서 처리한다.
 */
export function redirectToLogin(): void {
  if (isElectron()) {
    window.location.hash = `#${ROUTES.LOGIN}`;
  } else {
    window.location.href = ROUTES.LOGIN;
  }
}

/**
 * 캐시된 서버 URL을 반환한다 (읽기 전용).
 *
 * @returns 현재 캐시된 서버 URL
 */
export function getServerUrl(): string {
  return cachedServerUrl;
}
```

**설계 핵심**:
- 서버 URL을 앱 시작 시 비동기로 한 번 로드한 뒤 모듈 스코프에 캐시하여, 이후에는 **동기 함수**로 접근 가능하게 한다.
- **초기화 순서 보장**: `main.tsx`의 `bootstrap()`이 `initServerUrl()`을 호출한 **후에** `createRoot()`를 실행하므로, React 렌더링 시점에는 항상 캐시가 설정된 상태이다. `getApiBaseUrl()`과 `getWsBaseUrl()` 모두 Electron인데 캐시가 빈 문자열이면 에러를 throw하여 초기화 누락을 조기에 감지한다. 빈 문자열은 "서버 URL 미설정" 상태를 의미하며, 이 경우 API/WS 호출이 아닌 `/settings` 리다이렉트가 우선한다.
- **환경 분기 중앙화**: `redirectToLogin()`, `getApiBaseUrl()`, `getWsBaseUrl()` 등 모든 Web/Electron 분기를 이 모듈에 집중시킨다. 다른 파일에서는 `isElectron()`으로 직접 분기하지 않는다 (App.tsx의 Router 선택, Header.tsx의 설정 아이콘 조건부 렌더링 등 **UI 레이어 분기만 예외**).
- **서버 URL 변경 시 전면 초기화**: `updateServerUrl()`이 이전 서버 logout(best-effort) + 캐시 갱신 + `clearCache()` + `clearAuth()` + 로그인 리다이렉트를 원자적으로 수행한다.
- **`deps` 콜백 인터페이스**: `QueryClient` 등 외부 타입에 의존하지 않고 `() => void` 콜백으로 받아 `platform.ts`의 순수 유틸리티 성격을 유지한다.
- **책임 범위**: 현재 ~90줄으로 한 파일에 적절한 수준이다. 향후 기능이 추가되어 150줄을 넘으면 환경 감지(`platform.ts`)와 서버 설정(`server-config.ts`)으로 분리를 검토한다.
- **`!` non-null assertion 사용 금지**: `window.electronAPI`는 optional chaining + 변수 바인딩(`const api = window.electronAPI; if (api) { ... }`)으로 접근하여 타입 안전성을 확보한다.

---

## STEP 5: 기존 코드 수정 (7개 파일)

### 5-1. `client/src/api/axiosInstance.ts`

**수정 대상 (line 15):** `baseURL: '/api'`

> **주의 — 타이밍 문제**: `axiosInstance`는 모듈 평가 시점에 생성된다. 그런데 `cachedServerUrl`은 `main.tsx`의 `bootstrap()` 실행 후에야 초기화된다. 따라서 `axios.create({ baseURL: getApiBaseUrl() })` 방식은 **빈 문자열**이 baseURL로 설정되는 레이스 컨디션이 발생한다.

```typescript
// Before
const axiosInstance = axios.create({ baseURL: '/api' });

// After — request interceptor로 매 요청마다 동적으로 baseURL 결정
import { getApiBaseUrl, redirectToLogin } from '@/lib/platform';

const axiosInstance = axios.create();  // baseURL 미설정

// 기존 요청 인터셉터에 baseURL 주입 로직 추가
axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();  // 매 요청 시 동적 해석
  config.headers['Accept-Language'] = i18n.language || 'en';
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

이 방식은 `initServerUrl()` 호출 이후 모든 요청에서 올바른 baseURL을 사용하며, `updateServerUrl()`로 서버 URL이 변경되어도 별도 갱신 없이 자동 반영된다.

**수정 대상 (line 21):** `window.location.href = ROUTES.LOGIN`

```typescript
// Before
window.location.href = ROUTES.LOGIN;

// After — platform.ts의 redirectToLogin()으로 위임
import { redirectToLogin } from '@/lib/platform';

function clearAuthAndRedirect() {
  clearAuthState();
  redirectToLogin();  // Web/Electron 분기를 platform.ts에서 처리
}
```

### 5-2. `client/src/lib/auth-refresh.ts`

**수정 대상 (line 105-106):** `'/api/auth/refresh'` 하드코딩

```typescript
// Before
const res = await axios.post<...>('/api/auth/refresh', { refreshToken });

// After
import { getApiBaseUrl } from '@/lib/platform';
const res = await axios.post<...>(`${getApiBaseUrl()}/auth/refresh`, { refreshToken });
```

### 5-3. `client/src/stores/useAuthStore.ts`

**수정 대상 (line 56):** `'/api/auth/logout'` 하드코딩

```typescript
// Before
axios.post('/api/auth/logout', { refreshToken: rt }).catch(() => {});

// After
import { getApiBaseUrl } from '@/lib/platform';
axios.post(`${getApiBaseUrl()}/auth/logout`, { refreshToken: rt }).catch(() => {});
```

### 5-4. `client/src/collaboration/YjsProvider.ts`

**수정 대상 (line 569-572):** `window.location.protocol/host` 기반 WS URL 생성

```typescript
// Before
private buildWsUrl(ticket: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/diagram/${this.options.diagramId}?ticket=${ticket}`;
}

// After
import { getWsBaseUrl } from '@/lib/platform';

private buildWsUrl(ticket: string): string {
  return `${getWsBaseUrl()}/ws/diagram/${this.options.diagramId}?ticket=${ticket}`;
}
```

`getWsBaseUrl()`가 Web/Electron 환경 분기를 내부에서 처리하므로 호출부는 단순해진다.

### 5-5. `client/src/App.tsx`

**수정 대상 (line 2, 28):** `BrowserRouter` → 조건부 라우터

```typescript
// Before
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// ...
<BrowserRouter>

// After
import { HashRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isElectron, getServerUrl } from '@/lib/platform';

const Router = isElectron() ? HashRouter : BrowserRouter;

// ...
<Router>
  <Routes>
    {/* ── Electron 전용 (ProtectedRoute 이전에 배치) ── */}
    {isElectron() && (
      <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
    )}
    {isElectron() && !getServerUrl() && (
      <Route path="*" element={<Navigate to={ROUTES.SETTINGS} replace />} />
    )}

    {/* ── 공개 라우트 ── */}
    {/* 로그인, 회원가입 */}

    {/* ── 인증 필요 라우트 (ProtectedRoute 가드) ── */}
    {/* 기존 라우트 그대로 */}
  </Routes>
</Router>
```

Electron에서 `file://` 프로토콜로 로드되므로 History API 기반 `BrowserRouter`가 제대로 동작하지 않는다. `HashRouter`는 URL 해시(`#/path`)를 사용하여 이 문제를 회피한다.

**서버 URL 미설정 리다이렉트**: Electron 환경에서 `getServerUrl()`이 빈 문자열이면 모든 경로를 `/settings`로 리다이렉트한다. 이 분기는 `App.tsx`의 라우트 정의에서 처리하여, `ProtectedRoute`나 `platform.ts`에 리다이렉트 책임이 분산되지 않도록 한다.

**라우트 순서**: Electron 전용 라우트(Settings, catch-all 리다이렉트)를 **ProtectedRoute 이전**에 배치한다. 그렇지 않으면 ProtectedRoute가 먼저 매칭되어 로그인 페이지로 리다이렉트되고, Settings 페이지에 도달하지 못한다.

### 5-6. `client/src/main.tsx`

**수정:** 앱 시작 시 서버 URL 비동기 로드 → 캐시 초기화

```typescript
// Before
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);

// After
import { initServerUrl, isElectron } from '@/lib/platform';

async function bootstrap() {
  const api = window.electronAPI;
  if (api) {
    const url = await api.getServerUrl();
    initServerUrl(url);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode><App /></StrictMode>,
  );
}
bootstrap();
```

### 5-7. `client/src/constants/routes.ts`

**추가:** 설정 페이지 경로

```typescript
/** 서버 설정 페이지 (Electron 전용) */
SETTINGS: '/settings',
```

---

## STEP 6: 서버 URL 설정 화면

### 신규 파일: `client/src/pages/settings/SettingsPage.tsx`

Electron 전용 페이지. `ProtectedRoute` 가드 **밖**에 위치한다 — 최초 실행 시 인증 전에 서버 URL을 설정해야 하므로 비인증 접근이 필요하다. Electron 환경이므로 URL 직접 입력으로 접근하는 시나리오는 제한적이다.

### 레이아웃

```
div.h-screen.flex.flex-col.bg-background
  Header (비인증 상태: 로고 + LanguageSwitcher만 표시, 로그아웃/사용자명 숨김)
  main.flex-1.flex.items-center.justify-center.bg-muted.p-6
    Card.max-w-md.w-full (bg-card)
      CardHeader
        CardTitle — t('settings.title')
        CardDescription — t('settings.description')  // 최초: "시작하려면 서버 URL을 입력하세요"
      CardContent
        Label(htmlFor="server-url") + Input#server-url (서버 URL)
        연결 테스트 결과 영역 (role="status", aria-live="polite")
          성공: text-success (기존 --success 토큰)
          실패: text-destructive (기존 --destructive 토큰)
      CardFooter.flex.justify-end.gap-2
        Button(variant="outline") — t('settings.testConnection')
        Button(variant="default") — t('settings.save')
```

### 기능 상세

| 요소 | 동작 |
|------|------|
| URL 입력 필드 | 기존 저장값 로드. `aria-label` 또는 `Label` 연결 |
| 연결 테스트 버튼 | `GET {serverUrl}/api/health` (타임아웃 5초) → 성공(200): `text-success` + `t('settings.testSuccess')` / 네트워크 에러·타임아웃: `text-destructive` + `t('settings.testFailed')` / 200 이외 HTTP 응답(404 등): `text-destructive` + `t('settings.testFailed')`. 테스트 중 `Spinner` 표시 + `disabled` |
| 저장 버튼 | URL 변경 시 `ConfirmDialog`로 "서버를 변경하면 현재 세션이 초기화됩니다" 확인 후 `updateServerUrl()` 호출. URL 미변경 시 확인 없이 뒤로 이동. **최초 진입(이력 없음)일 경우**: 저장 성공 → 로그인 페이지로 이동 (`redirectToLogin()`) |

### i18n 키 추가

`i18n/locales/{en,ko}/translation.json`에 추가:

```
settings.title                — "Server Settings" / "서버 설정"
settings.description          — "Enter your Smart ERD server URL" / "Smart ERD 서버 URL을 입력하세요"
settings.serverUrl            — "Server URL" / "서버 URL"
settings.serverUrlPlaceholder — "http://localhost:8190" / "http://localhost:8190"
settings.testConnection       — "Test Connection" / "연결 테스트"
settings.testSuccess          — "Connection successful" / "연결 성공"
settings.testFailed           — "Connection failed" / "연결 실패"
settings.testTimeout          — "Server not responding" / "서버 응답 없음"
settings.save                 — "Save" / "저장"
settings.saveConfirmTitle     — "Change Server?" / "서버를 변경하시겠습니까?"
settings.saveConfirmMessage   — "Current session will be reset" / "현재 세션이 초기화됩니다"
settings.saveSuccess          — "Server URL saved" / "서버 URL이 저장되었습니다"
settings.saveError            — "Failed to save" / "저장에 실패했습니다"
```

### 저장 시 상태 초기화 절차

서버가 변경되면 기존 인증 토큰과 캐시 데이터가 모두 무효하다. `platform.ts`의 `updateServerUrl()`이 다음을 원자적으로 수행한다:

```
1. 이전 서버에 logout API 호출 (best-effort, 실패 시 무시)
2. electron-store에 새 URL 저장
3. cachedServerUrl 캐시 갱신
4. clearCache()                — React Query 캐시 전면 삭제
5. clearAuth()                 — localStorage의 토큰/사용자 정보 삭제
6. 다이어그램 편집 중이었다면 YjsProvider의 WebSocket 연결도 정리됨
   (redirectToLogin()으로 페이지 이동 시 DiagramPage가 unmount되어 YjsProvider.destroy() 호출)
7. redirectToLogin()           — 로그인 페이지로 이동
```

SettingsPage에서는 `updateServerUrl(url, { clearCache, clearAuth, logoutFromServer })`만 호출하면 된다. `axiosInstance`의 baseURL은 request interceptor가 매 요청마다 동적으로 해석하므로 별도 갱신이 필요 없다.

### `deps` 콜백 구현 가이드

SettingsPage에서 `updateServerUrl()`을 호출할 때 전달하는 콜백의 구현:

```typescript
// SettingsPage.tsx 내부
const queryClient = useQueryClient();
const { logout } = useAuthStore();   // Zustand 상태 초기화 + localStorage 토큰 삭제

await updateServerUrl(newUrl, {
  clearCache: () => queryClient.clear(),
  clearAuth: () => {
    // useAuthStore.logout()은 내부적으로 서버 logout API도 호출하지만,
    // logoutFromServer에서 이미 처리하므로 여기서는 로컬 상태 초기화만 수행
    clearAuthState();  // auth-refresh.ts의 localStorage 클리어 함수
  },
  logoutFromServer: async () => {
    // 이전 서버에 Refresh Token 폐기 요청 (best-effort)
    const rt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (rt) {
      await axios.post(`${getApiBaseUrl()}/auth/logout`, { refreshToken: rt });
    }
  },
});
```

**역할 분리:**
- `logoutFromServer`: 이전 서버에 Refresh Token 폐기 API 호출만 담당. 실패 시 `updateServerUrl` 내부에서 `.catch(() => {})` 처리
- `clearAuth`: `localStorage`의 토큰/사용자 정보 삭제 + Zustand 인증 상태 초기화. `useAuthStore.logout()`은 서버 API 호출 + 상태 초기화를 모두 수행하므로 여기서는 사용하지 않는다. 대신 `clearAuthState()` (auth-refresh.ts — localStorage 클리어) + `useAuthStore.getState().reset()` (Zustand 상태 초기화)을 조합하여 로컬 상태만 정리한다

> **`clearAuthState`와 `deps.clearAuth`의 관계**: `clearAuthState()`는 기존 `auth-refresh.ts`에 정의된 localStorage 클리어 함수이다. `deps.clearAuth`는 이를 포함하여 Zustand 상태까지 초기화하는 상위 래퍼이다. `axiosInstance.ts`의 401 핸들러에서는 기존대로 `clearAuthState()` + `redirectToLogin()`을 호출하고, `updateServerUrl()`에서는 `deps.clearAuth()`를 통해 동일 작업을 수행한다. 실행 경로가 다르므로 중복 호출은 발생하지 않는다
- `clearCache`: React Query 캐시 전면 삭제

> `useAuthStore.logout()`을 직접 사용하지 않는 이유: 이 함수는 `getApiBaseUrl()`로 서버에 logout 요청을 보내지만, `updateServerUrl()` 실행 중에는 이미 `cachedServerUrl`이 새 URL로 갱신된 후일 수 있어 잘못된 서버로 요청이 전송된다. 따라서 logout API 호출은 URL 갱신 **전**에 `logoutFromServer`에서 별도로 수행한다.

> **이전 서버 Refresh Token 정책:** 서버 URL 변경 시 이전 서버에 `POST /api/auth/logout`을 best-effort로 호출하여 Refresh Token을 폐기한다. 네트워크 실패 시 무시하며, 이 경우 이전 서버의 Refresh Token은 만료(24시간)까지 유효하나 Electron의 `localStorage` 격리 특성상 보안 위험은 낮다.

### 진입점

- Electron 앱 최초 실행 시 (서버 URL 빈 문자열) → SettingsPage 자동 리다이렉트
- Header에 설정(기어) 아이콘 추가:
  - **위치**: LanguageSwitcher와 사용자 이름 사이
  - **아이콘**: Lucide `Settings`
  - **스타일**: `variant="ghost" size="icon"`, `text-header-muted hover:text-header-foreground`
  - **접근성**: `aria-label={t('settings.title')}`
  - **조건부**: `isElectron()`으로 렌더링 (UI 레이어 분기 예외)

### 백엔드 변경 필요

- `GET /api/health` 엔드포인트 추가 (200 OK 반환, 공개 경로):

```java
// api/common/HealthController.java
@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping
    public ResponseEntity<Void> health() {
        return ResponseEntity.ok().build();
    }
}
```

- `SecurityConfig`에서 `/api/health` 공개 허용:

```java
// 기존 permitAll 목록에 추가
.requestMatchers("/api/auth/**", "/api/health").permitAll()
```

---

## STEP 7: CORS 처리

Electron에서 `file://` origin으로 직접 HTTP 요청하면 CORS 오류 발생.

### 7-1. HTTP 요청 — Origin 치환

```typescript
// electron/main/index.ts
import { getServerUrl } from './settings-store';

mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
  (details, callback) => {
    const { requestHeaders } = details;
    // Origin 삭제가 아닌 서버 URL로 치환 — CSRF 방어 신호 유지
    // new URL().origin으로 정규화하여 경로/쿼리가 포함되지 않도록 한다
    const serverUrl = getServerUrl();
    if (serverUrl) {
      requestHeaders['Origin'] = new URL(serverUrl).origin;
    }
    callback({ requestHeaders });
  },
);
```

> **Origin 삭제가 아닌 치환을 사용하는 이유**: `Origin` 헤더를 완전히 삭제하면 서버 CORS 검증을 우회하지만, 동시에 CSRF 방어 수단도 제거된다. 서버 URL로 치환하면 CORS 검증을 통과하면서도 보안 신호를 유지한다.

### 7-2. WebSocket — Origin 처리

Spring WebSocket의 `setAllowedOriginPatterns()` 설정도 동일한 Origin을 허용해야 한다. 현재 백엔드 `WebSocketConfig`의 `setAllowedOrigins("*")` 설정이 있다면 보안상 허용 목록으로 변경을 권장한다.

HTTP Origin 치환과 동일한 서버 URL이 WebSocket 핸드셰이크에도 Origin으로 전송되므로, 백엔드에서 별도 설정 변경 없이 동작한다. 단, `setAllowedOrigins("*")`를 특정 도메인 목록으로 제한할 경우 서버 자신의 Origin도 포함해야 한다.

서버 측 `CorsConfig` 변경 없이 클라이언트에서 해결한다.

---

## STEP 8: Monaco Editor 오프라인 번들링

현재 `@monaco-editor/react`는 기본적으로 **jsDelivr CDN**에서 Monaco Editor 코어를 다운로드한다. 웹 환경에서는 문제없지만, Electron 데스크탑 앱에서는 **오프라인 상황에서 DDL 에디터가 로드되지 않는** 문제가 발생한다.

### 해결 방안: `monaco-editor` 로컬 번들링

```bash
npm install monaco-editor
```

**수정 파일: `client/src/components/erd/DdlExportDialog.tsx`**

```typescript
// Before — CDN 의존 (암묵적)
import Editor from '@monaco-editor/react';

// After — 로컬 번들 사용
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';

// DdlExportDialog.tsx 모듈 스코프 (파일 최상단)에서 1회 호출.
// lazy import되므로 DDL 내보내기 사용 시에만 Monaco 번들이 로드된다.
loader.config({ monaco });
```

`loader.config({ monaco })`를 호출하면 CDN 대신 번들에 포함된 `monaco-editor`를 사용한다.

### Vite 빌드 설정 추가

`electron.vite.config.ts`의 renderer 빌드에서 Monaco Editor Web Worker를 올바르게 처리하기 위해 `vite-plugin-monaco-editor` 또는 수동 worker 설정이 필요할 수 있다:

```typescript
// electron.vite.config.ts — renderer 섹션
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

renderer: {
  plugins: [react(), monacoEditorPlugin({})],
}
```

### 번들 크기 영향

Monaco Editor 전체를 번들에 포함하면 약 **3~5MB** 증가한다. Electron 데스크탑 앱에서는 허용 가능한 수준이다. 필요 시 `languageWorkers` 옵션으로 SQL만 포함하여 크기를 줄일 수 있다.

---

## STEP 9: 패키징 설정

### 신규 파일: `client/electron-builder.yml`

```yaml
appId: com.smarterd.app
productName: Smart ERD
copyright: Copyright (c) 2026 Smart ERD

directories:
  buildResources: build
  output: release

files:
  - out/**/*

mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: [universal]          # Intel + Apple Silicon 유니버설 바이너리

win:
  target:
    - target: nsis               # 설치형
      arch: [x64]
    - target: portable           # 무설치 실행
      arch: [x64]

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

### 앱 아이콘

| 파일 | 플랫폼 | 규격 |
|------|--------|------|
| `client/build/icon.icns` | macOS | 16~1024px 다중 해상도 컨테이너 (아래 참고) |
| `client/build/icon.ico` | Windows | 256×256 |
| `client/build/icon.png` | 원본/fallback | 1024×1024 |

> **macOS .icns 생성**: `.icns`는 16, 32, 64, 128, 256, 512, 1024px 해상도를 모두 포함하는 컨테이너 포맷이다. 1024×1024 원본 PNG에서 `electron-icon-builder` 또는 macOS `iconutil`로 변환한다. `electron-builder`가 빌드 시 자동 변환을 지원하므로 `icon.png`만 제공해도 동작한다.

### 코드 서명

- **초기 단계**: 코드 서명 없이 배포 (macOS에서 "확인되지 않은 개발자" 경고 표시)
- **안정화 후**: Apple Developer ID + Windows EV 인증서 적용
- macOS 공증(notarization)은 코드 서명 적용 후 별도 진행

---

## 전체 파일 변경 목록

### 신규 파일 (11개)

| 파일 | 설명 |
|------|------|
| `client/electron/main/index.ts` | Main process 엔트리포인트 |
| `client/electron/main/ipc-handlers.ts` | IPC 핸들러 (설정, 파일 저장) |
| `client/electron/main/settings-store.ts` | electron-store 기반 설정 관리 |
| `client/electron/main/menu.ts` | 네이티브 메뉴 (macOS/Windows) |
| `client/electron/preload/index.ts` | Context Bridge (보안 API 노출) |
| `client/src/lib/platform.ts` | 환경 감지 + 분기 중앙화 (redirectToLogin, updateServerUrl 등) |
| `client/src/types/electron.d.ts` | `window.electronAPI` 타입 선언 |
| `client/src/pages/settings/SettingsPage.tsx` | 서버 URL 설정 화면 |
| `client/electron.vite.config.ts` | electron-vite 빌드 설정 (Monaco Editor 플러그인 포함) |
| `client/electron-builder.yml` | 패키징 설정 |
| `client/tsconfig.node.json` | Electron TS 설정 |

### 수정 파일 (10개)

| 파일 | 변경 사항 |
|------|-----------|
| `client/package.json` | 의존성 + 스크립트 + `main` 필드 추가 (`monaco-editor`, `vite-plugin-monaco-editor` 포함) |
| `client/src/api/axiosInstance.ts` | `baseURL` request interceptor 동적화 (line 15), redirect → `redirectToLogin()` 위임 (line 21) |
| `client/src/lib/auth-refresh.ts` | `/api/auth/refresh` 경로 동적화 (line 106) |
| `client/src/stores/useAuthStore.ts` | `/api/auth/logout` 경로 동적화 (line 56) |
| `client/src/collaboration/YjsProvider.ts` | WS URL 동적화 (line 569-572) |
| `client/src/App.tsx` | `HashRouter` 조건부 사용 + 설정/리다이렉트 라우트 (line 2, 28) |
| `client/src/main.tsx` | bootstrap 초기화 (서버 URL 로드) |
| `client/src/constants/routes.ts` | `SETTINGS` 경로 추가 |
| `client/src/components/erd/DdlExportDialog.tsx` | Monaco Editor 로컬 번들 설정 (`loader.config({ monaco })`) |
| `client/src/components/layout/Header.tsx` | Electron 전용 설정 아이콘 추가 (Lucide Settings, LanguageSwitcher와 사용자명 사이) |

### 변경 불필요 (기존 그대로 동작)

| 기능 | 이유 |
|------|------|
| `localStorage` 기반 인증/i18n | Electron renderer에서 정상 동작 (앱별 격리) |
| `document.createElement('a')` 다운로드 | Electron에서 동작 (네이티브 저장은 선택적 개선) |
| `navigator.clipboard` | Electron 지원 |
| `@xyflow/react`, `yjs`, `zustand`, `react-query` | 모두 호환 |
| `react-hotkeys-hook` 단축키 | Electron renderer에서 정상 동작 |
| `html-to-image`, `jspdf` | DOM 기반이므로 Electron에서 정상 동작 |

---

## 앱 시작 플로우

```
1. Electron main process 시작
2. BrowserWindow 생성 (show: false) + CORS Origin 치환 설정 (session.webRequest)
3. preload 실행 → window.electronAPI 노출
4. renderer 로드 (index.html → main.tsx)
5. main.tsx bootstrap():
   5-1. window.electronAPI 확인 (optional chaining — ! assertion 미사용)
   5-2. electronAPI.getServerUrl() → initServerUrl(url) — 캐시 초기화
   5-3. createRoot() → React 렌더링 시작 (이 시점에 cachedServerUrl 확정)
6. ready-to-show → mainWindow.show() (흰 화면 깜빡임 방지)
7. 서버 URL 빈 문자열 → /settings 리다이렉트
   서버 URL 설정됨 → axiosInstance request interceptor가 매 요청 시 getApiBaseUrl() 동적 해석
8. 로그인 → 팀 → 프로젝트 → 다이어그램 (정상 사용)
```

---

## 검증 방법

1. `cd client && npm run dev:electron` → Electron 창에서 앱 정상 로드 확인
2. 설정 화면에서 서버 URL 입력 → 연결 테스트 성공 확인
3. 로그인 → 팀 목록 → 다이어그램 편집 → 저장 (REST API 통신 확인)
4. WebSocket 협업: 두 클라이언트에서 같은 다이어그램 동시 편집 확인
5. `npm run dev` → 기존 웹 빌드가 여전히 정상 동작 확인 (듀얼 타겟 보장)
6. `npm run dist:mac` → dmg 생성 후 설치 및 실행 확인
7. `npm run dist:win` → Windows 인스톨러/portable 실행 확인
8. DDL 에디터: 인터넷 차단 상태에서 DDL Export 다이얼로그의 Monaco Editor가 정상 로드되는지 확인
9. 서버 URL 변경 시나리오: 설정에서 서버 URL 변경 → 기존 캐시/토큰이 초기화되고 로그인 페이지로 이동하는지 확인

---

## 테스트 전략

### 단위 테스트

| 대상 | 검증 항목 |
|------|-----------|
| `platform.ts` | `isElectron()` — `window.electronAPI` 유무에 따른 분기, `getApiBaseUrl()` — Web(`'/api'`) vs Electron(`'{url}/api'`), `getWsBaseUrl()` — `ws://`/`wss://` 프로토콜 변환, `redirectToLogin()` — `window.location.href` vs `window.location.hash` 변경, `getApiBaseUrl()` — 초기화 전 호출 시 에러 throw |
| `axiosInstance.ts` | request interceptor가 `getApiBaseUrl()` 결과를 `config.baseURL`에 주입하는지 |

### `window.electronAPI` 모킹 전략

- 웹 환경 테스트: `window.electronAPI`가 `undefined` → `isElectron()` = `false` → 모든 분기가 Web 경로
- Electron 환경 테스트: `beforeEach`에서 `window.electronAPI = { isElectron: true, getServerUrl: vi.fn(), ... }` 모킹

### 웹 빌드 회귀 테스트

Electron 의존성 추가 후 기존 웹 빌드가 정상 동작하는지 확인하는 체크리스트:

```
[ ] npm run dev — Vite dev server 정상 기동 (포트 3000)
[ ] npm run build — tsc + vite build 성공
[ ] npm run lint — ESLint 에러 없음
[ ] 브라우저에서 로그인 → 팀 → 다이어그램 편집 → 저장 정상 동작
[ ] WebSocket 협업 정상 동작
[ ] window.electronAPI === undefined 확인 (웹에서 Electron API 노출 안 됨)
```

### E2E 검증

"검증 방법" 섹션의 9개 항목으로 수동 E2E 검증을 수행한다. 자동화된 Electron E2E 테스트(Playwright + Electron)는 프로젝트 규모를 고려하여 초기에는 도입하지 않고, 안정화 후 검토한다.

---

## 하드코딩 경로 방지 가이드라인

현재 코드에서 `/api/...`를 하드코딩하는 곳이 `axiosInstance.ts`, `auth-refresh.ts`, `useAuthStore.ts` 3곳이다. 향후 새로운 API 호출이 추가될 때 동일한 실수가 반복되지 않도록 다음을 준수한다:

1. **`axiosInstance`를 통하지 않는 API 호출 금지**: 현재 `auth-refresh.ts`와 `useAuthStore.ts`가 raw `axios`를 직접 사용하는 이유는 순환 의존 방지이다. 이 2곳은 `getApiBaseUrl()`을 사용하여 동적화한다. 그 외 모든 API 호출은 반드시 `axiosInstance`를 통해야 하며, `axiosInstance`의 request interceptor가 자동으로 baseURL을 주입한다.

2. **코드 리뷰 체크리스트에 추가**: PR 리뷰 시 `'/api/` 패턴의 하드코딩 문자열이 새로 추가되지 않았는지 확인.

3. **ESLint 커스텀 룰 (선택)**: `no-restricted-syntax`로 `'/api/'` 리터럴 사용을 금지하는 규칙 추가 가능.
