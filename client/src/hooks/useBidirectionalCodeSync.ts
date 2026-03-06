import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCanvasStore from '@/stores/useCanvasStore';
import { djb2 } from '@/lib/hash';
import { buildRevisionHash } from '@/lib/code-sync-revision';
import { resolveCodeAutoApplyStatus } from '@/lib/code-sync-apply-gate';
import { useClearableTimer } from '@/hooks/useClearableTimer';
import type { SyncStatus } from '@/constants/sync-status';
import {
  CODE_SYNC_IDLE_MS,
  CODE_SYNC_MAX_QUEUE_WAIT_MS,
  CODE_SYNC_SUPPRESS_WINDOW_MS,
  ERD_SYNC_IDLE_MS,
} from '@/constants/code-sync';

/** 동기화 origin */
type SyncOrigin = 'user-code' | 'code-auto-sync' | 'erd-auto-sync' | null;

/**
 * Code→ERD apply 후 ERD 변경을 일시 억제하는 상태.
 *
 * 3개 필드를 단일 객체로 관리하여 산탄총 수술을 방지한다.
 * suppress 윈도우(기본 200ms)는 React 렌더 사이클(~16ms/frame)의
 * 다중 프레임 안정화에 충분한 여유를 갖도록 설계되었다.
 */
interface SuppressState {
  /** suppress 윈도우 만료 시점 (ms). 0이면 비활성 */
  until: number;
  /** suppress 원인 */
  reason: 'code-auto-sync' | null;
  /** suppress 윈도우 중 보류된 ERD revision (R2: defer+replay) */
  deferredRevision: string | null;
}

/** suppress 초기 상태 */
const SUPPRESS_IDLE: SuppressState = { until: 0, reason: null, deferredRevision: null };

/** useBidirectionalCodeSync 옵션 */
interface UseBidirectionalCodeSyncOptions {
  /** 자동 동기화 활성 여부 */
  enabled: boolean;
  /** 선행 조건 충족 여부 (사전 로딩 등) */
  ready?: boolean;
  /** 현재 코드 텍스트 */
  codeText: string;
  /** 파싱 진행 여부 */
  parsing: boolean;
  /** 코드 반영을 막는 에러 존재 여부 */
  hasBlockingErrors: boolean;
  /** 코드 반영 가능한 파싱 결과 존재 여부 (빈 스키마 포함) */
  hasParsedTables: boolean;
  /** 원격 편집 락 존재 여부 */
  hasRemoteEditLocks: boolean;
  /** 코드 텍스트 변경 함수 (파싱 트리거 포함) */
  onCodeTextChange: (value: string | undefined) => void;
  /** (선택) 프로그래밍적 코드 업데이트 함수 — 커서 보존. 미제공 시 onCodeTextChange 사용 */
  onSyncCodeTextChange?: (value: string | undefined) => void;
  /** ERD -> 코드 생성 함수 */
  generateCodeFromErd: () => string;
  /** 코드 -> ERD 반영 함수 */
  applyParsedToErd: () => boolean;
  /** 코드 idle 대기 시간 (ms) */
  codeIdleMs?: number;
  /** ERD idle 대기 시간 (ms) */
  erdIdleMs?: number;
  /** 원격 락 대기 최대 시간 (ms) */
  maxQueueWaitMs?: number;
}

/** useBidirectionalCodeSync 반환 타입 */
interface UseBidirectionalCodeSyncReturn {
  /** 사용자가 입력한 코드 변경 핸들러 */
  handleUserCodeChange: (value: string | undefined) => void;
  /** ERD/프로그램 생성 코드 반영 핸들러 */
  handleGeneratedCodeChange: (text: string) => void;
  /** queue timeout 보류 상태를 수동으로 해제한다. */
  clearQueueTimeoutHold: () => void;
  /** 동기화 상태 */
  syncStatus: SyncStatus;
}

/**
 * 코드 <-> ERD 자동 양방향 동기화를 처리한다.
 *
 * - 사용자 코드 입력 idle + parse success 시 코드 -> ERD 자동 반영
 * - ERD 변경 idle 시 ERD -> 코드 자동 생성
 * - origin 플래그로 역방향 루프를 차단
 *
 * @returns 코드/ERD 동기화 핸들러와 상태
 */
export function useBidirectionalCodeSync({
  enabled,
  ready = true,
  codeText,
  parsing,
  hasBlockingErrors,
  hasParsedTables,
  hasRemoteEditLocks,
  onCodeTextChange,
  onSyncCodeTextChange,
  generateCodeFromErd,
  applyParsedToErd,
  codeIdleMs = CODE_SYNC_IDLE_MS,
  erdIdleMs = ERD_SYNC_IDLE_MS,
  maxQueueWaitMs = CODE_SYNC_MAX_QUEUE_WAIT_MS,
}: UseBidirectionalCodeSyncOptions): UseBidirectionalCodeSyncReturn {
  /** 프로그래밍적 업데이트 함수 — 커서 보존 콜백이 있으면 그쪽으로 라우팅 */
  const syncUpdate = onSyncCodeTextChange ?? onCodeTextChange;
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const originRef = useRef<SyncOrigin>(null);
  const lastUserEditAtRef = useRef(0);
  const codeTimer = useClearableTimer();
  const erdTimer = useClearableTimer();
  const lockBlockedSinceRef = useRef<number | null>(null);
  const autoApplyBlockedRef = useRef(false);
  const lastAppliedCodeHashRef = useRef<string | null>(null);
  const lastObservedErdRevisionRef = useRef<string | null>(null);
  const pendingErdSyncRevisionRef = useRef<string | null>(null);
  /** Code→ERD apply 후 ERD 변경 억제 상태 */
  const suppressRef = useRef<SuppressState>({ ...SUPPRESS_IDLE });
  const inFlightApplyRef = useRef(false);
  const parseBaseRevisionHashRef = useRef<string | null>(null);
  const prevParsingRef = useRef(parsing);
  const codeTextRef = useRef(codeText);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(null);
  const syncStatusRef = useRef<SyncStatus>(null);

  const setStatus = useCallback((next: SyncStatus) => {
    if (syncStatusRef.current === next) {
      return;
    }
    syncStatusRef.current = next;
    setSyncStatus(next);
  }, []);

  const currentRevisionHash = useMemo(
    () =>
      buildRevisionHash(
        nodes.map((node) => ({
          id: node.id,
          type: node.type ?? 'table',
          parentId: node.parentId ?? null,
          data: node.data,
        })),
        edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          type: edge.type ?? 'default',
          data: edge.data,
        })),
      ),
    [edges, nodes],
  );

  /** currentRevisionHash ref 미러 — stale closure 방지용 */
  const currentRevisionHashRef = useRef(currentRevisionHash);
  useEffect(() => {
    currentRevisionHashRef.current = currentRevisionHash;
  }, [currentRevisionHash]);

  useEffect(() => {
    codeTextRef.current = codeText;
  }, [codeText]);

  useEffect(() => {
    if (lastObservedErdRevisionRef.current == null) {
      lastObservedErdRevisionRef.current = currentRevisionHash;
      return;
    }
    if (lastObservedErdRevisionRef.current !== currentRevisionHash) {
      lastObservedErdRevisionRef.current = currentRevisionHash;

      const suppress = suppressRef.current;

      // suppress 윈도우 내 — 보류(defer)하되, 관측 해시는 갱신 (R2)
      if (suppress.reason === 'code-auto-sync' && Date.now() < suppress.until) {
        console.debug('[sync] suppressed', { revision: currentRevisionHash });
        suppressRef.current = { ...suppress, deferredRevision: currentRevisionHash };
        return;
      }

      // suppress 윈도우 만료 후 보류 revision이 있었으면 로그만 남긴다 (R2).
      // 최신 currentRevisionHash가 보류 값을 포함하므로 별도 할당은 불필요하다.
      if (suppress.deferredRevision) {
        console.debug('[sync] replayed', {
          deferred: suppress.deferredRevision,
          current: currentRevisionHash,
        });
        suppressRef.current = { ...SUPPRESS_IDLE };
      }

      pendingErdSyncRevisionRef.current = currentRevisionHash;
    }
  }, [currentRevisionHash]);

  const clearQueueTimeoutHold = useCallback(() => {
    autoApplyBlockedRef.current = false;
    lockBlockedSinceRef.current = null;
    if (
      syncStatusRef.current === 'hold-queue-timeout' ||
      syncStatusRef.current === 'hold-manual-confirm'
    ) {
      setStatus('idle-wait');
    }
  }, [setStatus]);

  const handleUserCodeChange = useCallback(
    (value: string | undefined) => {
      autoApplyBlockedRef.current = false;
      // Code 편집이 시작되면 직전 ERD->Code 대기열은 취소해 역방향 덮어쓰기를 방지한다.
      erdTimer.clear();
      pendingErdSyncRevisionRef.current = null;
      // 사용자 입력 재개 시 suppress 즉시 해제
      suppressRef.current = { ...SUPPRESS_IDLE };
      originRef.current = 'user-code';
      lastUserEditAtRef.current = Date.now();
      parseBaseRevisionHashRef.current = currentRevisionHashRef.current;
      setStatus('idle-wait');
      onCodeTextChange(value);
    },
    [erdTimer, onCodeTextChange, setStatus],
  );

  const handleGeneratedCodeChange = useCallback(
    (text: string) => {
      if (text === codeTextRef.current) {
        return;
      }
      originRef.current = 'erd-auto-sync';
      syncUpdate(text);
      setStatus('synced');
    },
    [syncUpdate, setStatus],
  );

  // 코드 -> ERD 자동 반영
  useEffect(() => {
    codeTimer.clear();
    if (!enabled || !ready) {
      setStatus(null);
      return;
    }
    if (autoApplyBlockedRef.current) {
      setStatus('hold-queue-timeout');
      return;
    }

    const isClearRequest = codeText.trim().length === 0;

    /**
     * suppress 윈도우를 설정하고 Code→ERD 반영을 실행한다.
     *
     * @param codeHash 현재 코드 내용의 해시
     * @returns 없음
     */
    const executeAutoApply = (codeHash: string) => {
      inFlightApplyRef.current = true;
      originRef.current = 'code-auto-sync';
      try {
        // code→ERD 직후 다중 렌더 사이클의 ERD 변경을 suppress 윈도우로 보호
        suppressRef.current = {
          until: Date.now() + CODE_SYNC_SUPPRESS_WINDOW_MS,
          reason: 'code-auto-sync',
          deferredRevision: null,
        };
        const applied = applyParsedToErd();
        if (!applied) {
          suppressRef.current = { ...SUPPRESS_IDLE };
          setStatus(resolveCodeAutoApplyStatus(false));
          return;
        }
        lastAppliedCodeHashRef.current = codeHash;
        setStatus(resolveCodeAutoApplyStatus(true));
      } finally {
        inFlightApplyRef.current = false;
        if (originRef.current === 'code-auto-sync') {
          originRef.current = null;
        }
      }
    };

    /**
     * 가드 조건을 평가한 뒤 Code→ERD 자동 반영을 실행한다.
     *
     * @returns 없음
     */
    const tryCodeToErdApply = () => {
      if (originRef.current === 'erd-auto-sync') {
        originRef.current = null;
        return;
      }

      if (parsing || hasBlockingErrors || !hasParsedTables) {
        if (hasBlockingErrors) {
          setStatus('hold-parse-error');
        }
        return;
      }

      if (!isClearRequest && Date.now() - lastUserEditAtRef.current < codeIdleMs) {
        setStatus('idle-wait');
        return;
      }

      if (hasRemoteEditLocks) {
        setStatus('hold-remote-lock');
        if (lockBlockedSinceRef.current == null) {
          lockBlockedSinceRef.current = Date.now();
        }
        if (Date.now() - lockBlockedSinceRef.current > maxQueueWaitMs) {
          autoApplyBlockedRef.current = true;
          lockBlockedSinceRef.current = null;
          setStatus('hold-queue-timeout');
        }
        return;
      }

      lockBlockedSinceRef.current = null;

      const baseRevisionHash = parseBaseRevisionHashRef.current;
      if (baseRevisionHash && baseRevisionHash !== currentRevisionHashRef.current) {
        console.debug('[sync] stale', {
          baseRevisionHash,
          current: currentRevisionHashRef.current,
        });
        setStatus('dropped-stale');
        return;
      }

      const codeHash = djb2(codeText);
      if (lastAppliedCodeHashRef.current === codeHash) {
        return;
      }

      if (inFlightApplyRef.current) {
        return;
      }

      executeAutoApply(codeHash);
    };

    codeTimer.set(tryCodeToErdApply, isClearRequest ? 0 : codeIdleMs);
    return codeTimer.clear;
    // currentRevisionHash는 ref 미러로 읽으므로 deps에서 제거 — 타이머 리셋 방지
  }, [
    applyParsedToErd,
    codeTimer,
    codeIdleMs,
    codeText,
    enabled,
    hasBlockingErrors,
    hasParsedTables,
    hasRemoteEditLocks,
    maxQueueWaitMs,
    parsing,
    ready,
    setStatus,
  ]);

  // parsing 시작 시점의 ERD 해시를 고정한다. (stale auto-apply 방지)
  useEffect(() => {
    if (parsing && !prevParsingRef.current) {
      parseBaseRevisionHashRef.current = currentRevisionHashRef.current;
    }
    prevParsingRef.current = parsing;
  }, [parsing]);

  // ERD -> 코드 자동 반영 (ERD 스냅샷이 실제로 변경된 경우에만 실행)
  useEffect(() => {
    erdTimer.clear();
    if (!enabled || !ready) {
      return;
    }
    if (!pendingErdSyncRevisionRef.current) {
      return;
    }

    /**
     * 대기 중인 ERD 변경을 코드 에디터에 반영한다.
     *
     * @returns 없음
     */
    const runErdToCode = () => {
      if (!pendingErdSyncRevisionRef.current) {
        return;
      }

      // Code 편집 흐름이 우선이므로 최소 codeIdle 기간이 지나기 전에는 역방향 동기화를 보류한다.
      const minQuietMs = Math.max(erdIdleMs, codeIdleMs);
      if (Date.now() - lastUserEditAtRef.current < minQuietMs) {
        setStatus('idle-wait');
        erdTimer.set(runErdToCode, erdIdleMs);
        return;
      }

      // 코드 파싱/검증이 불안정한 구간에서는 ERD->Code 역방향 반영으로 사용자 입력을 덮어쓰지 않는다.
      if (parsing || hasBlockingErrors) {
        if (hasBlockingErrors) {
          setStatus('hold-parse-error');
        } else {
          setStatus('idle-wait');
        }
        erdTimer.set(runErdToCode, erdIdleMs);
        return;
      }

      const generated = generateCodeFromErd();
      if (djb2(generated) === djb2(codeTextRef.current)) {
        pendingErdSyncRevisionRef.current = null;
        setStatus('synced');
        return;
      }

      originRef.current = 'erd-auto-sync';
      syncUpdate(generated);
      pendingErdSyncRevisionRef.current = null;
      setStatus('synced');
    };

    erdTimer.set(runErdToCode, erdIdleMs);

    return erdTimer.clear;
    // currentRevisionHash를 deps에 포함하여 ERD 변경 시 타이머를 재시작한다.
    // Code→ERD 쪽(L339)은 ref 미러로 읽으므로 deps에서 제외 — 역할이 비대칭이다.
  }, [
    codeIdleMs,
    enabled,
    erdIdleMs,
    erdTimer,
    generateCodeFromErd,
    hasBlockingErrors,
    syncUpdate,
    parsing,
    ready,
    setStatus,
    currentRevisionHash,
  ]);

  useEffect(() => {
    return () => {
      codeTimer.clear();
      erdTimer.clear();
      lockBlockedSinceRef.current = null;
      autoApplyBlockedRef.current = false;
      pendingErdSyncRevisionRef.current = null;
      suppressRef.current = { ...SUPPRESS_IDLE };
      parseBaseRevisionHashRef.current = null;
      syncStatusRef.current = null;
    };
  }, [codeTimer, erdTimer]);

  return {
    handleUserCodeChange,
    handleGeneratedCodeChange,
    clearQueueTimeoutHold,
    syncStatus,
  };
}
