import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useCanvasStore from '@/stores/useCanvasStore';
import { djb2 } from '@/lib/hash';
import { buildRevisionHash } from '@/lib/code-sync-revision';
import type { SyncStatus } from '@/constants/sync-status';
import {
  CODE_SYNC_IDLE_MS,
  CODE_SYNC_MAX_QUEUE_WAIT_MS,
  ERD_SYNC_IDLE_MS,
} from '@/constants/code-sync';

/** 동기화 origin */
type SyncOrigin = 'user-code' | 'code-auto-sync' | 'erd-auto-sync' | null;

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
  /** 파싱된 테이블 존재 여부 */
  hasParsedTables: boolean;
  /** 원격 편집 락 존재 여부 */
  hasRemoteEditLocks: boolean;
  /** 코드 텍스트 변경 함수 (파싱 트리거 포함) */
  onCodeTextChange: (value: string | undefined) => void;
  /** ERD -> 코드 생성 함수 */
  generateCodeFromErd: () => string;
  /** 코드 -> ERD 반영 함수 */
  applyParsedToErd: () => void;
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
  generateCodeFromErd,
  applyParsedToErd,
  codeIdleMs = CODE_SYNC_IDLE_MS,
  erdIdleMs = ERD_SYNC_IDLE_MS,
  maxQueueWaitMs = CODE_SYNC_MAX_QUEUE_WAIT_MS,
}: UseBidirectionalCodeSyncOptions): UseBidirectionalCodeSyncReturn {
  const nodes = useCanvasStore((s) => s.nodes);
  const groupNodes = useCanvasStore((s) => s.groupNodes);
  const edges = useCanvasStore((s) => s.edges);

  const originRef = useRef<SyncOrigin>(null);
  const lastUserEditAtRef = useRef(0);
  const codeToErdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const erdToCodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockBlockedSinceRef = useRef<number | null>(null);
  const autoApplyBlockedRef = useRef(false);
  const lastAppliedCodeHashRef = useRef<string | null>(null);
  const lastObservedErdRevisionRef = useRef<string | null>(null);
  const pendingErdSyncRevisionRef = useRef<string | null>(null);
  const suppressNextErdSyncRef = useRef(false);
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
          position: { x: node.position.x, y: node.position.y },
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
        groupNodes.map((groupNode) => ({
          id: groupNode.id,
          type: groupNode.type ?? 'group',
          parentId: groupNode.parentId ?? null,
          position: { x: groupNode.position.x, y: groupNode.position.y },
          data: groupNode.data,
        })),
      ),
    [edges, groupNodes, nodes],
  );

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
      if (suppressNextErdSyncRef.current && originRef.current === 'code-auto-sync') {
        suppressNextErdSyncRef.current = false;
        originRef.current = null;
        return;
      }
      if (suppressNextErdSyncRef.current) {
        suppressNextErdSyncRef.current = false;
      }
      pendingErdSyncRevisionRef.current = currentRevisionHash;
    }
  }, [currentRevisionHash]);

  const clearQueueTimeoutHold = useCallback(() => {
    autoApplyBlockedRef.current = false;
    lockBlockedSinceRef.current = null;
    if (syncStatusRef.current === 'hold-queue-timeout') {
      setStatus('idle-wait');
    }
  }, [setStatus]);

  const handleUserCodeChange = useCallback(
    (value: string | undefined) => {
      autoApplyBlockedRef.current = false;
      // Code 편집이 시작되면 직전 ERD->Code 대기열은 취소해 역방향 덮어쓰기를 방지한다.
      clearErdToCodeTimer();
      pendingErdSyncRevisionRef.current = null;
      originRef.current = 'user-code';
      lastUserEditAtRef.current = Date.now();
      parseBaseRevisionHashRef.current = currentRevisionHash;
      setStatus('idle-wait');
      onCodeTextChange(value);
    },
    [clearErdToCodeTimer, currentRevisionHash, onCodeTextChange, setStatus],
  );

  const handleGeneratedCodeChange = useCallback(
    (text: string) => {
      if (text === codeText) {
        return;
      }
      originRef.current = 'erd-auto-sync';
      onCodeTextChange(text);
      setStatus('synced');
    },
    [codeText, onCodeTextChange, setStatus],
  );

  // 코드 -> ERD 자동 반영
  useEffect(() => {
    clearCodeToErdTimer();
    if (!enabled || !ready || !codeText.trim()) {
      setStatus(null);
      return;
    }
    if (autoApplyBlockedRef.current) {
      setStatus('hold-queue-timeout');
      return;
    }

    codeToErdTimerRef.current = setTimeout(() => {
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

      if (Date.now() - lastUserEditAtRef.current < codeIdleMs) {
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

      const codeHash = djb2(codeText);
      if (lastAppliedCodeHashRef.current === codeHash) {
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
        applyParsedToErd();
        lastAppliedCodeHashRef.current = codeHash;
        setStatus('synced');
      } finally {
        inFlightApplyRef.current = false;
        if (originRef.current === 'code-auto-sync') {
          originRef.current = null;
        }
      }
    }, codeIdleMs);

    return clearCodeToErdTimer;
  }, [
    applyParsedToErd,
    clearCodeToErdTimer,
    codeIdleMs,
    codeText,
    currentRevisionHash,
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
      parseBaseRevisionHashRef.current = currentRevisionHash;
    }
    prevParsingRef.current = parsing;
  }, [currentRevisionHash, parsing]);

  // ERD -> 코드 자동 반영 (ERD 스냅샷이 실제로 변경된 경우에만 실행)
  useEffect(() => {
    clearErdToCodeTimer();
    if (!enabled || !ready) {
      return;
    }
    if (!pendingErdSyncRevisionRef.current) {
      return;
    }

    const runErdToCode = () => {
      if (!pendingErdSyncRevisionRef.current) {
        return;
      }

      // Code 편집 흐름이 우선이므로 최소 codeIdle 기간이 지나기 전에는 역방향 동기화를 보류한다.
      const minQuietMs = Math.max(erdIdleMs, codeIdleMs);
      if (Date.now() - lastUserEditAtRef.current < minQuietMs) {
        setStatus('idle-wait');
        erdToCodeTimerRef.current = setTimeout(runErdToCode, erdIdleMs);
        return;
      }

      // 코드 파싱/검증이 불안정한 구간에서는 ERD->Code 역방향 반영으로 사용자 입력을 덮어쓰지 않는다.
      if (parsing || hasBlockingErrors) {
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
        pendingErdSyncRevisionRef.current = null;
        setStatus('synced');
        return;
      }

      originRef.current = 'erd-auto-sync';
      onCodeTextChange(generated);
      pendingErdSyncRevisionRef.current = null;
      setStatus('synced');
    };

    erdToCodeTimerRef.current = setTimeout(runErdToCode, erdIdleMs);

    return clearErdToCodeTimer;
  }, [
    codeIdleMs,
    enabled,
    erdIdleMs,
    generateCodeFromErd,
    hasBlockingErrors,
    onCodeTextChange,
    parsing,
    ready,
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
      suppressNextErdSyncRef.current = false;
      parseBaseRevisionHashRef.current = null;
      syncStatusRef.current = null;
    };
  }, [clearCodeToErdTimer, clearErdToCodeTimer]);

  return {
    handleUserCodeChange,
    handleGeneratedCodeChange,
    clearQueueTimeoutHold,
    syncStatus,
  };
}
