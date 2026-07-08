import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DraftParseStatus,
  DraftReconcileState,
  DraftState,
} from '@/collaboration/core/draft/draft-state';
import { djb2 } from '@/lib/hash';
import { resolveCodeAutoApplyStatus } from '@/lib/code-sync-apply-gate';
import type { SyncStatus } from '@/constants/sync-status';
import {
  CODE_AUTO_APPLY_IDLE_MS,
  CODE_SYNC_IDLE_MS,
  CODE_SYNC_MAX_QUEUE_WAIT_MS,
  ERD_SYNC_IDLE_MS,
} from '@/constants/code-sync';

/** 동기화 origin */
type SyncOrigin = 'user-code' | 'code-auto-sync' | 'erd-auto-sync' | null;

/** useBidirectionalCodeSync 옵션 */
interface UseBidirectionalCodeSyncOptions {
  /** 코드 -> ERD 자동 동기화 활성 여부 */
  enableCodeToErdSync: boolean;
  /** 코드 -> ERD 자동 동기화를 정책상 차단해야 하는지 여부 */
  blockCodeToErdAutoSync?: boolean;
  /** ERD -> 코드 자동 동기화 활성 여부 */
  enableErdToCodeSync: boolean;
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
  /** 현재 authoritative ERD revision hash */
  currentErdRevisionHash: string;
  /** 코드 -> ERD 반영 함수 */
  applyParsedToErd: () => Promise<boolean>;
  /** 현재 파싱 결과의 구조 해시 */
  parsedSchemaHash: string | null;
  /** 코드 idle 대기 시간 (ms) */
  codeIdleMs?: number;
  /** 코드 -> ERD 자동반영 idle 대기 시간 (ms) */
  autoApplyIdleMs?: number;
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
  /** draft reconcile 상태 */
  draftState: DraftState;
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
  enableCodeToErdSync,
  blockCodeToErdAutoSync = false,
  enableErdToCodeSync,
  ready = true,
  codeText,
  parsing,
  hasBlockingErrors,
  hasParsedTables,
  hasRemoteEditLocks,
  onCodeTextChange,
  onSyncCodeTextChange,
  generateCodeFromErd,
  currentErdRevisionHash,
  applyParsedToErd,
  parsedSchemaHash,
  codeIdleMs = CODE_SYNC_IDLE_MS,
  autoApplyIdleMs = CODE_AUTO_APPLY_IDLE_MS,
  erdIdleMs = ERD_SYNC_IDLE_MS,
  maxQueueWaitMs = CODE_SYNC_MAX_QUEUE_WAIT_MS,
}: UseBidirectionalCodeSyncOptions): UseBidirectionalCodeSyncReturn {
  /** 프로그래밍적 업데이트 함수 — 커서 보존 콜백이 있으면 그쪽으로 라우팅 */
  const syncUpdate = onSyncCodeTextChange ?? onCodeTextChange;
  /**
   * authoritative ERD revision 관찰은 auto-sync 준비 여부와 분리한다.
   *
   * code-first / dictionary loading 중에도 원격 authoritative 변경은 draft state에
   * 반영되어야 하므로, ready=false여도 revision tracking 자체는 계속 켠다.
   */
  const draftTrackingEnabled = true;
  const syncExecutionReady = ready;

  const originRef = useRef<SyncOrigin>(null);
  const lastUserEditAtRef = useRef(0);
  /** 사용자가 코드 편집 중인 "활성 세션" 여부 — Code→ERD 자동적용 완료까지 유지 */
  const userEditingSessionRef = useRef(false);
  const codeToErdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const erdToCodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockBlockedSinceRef = useRef<number | null>(null);
  const autoApplyBlockedRef = useRef(false);
  const lastAppliedSchemaHashRef = useRef<string | null>(null);
  const lastObservedErdRevisionRef = useRef<string | null>(null);
  const pendingErdSyncRevisionRef = useRef<string | null>(null);
  const suppressNextErdSyncRef = useRef(false);
  /**
   * 초기 sync의 리비전 변경을 흡수할 수 있는 상태인지 여부.
   *
   * 마운트 직후 첫 리비전 변경은 WebSocket 초기 sync에서 발생하며,
   * 사용자 편집이 아직 없는 상태이므로 remote-pending으로 처리하지 않는다.
   * 사용자가 코드 편집을 시작하면 false로 전환되어 이후 remote 리비전 변경은
   * 정상적으로 pending으로 표시된다.
   */
  const canAbsorbInitialSyncRef = useRef(true);
  const inFlightApplyRef = useRef(false);
  const parseBaseRevisionHashRef = useRef<string | null>(null);
  const prevParsingRef = useRef(parsing);
  const codeTextRef = useRef(codeText);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(null);
  const [lastAcceptedRevision, setLastAcceptedRevision] = useState<string | undefined>(
    () => currentErdRevisionHash || undefined,
  );
  const [pendingRemoteRevision, setPendingRemoteRevision] = useState<string | undefined>(undefined);
  const syncStatusRef = useRef<SyncStatus>(null);

  const setStatus = useCallback((next: SyncStatus) => {
    if (syncStatusRef.current === next) {
      return;
    }
    syncStatusRef.current = next;
    setSyncStatus(next);
  }, []);

  const currentRevisionHash = currentErdRevisionHash;

  const clearCodeToErdTimer = useCallback(() => {
    if (codeToErdTimerRef.current) {
      clearTimeout(codeToErdTimerRef.current);
      codeToErdTimerRef.current = null;
    }
  }, []);

  const clearErdToCodeTimer = useCallback(() => {
    if (erdToCodeTimerRef.current) {
      clearTimeout(erdToCodeTimerRef.current);
      erdToCodeTimerRef.current = null;
    }
  }, []);

  const acceptCurrentRevision = useCallback(
    (nextStatus: SyncStatus) => {
      pendingErdSyncRevisionRef.current = null;
      lastObservedErdRevisionRef.current = currentRevisionHash;
      setPendingRemoteRevision(undefined);
      setLastAcceptedRevision(currentRevisionHash || undefined);
      setStatus(nextStatus);
    },
    [currentRevisionHash, setStatus],
  );

  useEffect(() => {
    codeTextRef.current = codeText;
  }, [codeText]);

  useEffect(() => {
    if (!draftTrackingEnabled) {
      lastObservedErdRevisionRef.current = null;
      pendingErdSyncRevisionRef.current = null;
      setPendingRemoteRevision(undefined);
      setLastAcceptedRevision(currentRevisionHash || undefined);
      setStatus(null);
      return;
    }
    if (lastObservedErdRevisionRef.current == null) {
      lastObservedErdRevisionRef.current = currentRevisionHash;
      setLastAcceptedRevision((prev) => prev ?? currentRevisionHash);
      return;
    }
    if (lastObservedErdRevisionRef.current !== currentRevisionHash) {
      lastObservedErdRevisionRef.current = currentRevisionHash;
      if (suppressNextErdSyncRef.current && originRef.current === 'code-auto-sync') {
        suppressNextErdSyncRef.current = false;
        originRef.current = null;
        acceptCurrentRevision('synced');
        return;
      }
      if (suppressNextErdSyncRef.current) {
        suppressNextErdSyncRef.current = false;
      }
      // 사용자 코드 편집이 시작되기 전의 리비전 변경은 초기 sync 또는
      // 아직 편집하지 않은 상태의 원격 변경이므로 remote-pending으로 처리하지 않고
      // 현재 리비전을 조용히 수락한다. ERD→코드 자동 동기화가 활성이면 코드가 자동 갱신된다.
      if (canAbsorbInitialSyncRef.current) {
        acceptCurrentRevision(null);
        return;
      }
      pendingErdSyncRevisionRef.current = currentRevisionHash;
      setPendingRemoteRevision(currentRevisionHash);
    }
  }, [
    acceptCurrentRevision,
    currentRevisionHash,
    draftTrackingEnabled,
    syncExecutionReady,
    setStatus,
  ]);

  const clearQueueTimeoutHold = useCallback(() => {
    autoApplyBlockedRef.current = false;
    lockBlockedSinceRef.current = null;
    if (!draftTrackingEnabled) {
      setStatus(null);
      return;
    }
    if (
      syncStatusRef.current === 'hold-queue-timeout' ||
      syncStatusRef.current === 'hold-manual-confirm'
    ) {
      setStatus('idle-wait');
    }
  }, [draftTrackingEnabled, setStatus]);

  const handleUserCodeChange = useCallback(
    (value: string | undefined) => {
      codeTextRef.current = value ?? '';
      if (!draftTrackingEnabled) {
        autoApplyBlockedRef.current = false;
        clearErdToCodeTimer();
        pendingErdSyncRevisionRef.current = null;
        setPendingRemoteRevision(undefined);
        originRef.current = null;
        parseBaseRevisionHashRef.current = null;
        setStatus(null);
        onCodeTextChange(value);
        return;
      }
      autoApplyBlockedRef.current = false;
      canAbsorbInitialSyncRef.current = false;
      // Code 편집이 시작되면 직전 ERD->Code 대기열은 취소해 역방향 덮어쓰기를 방지한다.
      clearErdToCodeTimer();
      pendingErdSyncRevisionRef.current = null;
      originRef.current = 'user-code';
      userEditingSessionRef.current = true;
      lastUserEditAtRef.current = Date.now();
      parseBaseRevisionHashRef.current = currentRevisionHash;
      setStatus('idle-wait');
      onCodeTextChange(value);
    },
    [clearErdToCodeTimer, currentRevisionHash, draftTrackingEnabled, onCodeTextChange, setStatus],
  );

  const handleGeneratedCodeChange = useCallback(
    (text: string) => {
      if (text === codeText) {
        return;
      }
      codeTextRef.current = text;
      if (enableErdToCodeSync) {
        originRef.current = 'erd-auto-sync';
      } else {
        originRef.current = null;
      }
      syncUpdate(text);
      if (draftTrackingEnabled) {
        acceptCurrentRevision(enableErdToCodeSync ? 'synced' : null);
        return;
      }
      setStatus(null);
    },
    [
      acceptCurrentRevision,
      codeText,
      draftTrackingEnabled,
      enableErdToCodeSync,
      syncUpdate,
      setStatus,
    ],
  );

  const shouldBlockCodeToErdAutoSync = blockCodeToErdAutoSync || pendingRemoteRevision != null;

  // 코드 -> ERD 자동 반영
  useEffect(() => {
    clearCodeToErdTimer();
    if (!syncExecutionReady) {
      setStatus(null);
      return;
    }
    if (!enableCodeToErdSync || shouldBlockCodeToErdAutoSync) {
      if (pendingRemoteRevision) {
        setStatus('hold-manual-confirm');
      }
      return;
    }
    if (autoApplyBlockedRef.current) {
      setStatus('hold-queue-timeout');
      return;
    }

    const isClearRequest = codeText.trim().length === 0;

    codeToErdTimerRef.current = setTimeout(
      async () => {
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

        if (!isClearRequest && Date.now() - lastUserEditAtRef.current < autoApplyIdleMs) {
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
        if (baseRevisionHash && baseRevisionHash !== currentRevisionHash) {
          setStatus('dropped-stale');
          return;
        }

        if (parsedSchemaHash && lastAppliedSchemaHashRef.current === parsedSchemaHash) {
          return;
        }

        if (inFlightApplyRef.current) {
          return;
        }

        inFlightApplyRef.current = true;
        originRef.current = 'code-auto-sync';
        try {
          // code->ERD 직후 발생하는 1회의 ERD 리비전 변경은 역방향 코드 생성에서 제외한다.
          suppressNextErdSyncRef.current = true;
          const applied = await applyParsedToErd();
          if (!applied) {
            suppressNextErdSyncRef.current = false;
            setStatus(resolveCodeAutoApplyStatus(false));
            return;
          }
          lastAppliedSchemaHashRef.current = parsedSchemaHash;
          userEditingSessionRef.current = false;
          setStatus(resolveCodeAutoApplyStatus(true));
        } finally {
          inFlightApplyRef.current = false;
          if (originRef.current === 'code-auto-sync') {
            originRef.current = null;
          }
        }
      },
      isClearRequest ? 0 : autoApplyIdleMs,
    );

    return clearCodeToErdTimer;
  }, [
    applyParsedToErd,
    clearCodeToErdTimer,
    codeIdleMs,
    codeText,
    currentRevisionHash,
    enableCodeToErdSync,
    shouldBlockCodeToErdAutoSync,
    hasBlockingErrors,
    hasParsedTables,
    hasRemoteEditLocks,
    autoApplyIdleMs,
    maxQueueWaitMs,
    parsing,
    pendingRemoteRevision,
    parsedSchemaHash,
    syncExecutionReady,
    setStatus,
  ]);

  // parsing 시작 시점의 ERD 해시를 고정한다. (stale auto-apply 방지)
  useEffect(() => {
    if (parsing && !prevParsingRef.current) {
      parseBaseRevisionHashRef.current = currentRevisionHash;
    }
    prevParsingRef.current = parsing;
  }, [currentRevisionHash, parsing]);

  // ERD -> 코드 자동 반영 (ERD 스냅샷이 실제로 변경된 경우에만 실행)
  useEffect(() => {
    clearErdToCodeTimer();
    if (!enableErdToCodeSync || !syncExecutionReady) {
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

      // Code 편집 흐름이 우선이므로 활성 편집 세션이거나 최소 codeIdle 기간 내에는 역방향 동기화를 보류한다.
      const minQuietMs = Math.max(erdIdleMs, codeIdleMs);
      const elapsedSinceEdit = Date.now() - lastUserEditAtRef.current;
      const hasRecentUserCodeEdit = elapsedSinceEdit < minQuietMs;

      // 자동적용이 일어나지 않아 세션이 풀리지 못한 경우, autoApplyIdleMs 이상 유휴하면 세션을 자동 해제한다.
      if (userEditingSessionRef.current && elapsedSinceEdit >= autoApplyIdleMs) {
        userEditingSessionRef.current = false;
      }

      if (userEditingSessionRef.current || hasRecentUserCodeEdit) {
        setStatus('idle-wait');
        erdToCodeTimerRef.current = setTimeout(runErdToCode, erdIdleMs);
        return;
      }

      // 사용자 코드 편집 흐름이 살아있는 동안에만 parse/error 상태를 보호 조건으로 사용한다.
      const shouldProtectUserCode = originRef.current === 'user-code';
      if (shouldProtectUserCode && (parsing || hasBlockingErrors)) {
        if (hasBlockingErrors) {
          setStatus('hold-parse-error');
        } else {
          setStatus('idle-wait');
        }
        erdToCodeTimerRef.current = setTimeout(runErdToCode, erdIdleMs);
        return;
      }

      const generated = generateCodeFromErd();
      if (djb2(generated) === djb2(codeTextRef.current)) {
        const acceptedRevision = pendingErdSyncRevisionRef.current ?? currentRevisionHash;
        pendingErdSyncRevisionRef.current = null;
        setPendingRemoteRevision(undefined);
        setLastAcceptedRevision(acceptedRevision);
        setStatus('synced');
        return;
      }

      originRef.current = 'erd-auto-sync';
      codeTextRef.current = generated;
      syncUpdate(generated);
      const acceptedRevision = pendingErdSyncRevisionRef.current ?? currentRevisionHash;
      pendingErdSyncRevisionRef.current = null;
      setPendingRemoteRevision(undefined);
      setLastAcceptedRevision(acceptedRevision);
      setStatus('synced');
    };

    erdToCodeTimerRef.current = setTimeout(runErdToCode, erdIdleMs);

    return clearErdToCodeTimer;
  }, [
    autoApplyIdleMs,
    codeIdleMs,
    enableErdToCodeSync,
    erdIdleMs,
    generateCodeFromErd,
    hasBlockingErrors,
    syncUpdate,
    parsing,
    syncExecutionReady,
    setStatus,
    currentRevisionHash,
    clearErdToCodeTimer,
  ]);

  useEffect(() => {
    return () => {
      clearCodeToErdTimer();
      clearErdToCodeTimer();
      lockBlockedSinceRef.current = null;
      autoApplyBlockedRef.current = false;
      pendingErdSyncRevisionRef.current = null;
      setPendingRemoteRevision(undefined);
      suppressNextErdSyncRef.current = false;
      parseBaseRevisionHashRef.current = null;
      userEditingSessionRef.current = false;
      syncStatusRef.current = null;
      canAbsorbInitialSyncRef.current = true;
    };
  }, [clearCodeToErdTimer, clearErdToCodeTimer]);

  const draftState = useMemo<DraftState>(() => {
    const parseStatus: DraftParseStatus = parsing
      ? 'parsing'
      : hasBlockingErrors
        ? 'invalid'
        : hasParsedTables
          ? 'valid'
          : 'idle';

    let reconcileState: DraftReconcileState = 'clean';
    if (pendingRemoteRevision) {
      reconcileState = 'remote-pending';
    } else if (syncStatus === 'hold-parse-error') {
      reconcileState = 'dirty-invalid';
    } else if (
      syncStatus === 'idle-wait' ||
      syncStatus === 'hold-remote-lock' ||
      syncStatus === 'hold-queue-timeout' ||
      syncStatus === 'hold-manual-confirm' ||
      syncStatus === 'dropped-stale'
    ) {
      reconcileState = parseStatus === 'invalid' ? 'dirty-invalid' : 'dirty-valid';
    }

    return {
      draftId: parsedSchemaHash ?? currentRevisionHash,
      dirty: reconcileState !== 'clean',
      parseStatus,
      lastAcceptedRevision,
      pendingRemoteRevision,
      reconcileState,
    };
  }, [
    currentRevisionHash,
    hasBlockingErrors,
    hasParsedTables,
    lastAcceptedRevision,
    parsedSchemaHash,
    parsing,
    pendingRemoteRevision,
    syncStatus,
  ]);

  return {
    handleUserCodeChange,
    handleGeneratedCodeChange,
    clearQueueTimeoutHold,
    syncStatus,
    draftState,
  };
}
