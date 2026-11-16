import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { classifyTicket, COLLAB_PROBE_SCRIPT, selectInputTicket } from './erd-collab-probe.mjs';
import { loadDiagramHelpers, summarize } from './erd-collab-system.mjs';

/**
 * 관찰 타이밍을 결정적으로 제어하는 DOM/Performance 최소 계약 모형을 만든다.
 * @returns {object} 브라우저 없이 MutationObserver/rAF/입력 시각을 검증하는 환경
 */
function createProbeHarness() {
  let now = 0;
  let mutation;
  let frame;
  let longtask;
  const events = new Map();
  const column = { name: 'id', input: false };
  const row = {
    closest: (selector) => (selector.includes('group/col') ? row : null),
    querySelector(selector) {
      if (selector === '[data-handleid]') return { getAttribute: () => 't0-t0c0-source-right' };
      if (selector.startsWith('input')) return column.input ? { value: column.name } : null;
      return { textContent: column.name };
    },
  };
  const node = {
    style: { transform: 'translate(10px, 20px)' },
    getAttribute: () => 't0',
    querySelectorAll: () => [row],
  };
  const document = {
    querySelector: () => node,
    querySelectorAll: () => [],
    addEventListener: (type, listener) => events.set(type, listener),
  };
  const context = vm.createContext({
    window: {},
    document,
    CSS: { escape: (value) => value },
    performance: { timeOrigin: 1000, now: () => now },
    MutationObserver: class {
      constructor(callback) {
        mutation = callback;
      }
      observe() {}
    },
    PerformanceObserver: class {
      static supportedEntryTypes = ['longtask'];
      constructor(callback) {
        longtask = callback;
      }
      observe() {}
    },
    requestAnimationFrame: (callback) => {
      frame = callback;
    },
  });
  vm.runInContext(COLLAB_PROBE_SCRIPT, context);
  return {
    probe: context.window.__collabBench,
    column,
    node,
    advance(value) {
      now = value;
    },
    mutate() {
      mutation();
    },
    frame(value) {
      now = value;
      frame(value);
    },
    longtask(entries) {
      longtask({ getEntries: () => entries });
    },
    input(table = 't0') {
      events.get('input')({
        type: 'input',
        target: {
          value: column.name,
          closest: (selector) => {
            if (selector.includes('group/col')) return row;
            if (selector.includes('data-id') && table === 't0') return node;
            return null;
          },
        },
      });
    },
  };
}

test('백분위수는 최근접 순위이며 누락값을 0으로 집계하지 않는다', () => {
  assert.deepEqual(summarize([null, undefined, NaN]), {
    n: 0,
    p50: null,
    p95: null,
    max: null,
    mean: null,
  });
  assert.deepEqual(summarize([4, 1, 2, 3, null]), { n: 4, p50: 2, p95: 4, max: 4, mean: 2.5 });
});

test('MO는 컬럼 ID와 값이 일치하는 첫 반영 시각만 저장한다', () => {
  const h = createProbeHarness();
  h.probe.arm('edit', { kind: 'rename', table: 't0', column: 't0c0', value: 'new' });
  h.advance(5);
  h.mutate();
  assert.equal(h.probe.read('edit').seenAt, null);
  h.column.name = 'new';
  h.advance(20);
  h.mutate();
  assert.equal(h.probe.read('edit').seenAt, 1020);
  assert.equal(h.probe.read('edit').source, 'mutation');
  h.advance(30);
  h.mutate();
  assert.equal(h.probe.read('edit').seenAt, 1020);
  h.probe.forget(['edit']);
  assert.equal(h.probe.read('edit').seenAt, null);
});

test('작성자 input.value는 실제 입력 시각과 rAF 보조 관찰로 구분한다', () => {
  const h = createProbeHarness();
  h.column.input = true;
  h.probe.arm('edit', { kind: 'rename', table: 't0', column: 't0c0', value: 'new' }, 'input');
  h.advance(5);
  h.input('t1');
  assert.equal(h.probe.read('edit').startedAt, null);
  h.advance(10);
  h.column.name = 'new';
  h.input();
  h.frame(16);
  assert.equal(h.probe.read('edit').startedAt, 1010);
  assert.equal(h.probe.read('edit').seenAt, 1016);
  assert.equal(h.probe.read('edit').source, 'raf');
});

test('입력은 실제 컬럼과 목표 값이 일치하는 티켓 하나에만 귀속한다', () => {
  const pending = [
    { id: 'old', event: 'input', table: 't0', column: 't0c0', value: 'c2_0_4' },
    { id: 'new', event: 'input', table: 't0', column: 't0c0', value: 'c2_0_5' },
    { id: 'other-column', event: 'input', table: 't0', column: 't0c1', value: 'c2_0_5' },
  ];
  const target = { table: 't0', column: 't0c0', value: 'c2_0_5' };
  assert.equal(selectInputTicket('input', target, pending).id, 'new');
  assert.equal(selectInputTicket('input', { ...target, value: 'unknown' }, pending), null);
});

test('같은 이벤트에 맞는 티켓이 여러 개면 모두 시작 처리하지 않는다', () => {
  const pending = [
    { id: 'first', event: 'click', table: 't0' },
    { id: 'second', event: 'click', table: 't0' },
  ];
  assert.equal(selectInputTicket('click', { table: 't0' }, pending), null);
  assert.equal(selectInputTicket('click', { table: 't1' }, pending), null);
});

test('더 큰 동일 작성자 sequence는 superseded로, exact는 exact-seen으로 분류한다', () => {
  assert.equal(
    classifyTicket({
      startedAt: 10,
      localSeenAt: null,
      peers: [{ seenAt: null, supersededAt: 20 }],
    }),
    'superseded',
  );
  assert.equal(
    classifyTicket({ startedAt: 10, localSeenAt: 20, peers: [{ seenAt: 20, supersededAt: null }] }),
    'exact-seen',
  );
  assert.equal(classifyTicket({ startedAt: null, peers: [] }), 'not-dispatched');
  assert.equal(classifyTicket({ startedAt: 10, peers: [{ seenAt: null }] }), 'pending');
});

test('잘못된 컬럼 ID와 목표에 못 미친 이동은 성공으로 기록하지 않는다', () => {
  const h = createProbeHarness();
  h.probe.arm('wrong', { kind: 'rename', table: 't0', column: 'other', value: 'id' });
  h.probe.arm('move', { kind: 'move', table: 't0', x: 58, y: 20 });
  h.mutate();
  assert.equal(h.probe.read('wrong').seenAt, null);
  assert.equal(h.probe.read('move').seenAt, null);
  h.node.style.transform = 'translate(58px, 20px)';
  h.advance(40);
  h.mutate();
  assert.equal(h.probe.read('move').seenAt, 1040);
});

test('longtask/rAF는 측정 창만 집계하며 종료 후 누적하지 않는다', () => {
  const h = createProbeHarness();
  h.advance(50);
  h.probe.start();
  h.longtask([
    { startTime: 49, duration: 90 },
    { startTime: 60, duration: 70 },
  ]);
  h.frame(60);
  h.frame(120);
  const metrics = h.probe.stop();
  assert.equal(metrics.longtaskCount, 1);
  assert.equal(metrics.longtaskTotalMs, 70);
  assert.equal(metrics.frameGapOver50Count, 1);
  h.longtask([{ startTime: 130, duration: 80 }]);
  assert.equal(metrics.longtaskCount, 1);
});

test('공유 TypeScript E2E 헬퍼를 서버 시작 없이 직접 재사용한다', async () => {
  const helpers = await loadDiagramHelpers();
  for (const name of [
    'provisionCollaborationFixture',
    'loginViaUi',
    'waitForEditableDiagram',
    'diagramUrl',
  ]) {
    assert.equal(typeof helpers[name], 'function');
  }
});
