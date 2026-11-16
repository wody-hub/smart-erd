import js from '@eslint/js';
import globals from 'globals';

/** 기존 ESLint의 TS 전용 설정 외에 새 벤치마크 ESM에 실제 JS 규칙을 적용한다. */
export default [
  {
    files: [
      'scripts/perf/erd-collab-bench.mjs',
      'scripts/perf/lib/erd-collab-*.mjs',
      'scripts/perf/eslint.collab.config.mjs',
    ],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
