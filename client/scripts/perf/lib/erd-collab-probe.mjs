/**
 * 실제 UI 이벤트에 귀속할 유일한 대기 티켓을 찾는다.
 * @param {string} eventType 이벤트 종류
 * @param {object} target 입력 대상에서 읽은 테이블/컬럼/값
 * @param {object[]} candidates 대기 티켓
 * @returns {object|null} 모호하지 않게 일치한 티켓
 */
export function selectInputTicket(eventType, target, candidates) {
  const matching = candidates.filter((candidate) => {
    if (candidate.event !== eventType) return false;
    if (candidate.table && eventType !== 'pointerup' && candidate.table !== target.table)
      return false;
    if (eventType === 'input')
      return (
        candidate.column === target.column &&
        candidate.value === target.value &&
        target.table === candidate.table
      );
    return true;
  });
  return matching.length === 1 ? matching[0] : null;
}

/**
 * 편집 티켓의 전파 결과를 네 가지 상태로 분류한다.
 * @param {object} sample 수거된 편집 표본
 * @returns {'exact-seen'|'superseded'|'not-dispatched'|'pending'} 상태
 */
export function classifyTicket(sample) {
  if (sample.startedAt === null) return 'not-dispatched';
  if (
    sample.localSeenAt !== null &&
    sample.peers.length &&
    sample.peers.every((peer) => peer.seenAt !== null)
  )
    return 'exact-seen';
  if (sample.peers.some((peer) => peer.supersededAt != null)) return 'superseded';
  return 'pending';
}

/**
 * 앱 상태를 읽거나 변경하지 않고 DOM, 입력 이벤트와 브라우저 성능을 관찰한다.
 * @returns {void} 새 문서에 설치할 관찰기
 */
export function installCollabProbe() {
  /** 브라우저 문서 간 비교 가능한 epoch 밀리초 시계. */
  const clock = () => performance.timeOrigin + performance.now();
  /** 아직 수거하지 않은 편집 관찰 기록. */
  const watches = new Map();
  /** 아직 DOM에 반영되지 않은 조건만 순회해 측정 중 관찰 비용을 제한한다. */
  const activeWatches = new Set();
  /** 다음 실제 UI 이벤트를 기다리는 작성자 측 기록. */
  const inputs = new Map();
  /** 측정 창 안의 누적 브라우저 지표. */
  let metrics = null;
  /** 직전 애니메이션 프레임 시각. */
  let previousFrame = 0;
  /** 편집 가능 DOM이 최초로 나타난 시각. */
  let readyAt = null;

  /**
   * 렌더된 테이블의 컬럼 ID/이름과 모델 위치를 읽는다.
   * @param {string} table 테이블 ID
   * @returns {object|null} DOM에 없으면 null
   */
  function tableState(table) {
    const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(table)}"]`);
    if (!node) return null;
    const columns = [...node.querySelectorAll('[class~="group/col"]')].map((row, index) => {
      const handle = row.querySelector('[data-handleid]')?.getAttribute('data-handleid');
      const id = handle
        ?.slice(table.length + 1)
        .replace(/-(?:source|target)(?:-(?:left|right|top|bottom))?$/, '');
      const input = row.querySelector(
        'input[aria-label="Column name"],input[aria-label="컬럼 이름"]',
      );
      const name = input?.value ?? row.querySelector('span.font-mono.text-left')?.textContent ?? '';
      // 연결되지 않은 컬럼은 핸들이 렌더링되지 않으므로 결정적 시드 ID(`t{i}c{j}`)를 순서로 보완한다.
      return { id: id || `${table}c${index}`, name: name.trim() };
    });
    const position = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(node.style.transform);
    return {
      columns,
      position: position ? { x: Number(position[1]), y: Number(position[2]) } : null,
    };
  }

  /**
   * 관찰 조건이 DOM에 반영되었는지 검사한다.
   * @param {object} spec 관찰 조건
   * @returns {boolean} 조건 일치 여부
   */
  function matches(spec) {
    if (spec.kind === 'table-add') {
      return document.querySelectorAll('#diagram-sidebar span[title]').length >= spec.count;
    }
    const state = tableState(spec.table);
    if (!state) return false;
    if (spec.kind === 'rename') {
      return state.columns.some(
        (column) => column.id === spec.column && column.name === spec.value,
      );
    }
    if (spec.kind === 'column-add') return state.columns.length >= spec.count;
    if (spec.kind === 'move' && spec.from) {
      return (
        state.position &&
        (Math.abs(state.position.x - spec.from.x) > 2 ||
          Math.abs(state.position.y - spec.from.y) > 2)
      );
    }
    if (spec.kind === 'move') {
      return (
        state.position &&
        Math.abs(state.position.x - spec.x) < 2 &&
        Math.abs(state.position.y - spec.y) < 2
      );
    }
    return false;
  }

  /**
   * MutationObserver 또는 프레임 보조 관찰 시각에 조건을 평가한다.
   * @param {string} source 시각을 잡은 관찰기
   * @returns {void}
   */
  function scan(source) {
    const now = clock();
    if (readyAt === null) {
      const backup = [...document.querySelectorAll('button')].find((button) =>
        /^(백업|backup)$/i.test(button.textContent?.trim() ?? ''),
      );
      if (backup && !backup.disabled && backup.getClientRects().length) readyAt = now;
    }
    for (const watch of activeWatches) {
      if (matches(watch.spec)) {
        watch.seenAt = now;
        watch.source = source;
        activeWatches.delete(watch);
      } else if (watch.spec.supersededBy) {
        const state = tableState(watch.spec.table);
        const column = state?.columns.find((item) => item.id === watch.spec.column);
        const newer = new RegExp(`^c2_${watch.spec.supersededBy.writer}_(\\d+)$`).exec(
          column?.name ?? '',
        );
        if (newer && Number(newer[1]) > watch.spec.supersededBy.sequence) {
          watch.supersededAt = now;
          watch.supersededBySequence = Number(newer[1]);
          activeWatches.delete(watch);
        }
      }
    }
  }

  /** DOM 텍스트·행·transform 변경은 이 관찰기로 시각을 잡는다. */
  const mutations = new MutationObserver(() => scan('mutation'));
  mutations.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'value', 'disabled'],
  });

  /**
   * 실제 입력 이벤트의 시작 시각을 기록한다.
   * @param {Event} event 캡처 단계 UI 이벤트
   * @returns {void}
   */
  function recordInput(event) {
    const input = event.type === 'input' ? event.target : null;
    const row = input?.closest?.('[class~="group/col"]');
    const tableNode = event.target.closest?.('.react-flow__node[data-id]');
    const table = tableNode?.getAttribute('data-id') ?? null;
    const handle = row?.querySelector('[data-handleid]')?.getAttribute('data-handleid');
    const column = handle
      ?.slice((table ?? '').length + 1)
      .replace(/-(?:source|target)(?:-(?:left|right|top|bottom))?$/, '');
    const candidates = [...inputs.entries()]
      .filter(([, pending]) => pending.startedAt === null)
      .map(([id, pending]) => ({ id, ...pending }));
    const match = selectInputTicket(event.type, { table, column, value: input?.value }, candidates);
    if (match) inputs.get(match.id).startedAt = clock();
  }
  for (const event of ['input', 'click', 'pointerup']) {
    document.addEventListener(event, recordInput, true);
  }

  /** longtask 리소스는 배열 대신 누적 값만 유지한다. */
  const longTasks = new PerformanceObserver((list) => {
    if (!metrics) return;
    for (const entry of list.getEntries()) {
      if (entry.startTime < metrics.startedAt) continue;
      metrics.longtaskCount += 1;
      metrics.longtaskTotalMs += entry.duration;
      metrics.longtaskMaxMs = Math.max(metrics.longtaskMaxMs, entry.duration);
    }
  });
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    longTasks.observe({ type: 'longtask' });
  }

  /**
   * 프레임 지연과 React 제어 input.value의 property 변경을 보조 관찰한다.
   * @param {number} now rAF 시각
   * @returns {void}
   */
  function frame(now) {
    if (metrics && previousFrame) {
      const gap = now - previousFrame;
      if (gap > 50) metrics.frameGapOver50Count += 1;
      metrics.frameGapMaxMs = Math.max(metrics.frameGapMaxMs, gap);
    }
    previousFrame = now;
    if (activeWatches.size) scan('raf');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /** 계측 전용 API. 제품 store/Y.Doc에는 접근하지 않는다. */
  window.__collabBench = {
    clock,
    tableState,
    /** @returns {number|null} 편집 가능 DOM의 최초 발견 시각 */
    readyAt: () => readyAt,
    /**
     * @param {string} id 편집 ID
     * @param {object} spec DOM 조건
     * @param {string|null} event 작성자의 실제 UI 이벤트
     * @returns {void}
     */
    arm(id, spec, event = null) {
      const watch = { spec, seenAt: null, source: null, supersededAt: null };
      watches.set(id, watch);
      activeWatches.add(watch);
      if (event)
        inputs.set(id, {
          event,
          table: spec.table,
          column: spec.column,
          value: spec.value,
          startedAt: null,
        });
    },
    /** @param {string} id 편집 ID @returns {object} 관찰 기록 */
    read(id) {
      const watch = watches.get(id);
      return {
        seenAt: watch?.seenAt ?? null,
        source: watch?.source ?? null,
        supersededAt: watch?.supersededAt ?? null,
        supersededBySequence: watch?.supersededBySequence ?? null,
        startedAt: inputs.get(id)?.startedAt ?? null,
      };
    },
    /** @param {string[]} ids 수거한 편집 ID @returns {void} */
    forget(ids) {
      for (const id of ids) {
        activeWatches.delete(watches.get(id));
        watches.delete(id);
        inputs.delete(id);
      }
    },
    /** @returns {void} 누적 브라우저 지표 수집 시작 */
    start() {
      previousFrame = 0;
      metrics = {
        startedAt: performance.now(),
        longtaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
        longtaskCount: 0,
        longtaskTotalMs: 0,
        longtaskMaxMs: 0,
        frameGapOver50Count: 0,
        frameGapMaxMs: 0,
      };
    },
    /** @returns {object|null} 수집한 지표와 측정 종료 */
    stop() {
      const result = metrics;
      metrics = null;
      return result;
    },
  };
}

/**
 * 브라우저에 주입할 프로브 스크립트.
 * `page.addInitScript(fn)`은 함수 본문만 직렬화하므로, 모듈 수준 보조 함수(`selectInputTicket`)를 함께 넣어야 한다.
 */
export const COLLAB_PROBE_SCRIPT = `${selectInputTicket.toString()}\n(${installCollabProbe.toString()})();`;
