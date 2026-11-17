/** 블록별 순수 커밋 상태. DOM·타이머·문서 쓰기는 effects 실행자가 담당한다. */
export type BlockCommitStatus =
  | 'CLEAN'
  | 'DIRTY'
  | 'VALID'
  | 'INVALID'
  | 'UNSUPPORTED'
  | 'COMMITTING'
  | 'CONFLICT'
  | 'BLOCKED';
/** 외부 실행자가 블록별로 교체·취소하는 타이머 이름. */
export type BlockCommitTimer = 'parse' | 'idle' | 'max-wait' | 'min-interval';
/** 시간 정책은 밀리초 단위이며 실제 시계는 호출자가 주입한다. */
export const BLOCK_COMMIT_TIMING = {
  parse: 150,
  idle: 800,
  minInterval: 500,
  maxWait: 5000,
} as const;
/** 텍스트 버전으로 오래된 파싱·커밋 응답을 구분한다. */
export interface BlockCommitState {
  status: BlockCommitStatus;
  text: string;
  version: number;
  ready: boolean;
  composing: boolean;
  pendingLeave: boolean;
  dirtySince?: number;
  lastInputAt?: number;
  lastCommittedAt?: number;
  inFlightVersion?: number;
  blockedReason?: string;
}
/** 효과의 타이머 version은 콜백에 그대로 전달한다. max-wait는 최초 dirty 기준이다. */
export type BlockCommitEffect =
  | { type: 'schedule'; timer: BlockCommitTimer; delayMs: number; version: number }
  | { type: 'cancel-timers' }
  | { type: 'parse'; text: string; version: number }
  | { type: 'commit'; text: string; version: number }
  | { type: 'persist-draft'; text: string; version: number };
/** 모든 입력은 시간과 버전을 데이터로 전달하여 재현 가능하게 한다. */
export type BlockCommitEvent =
  | { type: 'edit'; text: string; now: number }
  | { type: 'parsed'; version: number; result: 'VALID' | 'INVALID' | 'UNSUPPORTED'; now: number }
  | { type: 'timer'; timer: BlockCommitTimer; version?: number; now: number }
  | {
      type:
        | 'leave'
        | 'blur'
        | 'pagehide'
        | 'composition-start'
        | 'composition-end'
        | 'conflict'
        | 'entity-removed';
      now: number;
    }
  | { type: 'readiness'; ready: boolean; now: number }
  | { type: 'commit-success'; version: number; now: number }
  | {
      type: 'commit-rejected';
      version: number;
      reason: 'conflict' | 'not-ready' | 'invalid' | 'unsupported';
      now: number;
    };
/** 다음 상태와 실행할 부작용 요청. 입력 상태는 변경하지 않는다. */
export interface BlockCommitTransition {
  state: BlockCommitState;
  effects: BlockCommitEffect[];
}

/** 준비된 깨끗한 블록의 초기 상태를 만든다. */
export function createBlockCommitState(text = '', ready = true): BlockCommitState {
  return {
    status: ready ? 'CLEAN' : 'BLOCKED',
    text,
    version: 0,
    ready,
    composing: false,
    pendingLeave: false,
  };
}
/** 외부 시계 대신 주입한 시각으로 커밋 가능 여부와 최소 간격을 확인한다. */
function requestCommit(state: BlockCommitState, now: number, effects: BlockCommitEffect[]): void {
  if (
    !state.ready ||
    state.composing ||
    state.status !== 'VALID' ||
    state.inFlightVersion !== undefined
  )
    return;
  const delay =
    state.lastCommittedAt === undefined
      ? 0
      : state.lastCommittedAt + BLOCK_COMMIT_TIMING.minInterval - now;
  if (delay > 0) {
    effects.push({
      type: 'schedule',
      timer: 'min-interval',
      delayMs: delay,
      version: state.version,
    });
    return;
  }
  state.status = 'COMMITTING';
  state.inFlightVersion = state.version;
  state.pendingLeave = false;
  effects.push(
    { type: 'cancel-timers' },
    { type: 'commit', text: state.text, version: state.version },
  );
}
/** 현재 편집 세대의 파싱·idle·최대 대기 타이머를 다시 요청한다. */
function schedule(state: BlockCommitState, now: number, effects: BlockCommitEffect[]): void {
  if (!state.ready || state.blockedReason === 'entity-removed') return;
  effects.push(
    {
      type: 'schedule',
      timer: 'parse',
      delayMs: BLOCK_COMMIT_TIMING.parse,
      version: state.version,
    },
    {
      type: 'schedule',
      timer: 'idle',
      delayMs: Math.max(0, (state.lastInputAt ?? now) + BLOCK_COMMIT_TIMING.idle - now),
      version: state.version,
    },
    {
      type: 'schedule',
      timer: 'max-wait',
      delayMs: Math.max(0, (state.dirtySince ?? now) + BLOCK_COMMIT_TIMING.maxWait - now),
      version: state.version,
    },
  );
}
/**
 * 텍스트·검증·준비 상태를 순수하게 전이한다. IME 중 커밋은 없고 이탈 요청은 보존한다.
 * 커밋 이후 추가 입력은 오래된 성공 응답으로 CLEAN이 되지 않는다.
 */
export function reduceBlockCommit(
  previous: BlockCommitState,
  event: BlockCommitEvent,
): BlockCommitTransition {
  const state = { ...previous };
  const effects: BlockCommitEffect[] = [];
  switch (event.type) {
    case 'edit':
      if (event.text === state.text) break;
      state.text = event.text;
      state.version++;
      state.lastInputAt = event.now;
      state.dirtySince ??= event.now;
      state.status = state.ready && state.blockedReason !== 'entity-removed' ? 'DIRTY' : 'BLOCKED';
      schedule(state, event.now, effects);
      break;
    case 'parsed':
      if (
        event.version !== state.version ||
        state.dirtySince === undefined ||
        !state.ready ||
        state.status === 'COMMITTING' ||
        state.status === 'CONFLICT' ||
        state.blockedReason === 'entity-removed'
      )
        break;
      state.status = event.result;
      if (
        state.pendingLeave ||
        event.now - (state.dirtySince ?? event.now) >= BLOCK_COMMIT_TIMING.maxWait ||
        event.now - (state.lastInputAt ?? event.now) >= BLOCK_COMMIT_TIMING.idle
      )
        requestCommit(state, event.now, effects);
      break;
    case 'timer':
      if (event.version !== undefined && event.version !== state.version) break;
      if (!state.ready || state.dirtySince === undefined) break;
      if (event.timer === 'parse')
        effects.push({ type: 'parse', text: state.text, version: state.version });
      else if (
        event.timer === 'max-wait' &&
        event.now - state.dirtySince >= BLOCK_COMMIT_TIMING.maxWait &&
        state.status === 'DIRTY' &&
        !state.composing
      )
        effects.push({ type: 'parse', text: state.text, version: state.version });
      else if (
        (event.timer === 'idle' &&
          event.now - (state.lastInputAt ?? event.now) >= BLOCK_COMMIT_TIMING.idle) ||
        (event.timer === 'max-wait' &&
          event.now - state.dirtySince >= BLOCK_COMMIT_TIMING.maxWait) ||
        event.timer === 'min-interval'
      )
        requestCommit(state, event.now, effects);
      break;
    case 'leave':
    case 'blur':
    case 'pagehide':
      if (event.type === 'pagehide' && state.dirtySince !== undefined)
        effects.push({ type: 'persist-draft', text: state.text, version: state.version });
      if (state.dirtySince === undefined) break;
      state.pendingLeave = true;
      if (state.status === 'DIRTY' && !state.composing && state.ready)
        effects.push({ type: 'parse', text: state.text, version: state.version });
      requestCommit(state, event.now, effects);
      break;
    case 'composition-start':
      state.composing = true;
      break;
    case 'composition-end':
      state.composing = false;
      if (state.dirtySince !== undefined && state.ready) {
        state.status = 'DIRTY';
        if (state.pendingLeave)
          effects.push({ type: 'parse', text: state.text, version: state.version });
        else schedule(state, event.now, effects);
      }
      break;
    case 'readiness':
      state.ready = event.ready && state.blockedReason !== 'entity-removed';
      if (!event.ready) {
        state.status = 'BLOCKED';
        if (state.blockedReason !== 'entity-removed') state.blockedReason = 'not-ready';
        effects.push({ type: 'cancel-timers' });
        if (state.dirtySince !== undefined)
          effects.push({ type: 'persist-draft', text: state.text, version: state.version });
      } else if (state.blockedReason !== 'entity-removed') {
        if (!previous.ready) state.version++;
        state.blockedReason = undefined;
        state.status = state.dirtySince === undefined ? 'CLEAN' : 'DIRTY';
        if (state.status === 'DIRTY') schedule(state, event.now, effects);
      }
      break;
    case 'conflict':
    case 'entity-removed':
      state.status = event.type === 'conflict' ? 'CONFLICT' : 'BLOCKED';
      state.blockedReason = event.type;
      if (event.type === 'entity-removed') state.ready = false;
      effects.push(
        { type: 'cancel-timers' },
        { type: 'persist-draft', text: state.text, version: state.version },
      );
      break;
    case 'commit-success':
      if (event.version !== state.inFlightVersion) break;
      state.inFlightVersion = undefined;
      state.lastCommittedAt = event.now;
      if (event.version === state.version) {
        state.status = state.ready ? 'CLEAN' : 'BLOCKED';
        state.dirtySince = undefined;
        state.pendingLeave = false;
        effects.push({ type: 'cancel-timers' });
      } else if (state.ready) {
        state.status = 'DIRTY';
        schedule(state, event.now, effects);
      }
      break;
    case 'commit-rejected':
      if (event.version !== state.inFlightVersion) break;
      state.inFlightVersion = undefined;
      state.status =
        event.reason === 'conflict'
          ? 'CONFLICT'
          : event.reason === 'not-ready'
            ? 'BLOCKED'
            : event.reason === 'invalid'
              ? 'INVALID'
              : 'UNSUPPORTED';
      if (event.reason === 'not-ready') state.ready = false;
      effects.push(
        { type: 'cancel-timers' },
        { type: 'persist-draft', text: state.text, version: state.version },
      );
      break;
  }
  return { state, effects };
}
