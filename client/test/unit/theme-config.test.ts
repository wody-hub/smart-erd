import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStoredTheme,
  isDarkTheme,
  resolveMonacoTheme,
  applyThemeClass,
  DEFAULT_THEME,
} from '../../src/lib/theme.js';

// --- resolveStoredTheme ---

test('resolveStoredTheme(null) 은 기본 테마 paper 를 반환한다', () => {
  assert.equal(resolveStoredTheme(null), 'paper');
});

test('resolveStoredTheme(undefined) 은 기본 테마 paper 를 반환한다', () => {
  assert.equal(resolveStoredTheme(undefined), 'paper');
});

test('resolveStoredTheme("") 은 기본 테마 paper 를 반환한다', () => {
  assert.equal(resolveStoredTheme(''), 'paper');
});

test('resolveStoredTheme("unknown") 은 기본 테마 paper 를 반환한다', () => {
  assert.equal(resolveStoredTheme('unknown'), 'paper');
});

test('resolveStoredTheme("paper") 은 paper 를 반환한다', () => {
  assert.equal(resolveStoredTheme('paper'), 'paper');
});

test('resolveStoredTheme("graphite") 은 graphite 를 반환한다', () => {
  assert.equal(resolveStoredTheme('graphite'), 'graphite');
});

test('resolveStoredTheme("midnight") 은 midnight 를 반환한다', () => {
  assert.equal(resolveStoredTheme('midnight'), 'midnight');
});

// --- isDarkTheme ---

test('isDarkTheme("paper") 은 false 를 반환한다', () => {
  assert.equal(isDarkTheme('paper'), false);
});

test('isDarkTheme("graphite") 은 true 를 반환한다', () => {
  assert.equal(isDarkTheme('graphite'), true);
});

test('isDarkTheme("midnight") 은 true 를 반환한다', () => {
  assert.equal(isDarkTheme('midnight'), true);
});

// --- resolveMonacoTheme ---

test('resolveMonacoTheme("paper") 은 vs 를 반환한다', () => {
  assert.equal(resolveMonacoTheme('paper'), 'vs');
});

test('resolveMonacoTheme("graphite") 은 vs-dark 를 반환한다', () => {
  assert.equal(resolveMonacoTheme('graphite'), 'vs-dark');
});

test('resolveMonacoTheme("midnight") 은 vs-dark 를 반환한다', () => {
  assert.equal(resolveMonacoTheme('midnight'), 'vs-dark');
});

// --- DEFAULT_THEME ---

test('DEFAULT_THEME 은 paper 이다', () => {
  assert.equal(DEFAULT_THEME, 'paper');
});

// --- applyThemeClass ---

test('applyThemeClass 는 theme-paper, theme-graphite, theme-midnight class 이름을 사용한다', () => {
  const el = createMockElement();

  applyThemeClass(el, 'paper');
  assert.ok(el.classList.contains('theme-paper'));
  assert.ok(!el.classList.contains('theme-graphite'));
  assert.ok(!el.classList.contains('theme-midnight'));

  applyThemeClass(el, 'graphite');
  assert.ok(!el.classList.contains('theme-paper'));
  assert.ok(el.classList.contains('theme-graphite'));
  assert.ok(!el.classList.contains('theme-midnight'));

  applyThemeClass(el, 'midnight');
  assert.ok(!el.classList.contains('theme-paper'));
  assert.ok(!el.classList.contains('theme-graphite'));
  assert.ok(el.classList.contains('theme-midnight'));
});

test('applyThemeClass paper 는 theme-paper 만 남고 .dark 는 제거된다', () => {
  const el = createMockElement();
  el.classList.add('dark');

  applyThemeClass(el, 'paper');

  assert.ok(el.classList.contains('theme-paper'));
  assert.ok(!el.classList.contains('dark'));
});

test('applyThemeClass graphite 는 theme-graphite 와 .dark 가 함께 남는다', () => {
  const el = createMockElement();

  applyThemeClass(el, 'graphite');

  assert.ok(el.classList.contains('theme-graphite'));
  assert.ok(el.classList.contains('dark'));
});

test('applyThemeClass midnight 는 theme-midnight 와 .dark 가 함께 남는다', () => {
  const el = createMockElement();

  applyThemeClass(el, 'midnight');

  assert.ok(el.classList.contains('theme-midnight'));
  assert.ok(el.classList.contains('dark'));
});

// --- helpers ---

/**
 * classList를 시뮬레이션하는 mock HTMLElement를 생성한다.
 *
 * @returns classList가 포함된 mock HTMLElement
 */
function createMockElement(): HTMLElement {
  const classes = new Set<string>();
  return {
    classList: {
      add(cls: string) {
        classes.add(cls);
      },
      remove(cls: string) {
        classes.delete(cls);
      },
      contains(cls: string) {
        return classes.has(cls);
      },
    },
  } as unknown as HTMLElement;
}
