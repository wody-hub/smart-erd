type ProbeScalar = number | string | boolean | null;
type ProbeDetail = Record<string, ProbeScalar>;

interface ProbeEvent {
  runId: string;
  lifecycleId: string;
  seq: number;
  t: number;
  type: string;
  detail?: ProbeDetail;
}

interface ProbeAggregate {
  calls: number;
  totalMs: number;
  maxMs: number;
}

interface ProbeSnapshot {
  runId: string;
  events: ProbeEvent[];
  counters: Record<string, ProbeAggregate>;
  errors: Array<{ t: number; kind: string }>;
  ready: {
    connected: boolean;
    synced: boolean;
    remoteSnapshotApplied: boolean;
    previewReleased: boolean;
    liveReadyAt: number | null;
    liveSettledAt: number | null;
    liveSettledTimeoutAt: number | null;
  };
  graph: {
    nodes: number;
    edges: number;
    expectedNodes: number | null;
    expectedEdges: number | null;
  };
  internalsPending: number;
  lastRelevantActivityAt: number;
  longTaskEndAt: number;
  lifecycleCounts: Record<string, { mount: number; unmount: number }>;
}

interface ProbeWindow extends Window {
  __ERD_PERF_PROBE_ENABLE__?: boolean;
  __ERD_PERF_ROUTE_DETOUR_OFF__?: boolean;
  __ERD_PERF_RUN_ID__?: string;
  __ERD_PERF_SNAPSHOT__?: () => ProbeSnapshot;
  __ERD_PROJECTION_EDITOR__?: unknown;
}

const probeWindow = (typeof window === 'undefined' ? {} : window) as ProbeWindow;
const enabled =
  typeof window !== 'undefined' &&
  import.meta.env.VITE_ERD_PERF_PROBE === 'true' &&
  probeWindow.__ERD_PERF_PROBE_ENABLE__ === true;
const MAX_EVENTS = 5_000;
let sequence = 0;
let lifecycleSequence = 0;
let navigationOrigin = 0;
let navigationOriginSet = false;
let previousFrameAt = 0;
let activeLifecycleId = 'unassigned';
let settlingTimer: ReturnType<typeof setInterval> | null = null;
let settlingTimeout: ReturnType<typeof setTimeout> | null = null;

const snapshot: ProbeSnapshot = {
  runId: enabled ? (probeWindow.__ERD_PERF_RUN_ID__ ?? 'unassigned') : '',
  events: [],
  counters: {},
  errors: [],
  ready: {
    connected: false,
    synced: false,
    remoteSnapshotApplied: false,
    previewReleased: false,
    liveReadyAt: null,
    liveSettledAt: null,
    liveSettledTimeoutAt: null,
  },
  graph: { nodes: 0, edges: 0, expectedNodes: null, expectedEdges: null },
  internalsPending: 0,
  lastRelevantActivityAt: 0,
  longTaskEndAt: 0,
  lifecycleCounts: {},
};

function now(): number {
  return performance.now() - navigationOrigin;
}

function emit(type: string, detail?: ProbeDetail): void {
  if (!enabled || !navigationOriginSet) return;
  const t = now();
  const event: ProbeEvent = {
    runId: snapshot.runId,
    lifecycleId: activeLifecycleId,
    seq: ++sequence,
    t,
    type,
    ...(detail ? { detail } : {}),
  };
  if (snapshot.events.length === MAX_EVENTS) snapshot.events.shift();
  snapshot.events.push(event);
  try {
    performance.mark(`erdperf:${type}`, { detail: event });
  } catch {
    // User timing support varies; the in-memory snapshot remains authoritative.
  }
}

function updateReady(key: keyof ProbeSnapshot['ready'], value: boolean): void {
  if (!enabled || !navigationOriginSet) return;
  (snapshot.ready[key] as unknown) = value;
  emit(`readiness:${key}`, { value });
  maybeLiveReady();
}

function maybeLiveReady(): void {
  if (!enabled || snapshot.ready.liveReadyAt != null) return;
  const { connected, synced, remoteSnapshotApplied, previewReleased } = snapshot.ready;
  if (!connected || !synced || !remoteSnapshotApplied || !previewReleased) return;
  const t = now();
  snapshot.ready.liveReadyAt = t;
  snapshot.lastRelevantActivityAt = t;
  emit('live-ready', {
    nodes: snapshot.graph.nodes,
    edges: snapshot.graph.edges,
    semantics: 'remote-snapshot+sync+ws-connected+preview-released',
  });
  requestAnimationFrame(() =>
    requestAnimationFrame(() => emit('live-presentation-proxy', { rafs: 2 })),
  );
  settlingTimeout = setTimeout(() => {
    if (snapshot.ready.liveSettledAt == null) {
      snapshot.ready.liveSettledTimeoutAt = now();
      emit('live-settled-timeout', { timeoutMs: 30_000 });
    }
    if (settlingTimer) clearInterval(settlingTimer);
    settlingTimer = null;
  }, 30_000);
  settlingTimer = setInterval(checkSettled, 50);
}

function checkSettled(): void {
  if (!enabled || snapshot.ready.liveReadyAt == null || snapshot.ready.liveSettledAt != null)
    return;
  const expectedNodes = snapshot.graph.expectedNodes;
  const expectedEdges = snapshot.graph.expectedEdges;
  if (expectedNodes == null || expectedEdges == null) return;
  const renderedNodes = document.querySelectorAll('.react-flow__node').length;
  const renderedEdges = document.querySelectorAll('.react-flow__edge').length;
  snapshot.graph.nodes = renderedNodes;
  snapshot.graph.edges = renderedEdges;
  if (
    renderedNodes !== expectedNodes ||
    renderedEdges !== expectedEdges ||
    snapshot.internalsPending !== 0 ||
    now() - snapshot.lastRelevantActivityAt < 500 ||
    now() - snapshot.longTaskEndAt < 500
  ) {
    return;
  }
  snapshot.ready.liveSettledAt = now();
  emit('live-settled', { nodes: renderedNodes, edges: renderedEdges, stableMs: 500 });
  if (settlingTimer) clearInterval(settlingTimer);
  settlingTimer = null;
  if (settlingTimeout) clearTimeout(settlingTimeout);
  settlingTimeout = null;
}

if (enabled) {
  previousFrameAt = now();
  const trackFrameGap = (frameAt: number) => {
    const gap = frameAt - previousFrameAt;
    previousFrameAt = frameAt;
    if (navigationOriginSet && gap > 50) {
      const aggregate = (snapshot.counters['raf-gap'] ??= { calls: 0, totalMs: 0, maxMs: 0 });
      aggregate.calls += 1;
      aggregate.totalMs += gap;
      aggregate.maxMs = Math.max(aggregate.maxMs, gap);
      emit('raf-gap', { gapMs: gap });
    }
    requestAnimationFrame(trackFrameGap);
  };
  requestAnimationFrame(trackFrameGap);

  try {
    const observer = new PerformanceObserver((list) => {
      if (!navigationOriginSet) return;
      const entries = list.getEntries();
      for (const entry of entries) {
        const taskStart = entry.startTime - navigationOrigin;
        if (taskStart < 0) continue;
        snapshot.longTaskEndAt = Math.max(snapshot.longTaskEndAt, taskStart + entry.duration);
        emit('long-task', {
          start: taskStart,
          duration: entry.duration,
          blockingExcessMs: Math.max(0, entry.duration - 50),
        });
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    emit('observer-unavailable', { kind: 'longtask' });
  }

  window.addEventListener('error', () => {
    snapshot.errors.push({ t: now(), kind: 'error' });
    emit('js-error', { kind: 'error' });
  });
  window.addEventListener('unhandledrejection', () => {
    snapshot.errors.push({ t: now(), kind: 'unhandledrejection' });
    emit('js-error', { kind: 'unhandledrejection' });
  });

  probeWindow.__ERD_PERF_SNAPSHOT__ = () => structuredClone(snapshot);
}

export function isErdPerformanceProbeEnabled(): boolean {
  return enabled;
}

export function probeSetNavigationOrigin(): void {
  if (!enabled || navigationOriginSet) return;
  navigationOrigin = performance.now();
  navigationOriginSet = true;
  previousFrameAt = 0;
  snapshot.lastRelevantActivityAt = 0;
  snapshot.longTaskEndAt = 0;
  emit('navigation-start');
}

export function createProbeLifecycleId(prefix: string): string {
  if (!enabled || !navigationOriginSet) return '';
  const id = `${prefix}-${++lifecycleSequence}`;
  activeLifecycleId = id;
  snapshot.lifecycleCounts[id] = { mount: 1, unmount: 0 };
  emit('lifecycle-mount');
  return id;
}

export function recordProbeUnmount(id: string): void {
  if (!enabled || !navigationOriginSet || !id || !snapshot.lifecycleCounts[id]) return;
  snapshot.lifecycleCounts[id].unmount += 1;
  activeLifecycleId = id;
  emit('lifecycle-unmount');
}

export function probeMark(phase: string, detail?: ProbeDetail): void {
  emit(phase, detail);
}

export function probeBegin(phase: string, detail?: ProbeDetail): number | null {
  if (!enabled || !navigationOriginSet) return null;
  const startedAt = now();
  emit(`${phase}:start`, detail);
  return startedAt;
}

export function probeEnd(phase: string, startedAt: number | null, detail?: ProbeDetail): number {
  if (startedAt == null || !enabled || !navigationOriginSet) return 0;
  const duration = Math.max(0, now() - startedAt);
  const aggregate = (snapshot.counters[phase] ??= { calls: 0, totalMs: 0, maxMs: 0 });
  aggregate.calls += 1;
  aggregate.totalMs += duration;
  aggregate.maxMs = Math.max(aggregate.maxMs, duration);
  emit(`${phase}:end`, { ...detail, durationMs: duration });
  if (['projection', 'routing', 'geometry'].some((kind) => phase.includes(kind))) {
    snapshot.lastRelevantActivityAt = now();
  }
  return duration;
}

export function probeCounter(name: string, count = 1, durationMs = 0): void {
  if (!enabled || !navigationOriginSet) return;
  const aggregate = (snapshot.counters[name] ??= { calls: 0, totalMs: 0, maxMs: 0 });
  aggregate.calls += count;
  aggregate.totalMs += durationMs;
  aggregate.maxMs = Math.max(aggregate.maxMs, durationMs);
}

export function probeAggregateStart(): number | null {
  return enabled && navigationOriginSet ? now() : null;
}

/** Returns true only for an explicitly enabled performance run's detour-off variant. */
export function isPerfRouteDetourOff(): boolean {
  return enabled && probeWindow.__ERD_PERF_ROUTE_DETOUR_OFF__ === true;
}

export function probeAggregateEnd(name: string, startedAt: number | null): void {
  if (!enabled || !navigationOriginSet || startedAt == null) return;
  const duration = Math.max(0, now() - startedAt);
  const aggregate = (snapshot.counters[name] ??= { calls: 0, totalMs: 0, maxMs: 0 });
  aggregate.calls += 1;
  aggregate.totalMs += duration;
  aggregate.maxMs = Math.max(aggregate.maxMs, duration);
  if (name.includes('routing') || name.includes('obstacle-selector')) {
    snapshot.lastRelevantActivityAt = now();
  }
}

export function probeSetConnectionStatus(status: string): void {
  if (!enabled) return;
  updateReady('connected', status === 'connected');
  if (status === 'connected') emit('ws-open');
}

export function probeSetSynced(synced: boolean): void {
  updateReady('synced', synced);
  if (synced) emit('ws-sync');
}

export function probeRemoteSnapshotApplied(): void {
  updateReady('remoteSnapshotApplied', true);
}

export function probePreviewReleased(reason: 'remote' | 'fallback' | 'not-needed'): void {
  if (!enabled) return;
  updateReady('previewReleased', true);
  if (reason === 'fallback') emit('preview-fallback', { reason });
}

export function probePresentationProxy(name: 'preview' | 'live'): void {
  if (!enabled) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => emit(`${name}-presentation-proxy`, { rafs: 2 })),
  );
}

export function probeSetGraphCounts(nodes: number, edges: number, expected = false): void {
  if (!enabled || !navigationOriginSet) return;
  snapshot.graph.nodes = nodes;
  snapshot.graph.edges = edges;
  if (expected) {
    snapshot.graph.expectedNodes = nodes;
    snapshot.graph.expectedEdges = edges;
  }
  emit('graph-counts', { nodes, edges, expected });
}

export function probeSetInternalsPending(count: number): void {
  if (!enabled || !navigationOriginSet) return;
  snapshot.internalsPending = Math.max(0, count);
}

export function probeMarkInternalsQueueStart(pending: number): void {
  if (enabled && navigationOriginSet) emit('node-internals-queue-start', { pending });
}

export function probeRelevantActivity(kind: 'routing' | 'geometry' | 'projection'): void {
  if (!enabled || !navigationOriginSet) return;
  snapshot.lastRelevantActivityAt = now();
  probeCounter(`${kind}-activity`);
}

/**
 * 문서 이벤트 수신부터 전용 Monaco 패치·선택·viewport 복원 완료까지 기록한다.
 * 기존 probe 이중 플래그가 켜진 경우에만 snapshot과 User Timing mark를 남긴다.
 * @param receivedAt performance.now 기준 문서 이벤트 수신 시각
 * @param revision 적용한 투영 버전
 * @param relocatedTargets 삭제 대상의 의미상 위치 이동 개수
 * @returns 없음
 */
export function probeProjectionPatchApplied(
  receivedAt: number,
  revision: number,
  relocatedTargets: number,
): void {
  if (!enabled || !navigationOriginSet) return;
  const durationMs = Math.max(0, performance.now() - receivedAt);
  probeCounter('projection-patch-applied', 1, durationMs);
  probeCounter('projection-deleted-target-relocations', relocatedTargets);
  emit('projection-patch-applied', { durationMs, revision, relocatedTargets });
}

/**
 * 투영 패널의 Monaco 에디터 인스턴스를 벤치 하네스가 읽을 수 있도록 노출한다.
 * production 번들은 전역 `monaco`를 두지 않으므로 기존 probe 이중 플래그가 켜진 경우에만 사용한다.
 * @param editorInstance 읽기 전용 투영 에디터
 * @returns 없음
 */
export function probeExposeProjectionEditor(editorInstance: unknown): void {
  if (!enabled) return;
  probeWindow.__ERD_PROJECTION_EDITOR__ = editorInstance;
}
