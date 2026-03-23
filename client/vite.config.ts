import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite 개발 서버 포트와 백엔드 프록시 대상을 env로 오버라이드할 수 있는 설정.
 *
 * @param configEnv Vite 실행 모드
 * @returns Smart ERD 프론트엔드용 Vite 설정
 */
export default defineConfig((configEnv) => {
  const env = loadEnv(configEnv.mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 7500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/lib/monaco-dsl-language') || id.includes('/src/lib/dsl-')) {
              return 'feature-dsl';
            }
            if (id.includes('/src/lib/ddl-')) {
              return 'feature-ddl';
            }
            if (
              id.includes('/src/hooks/useBidirectionalCodeSync') ||
              id.includes('/src/hooks/useCodeEditorTableLock') ||
              id.includes('/src/lib/code-sync-') ||
              id.includes('/src/lib/remote-edit-locks')
            ) {
              return 'feature-code-sync';
            }
            if (id.includes('node_modules/monaco-editor')) {
              return 'vendor-monaco';
            }
            if (id.includes('node_modules/@monaco-editor/react')) {
              return 'vendor-monaco-react';
            }
            if (id.includes('node_modules/@xyflow/react')) {
              return 'vendor-reactflow';
            }
            if (
              id.includes('node_modules/yjs') ||
              id.includes('node_modules/y-websocket') ||
              id.includes('node_modules/y-protocols') ||
              id.includes('node_modules/lib0')
            ) {
              return 'vendor-collab';
            }
            if (id.includes('node_modules/@dnd-kit')) {
              return 'vendor-dndkit';
            }
            if (
              id.includes('node_modules/@radix-ui') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/lucide-react')
            ) {
              return 'vendor-ui';
            }
            if (id.includes('node_modules/node-sql-parser/build/postgresql')) {
              return 'vendor-sql-postgresql';
            }
            if (id.includes('node_modules/node-sql-parser/build/transactsql')) {
              return 'vendor-sql-transactsql';
            }
            if (id.includes('node_modules/node-sql-parser/build/mysql')) {
              return 'vendor-sql-mysql';
            }
            if (id.includes('node_modules/node-sql-parser')) {
              return 'vendor-sql-parser-core';
            }
            if (
              id.includes('node_modules/html-to-image') ||
              id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas')
            ) {
              return 'vendor-export';
            }
            if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('node_modules/react-router') || id.includes('node_modules/@tanstack')) {
              return 'vendor-routing-query';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/zustand')) {
              return 'vendor-state';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT ?? '4503'),
      strictPort: env.VITE_DEV_SERVER_STRICT_PORT === 'true',
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:9503',
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_WS_PROXY_TARGET ?? 'ws://localhost:9503',
          ws: true,
        },
      },
    },
  };
});
