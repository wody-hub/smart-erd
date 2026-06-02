declare module 'js-yaml' {
  export function load(input: string): unknown;
  export function dump(input: unknown, options?: Record<string, unknown>): string;
}

interface ImportMetaEnv {
  readonly VITE_WS_DIRECT_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
