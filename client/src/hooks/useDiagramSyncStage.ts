import { useCallback, useEffect, useRef, useState } from 'react';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import { isSnapshotRevisionValid } from '@/collaboration/snapshotRevisionGuard';
import { getEdgesMap, getTablesMap, migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import type { DiagramDetail, HandoffMode, SyncStage } from '@/types/diagram';

/** 초기 sync 타임아웃 (ms) */
const SYNC_TIMEOUT_MS = 2_000;
/** 최대 재시도 횟수 */
const MAX_RETRIES = 3;
/** 기본 재시도 간격 (ms) */
const BASE_RETRY_DELAY_MS = 1_000;
/** 재시도 간격 배수 */
const RETRY_MULTIPLIER = 2;
/** jitter 비율 (±20%) */
const JITTER_RATIO = 0.2;

/**
 * useDiagramSyncStage 훅의 입력 파라미터.
 */
interface UseDiagramSyncStageInput {
  /** API 응답 다이어그램 상세 */
  diagram: DiagramDetail | undefined;
  /** API 쿼리 로딩 여부 */
  isLoading: boolean;
  /** preview JSON 파싱 성공 여부 */
  previewParseSuccess: boolean;
  /** preview graph에 표시 가능한 노드/엣지 존재 여부 */
  previewHasRenderableGraph: boolean;
  /** YjsProvider 참조 */
  providerRef: React.RefObject<YjsProvider | null>;
  /** feature flag 활성화 여부 */
  featureEnabled: boolean;
}

/**
 * useDiagramSyncStage 훅의 반환 타입.
 */
interface UseDiagramSyncStageReturn {
  /** 현재 동기화 단계 */
  syncStage: SyncStage;
  /** Yjs handoff 모드 */
  handoffMode: HandoffMode;
  /** 현재 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 수동 재시도 함수 */
  manualRetry: () => void;
}

/**
 * jitter가 포함된 재시도 딜레이를 계산한다.
 *
 * @param attempt 현재 시도 횟수 (0-based)
 * @returns 딜레이 (ms)
 */
function getRetryDelay(attempt: number): number {
  const base = BASE_RETRY_DELAY_MS * Math.pow(RETRY_MULTIPLIER, attempt);
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

/**
 * 다이어그램 동기화 단계를 관리하는 상태머신 훅.
 *
 * API 응답 → preview 렌더 → WS handoff → yjs-live 전환까지의 전체 흐름을 제어한다.
 *
 * @param input 상태머신 입력 파라미터
 * @returns 동기화 상태 및 제어 함수
 */
export function useDiagramSyncStage(input: UseDiagramSyncStageInput): UseDiagramSyncStageReturn {
  const {
    diagram,
    isLoading,
    previewParseSuccess,
    previewHasRenderableGraph,
    providerRef,
    featureEnabled,
  } = input;

  /** 현재 동기화 단계 */
  const [syncStage, setSyncStage] = useState<SyncStage>('boot');
  /** Yjs handoff 모드 */
  const [handoffMode, setHandoffMode] = useState<HandoffMode>('snapshot');
  /** 현재 재시도 횟수 */
  const [retryCount, setRetryCount] = useState(0);

  /** 타임아웃 타이머 ref */
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 재시도 타이머 ref */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 현재 stage ref (콜백 내에서 최신값 참조) */
  const stageRef = useRef<SyncStage>('boot');
  /** 현재 handoff 모드 ref (콜백 내에서 최신값 참조) */
  const handoffModeRef = useRef<HandoffMode>('snapshot');

  // stageRef를 항상 syncStage와 동기화
  stageRef.current = syncStage;
  // handoffModeRef를 항상 handoffMode와 동기화
  handoffModeRef.current = handoffMode;

  /**
   * 타이머를 모두 정리한다.
   */
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  /**
   * yjs-live로 전환한다.
   */
  const transitionToLive = useCallback(() => {
    clearTimers();
    setSyncStage('yjs-live');
  }, [clearTimers]);

  /**
   * 자동 재시도를 예약한다.
   */
  const scheduleRetry = useCallback(
    (currentRetry: number) => {
      if (currentRetry >= MAX_RETRIES) {
        setSyncStage('yjs-failed-readonly');
        return;
      }

      const delay = getRetryDelay(currentRetry);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const provider = providerRef.current;
        if (!provider) {
          return;
        }

        // snapshot 모드: snapshot을 재요청한다.
        // sync-only 모드: provider의 자동 재연결 + SYNC_STEP2 완료를 대기한다.
        if (handoffModeRef.current === 'snapshot') {
          provider.requestSnapshot();
        }

        // 재시도 후 타임아웃 재설정
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          if (
            stageRef.current === 'api-preview' ||
            stageRef.current === 'api-preview-empty' ||
            stageRef.current === 'yjs-timeout-degraded'
          ) {
            const nextRetry = currentRetry + 1;
            setRetryCount(nextRetry);
            setSyncStage('yjs-timeout-degraded');
            scheduleRetry(nextRetry);
          }
        }, SYNC_TIMEOUT_MS);
      }, delay);
    },
    [providerRef],
  );

  /**
   * 수동 재시도 함수.
   */
  const manualRetry = useCallback(() => {
    clearTimers();
    setRetryCount(0);
    setSyncStage('yjs-timeout-degraded');

    const provider = providerRef.current;
    if (provider && handoffModeRef.current === 'snapshot') {
      provider.requestSnapshot();
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (
        stageRef.current === 'yjs-timeout-degraded' ||
        stageRef.current === 'api-preview' ||
        stageRef.current === 'api-preview-empty'
      ) {
        setRetryCount(1);
        scheduleRetry(1);
      }
    }, SYNC_TIMEOUT_MS);
  }, [clearTimers, providerRef, scheduleRetry]);

  // feature flag OFF면 즉시 yjs-live
  useEffect(() => {
    if (!featureEnabled) {
      setSyncStage('yjs-live');
    }
  }, [featureEnabled]);

  // boot → api-preview / api-preview-empty 전이
  useEffect(() => {
    if (!featureEnabled || isLoading || !diagram) {
      return;
    }
    if (stageRef.current !== 'boot') {
      return;
    }

    if (diagram.content && previewParseSuccess) {
      setSyncStage('api-preview');
      setHandoffMode(diagram.hasYdocSnapshot ? 'snapshot' : 'sync-only');
    } else {
      setSyncStage('api-preview-empty');
      setHandoffMode('sync-only');
    }
  }, [featureEnabled, isLoading, diagram, previewParseSuccess]);

  // api-preview* → yjs-live / yjs-timeout-degraded 전이 (타임아웃 + provider 콜백)
  useEffect(() => {
    if (!featureEnabled) {
      return;
    }
    if (stageRef.current !== 'api-preview' && stageRef.current !== 'api-preview-empty') {
      return;
    }

    const provider = providerRef.current;
    if (!provider) {
      return;
    }

    /**
     * Y.Doc이 비어있으면 preview JSON을 마이그레이션한다.
     *
     * @returns 없음
     */
    const migratePreviewIfEmpty = () => {
      if (diagram?.content && previewParseSuccess && getTablesMap(provider.doc).size === 0) {
        provider.doc.transact(() => {
          migrateJsonToYDoc(provider.doc, diagram.content!);
        }, 'remote');
      }
    };

    // 콜백 등록: snapshot 수신 시
    const prevOnSnapshotReceived = provider.onSnapshotReceived;
    provider.onSnapshotReceived = (snapshotRevision: bigint | null) => {
      prevOnSnapshotReceived?.(snapshotRevision);
      // snapshot handoff는 snapshot 모드에서만 허용한다.
      // sync-only 모드는 SYNC_STEP2 확인 후 전환한다.
      if (handoffModeRef.current !== 'snapshot') {
        return;
      }

      if (!isSnapshotRevisionValid(snapshotRevision, diagram?.contentRevision)) {
        return;
      }

      // snapshot 프레임이 여러 조각으로 올 수 있으므로, 실제 그래프 데이터가 반영됐는지 확인 후 전환한다.
      const hasYDocGraph =
        getTablesMap(provider.doc).size > 0 || getEdgesMap(provider.doc).size > 0;
      if (hasYDocGraph || !previewHasRenderableGraph) {
        transitionToLive();
        return;
      }

      // 레거시(snapshotRevision=null) + 빈 snapshot + preview 데이터가 있는 경우
      // preview JSON으로 안전하게 보정해 "보였다가 사라짐"을 방지한다.
      if (snapshotRevision == null) {
        migratePreviewIfEmpty();
        transitionToLive();
      }
    };

    // 콜백 등록: sync 완료 시
    const prevOnSyncCompleted = provider.onSyncCompleted;
    provider.onSyncCompleted = () => {
      prevOnSyncCompleted?.();
      // sync-only 모드에서만 SYNC_STEP2로 live 전환한다.
      // snapshot 모드는 onSnapshotReceived의 리비전 검증 통과가 필요하다.
      if (handoffModeRef.current === 'sync-only') {
        // sync-only에서는 API preview를 표시했더라도 Y.Doc이 비어있을 수 있다.
        // live 전환 직전에 최초 1회 JSON -> Y.Doc 마이그레이션으로 공백 전환을 방지한다.
        migratePreviewIfEmpty();
        transitionToLive();
      }
    };

    // 타임아웃 설정
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (stageRef.current === 'api-preview' || stageRef.current === 'api-preview-empty') {
        setRetryCount(1);
        setSyncStage('yjs-timeout-degraded');
        scheduleRetry(1);
      }
    }, SYNC_TIMEOUT_MS);

    return () => {
      // 콜백 복원
      provider.onSnapshotReceived = prevOnSnapshotReceived;
      provider.onSyncCompleted = prevOnSyncCompleted;
      // yjs-timeout-degraded 이후에는 재시도 타이머를 유지해야 하므로
      // 초기 handoff 단계에서만 타이머를 정리한다.
      if (stageRef.current === 'api-preview' || stageRef.current === 'api-preview-empty') {
        clearTimers();
      }
    };
  }, [
    featureEnabled,
    syncStage,
    transitionToLive,
    scheduleRetry,
    clearTimers,
    diagram?.contentRevision,
    diagram?.content,
    previewParseSuccess,
    previewHasRenderableGraph,
    providerRef,
  ]);

  // 클린업
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    syncStage: featureEnabled ? syncStage : 'yjs-live',
    handoffMode,
    retryCount,
    maxRetries: MAX_RETRIES,
    manualRetry,
  };
}
