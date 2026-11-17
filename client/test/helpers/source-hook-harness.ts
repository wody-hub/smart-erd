import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/** DOM 없이 입력 이벤트와 훅의 상태 전이를 실행한다. */
export function sourceHookHarness(
  file: string,
  mocks: Record<string, unknown>,
  globals: Record<string, unknown> = {},
) {
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const timers = new Map<number, () => void>();
  let cursor = 0;
  let refCursor = 0;
  let timerId = 0;
  const effects: (() => void | (() => void))[] = [];
  const cleanups: (() => void)[] = [];
  const hooks = {
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        },
      ];
    },
    useRef: (initial: unknown) => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
  };
  const require = createRequire(import.meta.url);
  const fallback = new Proxy(() => null, {
    get: (_target, key) => (key === '__esModule' ? true : fallback),
  });
  const module = { exports: {} as Record<string, unknown> };
  const source = ts.transpileModule(
    readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  runInNewContext(source, {
    module,
    exports: module.exports,
    require: (id: string) =>
      id === 'react'
        ? hooks
        : id === 'react/jsx-runtime'
          ? require(id)
          : (mocks[id] ?? mocks[id.split('/').at(-1)!.replace(/\.js$/, '')] ?? fallback),
    setTimeout: (fn: () => void) => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: (id: number) => timers.delete(id),
    performance,
    console,
    ...globals,
  });
  return {
    exports: module.exports,
    refs,
    runEffects() {
      effects.splice(0).forEach((effect) => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      });
    },
    cleanup() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
    },
    render<T>(fn: () => T): T {
      cursor = 0;
      refCursor = 0;
      return fn();
    },
    flush() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((fn) => fn());
    },
  };
}
