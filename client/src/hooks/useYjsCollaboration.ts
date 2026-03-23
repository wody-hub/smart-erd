import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { useCollaborationSession } from '@/collaboration/core/use-collaboration-session';
import { getTablesMap, migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import { persistDiagramYdocSnapshot, requestWsTicket } from '@/api/diagramApi';
import type { DiagramDetail } from '@/types/diagram';
import type { ConnectionStatus } from '@/types/collaboration';

/** WS 스냅샷이 도착하지 않을 때 JSON content로 폴백하기까지의 대기 시간 (ms) */
const WS_SNAPSHOT_FALLBACK_MS = 5_000;
type PreviewSyncStatus = 'inactive' | 'syncing' | 'live' | 'degraded';

/**
 * useYjsCollaboration 훅의 반환 타입.
 */
interface UseYjsCollaborationReturn {
  /** YjsProvider 참조 (ERDCanvas에 전달) */
  providerRef: React.RefObject<YjsProvider | null>;
  /** API JSON 프리뷰 모드 여부 (true이면 편집 잠금) */
  isPreviewMode: boolean;
  /** 프리뷰 이후 실시간 동기화 완료/폴백 상태 */
  previewSyncStatus: PreviewSyncStatus;
}

/**
 * Y.Doc 생성, 스냅샷 로드, YjsProvider 연결, 라이프사이클 정리를 캡슐화하는 훅.
 *
 * DiagramPage에서 Yjs/WebSocket 저수준 로직을 분리하여 추상화 누수를 방지한다.
 *
 * @param diagram   서버에서 로드된 다이어그램 상세 정보 (null이면 미연결)
 * @param diagramId URL 파라미터의 다이어그램 ID
 * @returns YjsProvider 참조
 */
export function useYjsCollaboration(
  diagram: DiagramDetail | undefined,
  diagramId: string | undefined,
  teamId: string | undefined,
  projectId: string | undefined,
): UseYjsCollaborationReturn {
  const providerRef = useRef<YjsProvider | null>(null);
  const { dispatchRuntimeEvent, resetRuntimeState } = useCollaborationSession();
  /** API JSON 프리뷰 모드 (Y.Doc에 데이터가 도착하면 해제) */
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSyncStatus, setPreviewSyncStatus] = useState<PreviewSyncStatus>('inactive');

  const initYDoc = useCanvasStore((s) => s.initYDoc);
  const destroyYDoc = useCanvasStore((s) => s.destroyYDoc);
  const loadPreview = useCanvasStore((s) => s.loadPreview);
  const setConnectionStatus = useCollaborationStore((s) => s.setConnectionStatus);
  const setPresenceMode = useCollaborationStore((s) => s.setPresenceMode);
  const setSelfUserId = useCollaborationStore((s) => s.setSelfUserId);
  const applyPresenceSnapshot = useCollaborationStore((s) => s.applyPresenceSnapshot);
  const applyPeerJoined = useCollaborationStore((s) => s.applyPeerJoined);
  const applyPeerLeft = useCollaborationStore((s) => s.applyPeerLeft);
  const updateAwareness = useCollaborationStore((s) => s.updateAwareness);
  const removePeerByUserId = useCollaborationStore((s) => s.removePeerByUserId);
  const removePeerByLoginId = useCollaborationStore((s) => s.removePeerByLoginId);
  const resetCollaboration = useCollaborationStore((s) => s.reset);

  // Y.Doc 생성 + YjsProvider 연결 + 라이프사이클 관리
  useEffect(() => {
    if (!diagram || !diagramId) {
      return;
    }

    // 1. Y.Doc 생성
    const ydoc = new Y.Doc();
    let isDisposed = false;
    let provider: YjsProvider | null = null;
    let currentConnectionStatus: ConnectionStatus = 'connecting';
    let previewHydrationSource: 'remote' | 'fallback' | null = null;
    let previewRemoteReadyPending = false;
    const handoffStartedAt = performance.now();
    const handoffLogPrefix = `[useYjsCollaboration][diagramId=${diagramId}]`;
    let ticketRequestedAt: number | null = null;
    let wsConnectedAt: number | null = null;
    let previewShownAt: number | null = null;
    let previewUnlockedAt: number | null = null;

    const updatePreviewMode = (next: boolean) => {
      setIsPreviewMode(next);
    };
    const updatePreviewSyncStatus = (next: PreviewSyncStatus) => {
      setPreviewSyncStatus(next);
    };

    initYDoc(ydoc);

    let previewExitObserver: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null = null;
    const setupCollaboration = async () => {
      // 2. 기존 JSON 데이터 마이그레이션 (ydocSnapshot이 없는 레거시 다이어그램용)
      // Y.Doc 스냅샷은 WS 연결 후 SNAPSHOT_REQUEST로 서버에서 로드
      if (diagram.content && !diagram.hasYdocSnapshot) {
        migrateJsonToYDoc(ydoc, diagram.content);
        updatePreviewSyncStatus('inactive');

        if (teamId && projectId) {
          try {
            const persisted = await persistDiagramYdocSnapshot(
              teamId,
              projectId,
              diagramId,
              diagram.contentRevision,
              Y.encodeStateAsUpdate(ydoc),
            );
            if (persisted) {
              console.info(
                '%s content-only snapshot-seeded totalMs=%d',
                handoffLogPrefix,
                Math.round(performance.now() - handoffStartedAt),
              );
            } else {
              console.warn('%s content-only snapshot seed returned persisted=false', handoffLogPrefix);
            }
          } catch (error) {
            console.warn('%s content-only snapshot seed failed', handoffLogPrefix, error);
          }
        }
      }

      if (isDisposed) {
        return;
      }

      // 4. hasYdocSnapshot=true → API JSON으로 프리뷰 즉시 표시
      //    Y.Doc은 건드리지 않고 Zustand에만 주입하여 CRDT 충돌을 방지한다.
      if (diagram.hasYdocSnapshot && diagram.content) {
        dispatchRuntimeEvent('bootstrap-loaded');
        loadPreview(diagram.content);
        previewShownAt = performance.now();
        updatePreviewMode(true);
        updatePreviewSyncStatus('syncing');
        console.info(
          '%s preview-visible totalMs=%d',
          handoffLogPrefix,
          Math.round(previewShownAt - handoffStartedAt),
        );

        // Y.Doc에 데이터가 들어오면 프리뷰 모드 해제
        const tablesMap = getTablesMap(ydoc);
        previewExitObserver = () => {
          if (tablesMap.size > 0) {
            previewHydrationSource ??= 'remote';
            tablesMap.unobserveDeep(previewExitObserver!);
            previewExitObserver = null;
            updatePreviewMode(false);
            previewUnlockedAt = performance.now();
            console.info(
              '%s preview-unlocked source=%s totalMs=%d afterPreviewMs=%d updatesApplied=%d',
              handoffLogPrefix,
              previewHydrationSource,
              Math.round(previewUnlockedAt - handoffStartedAt),
              Math.round(previewUnlockedAt - (previewShownAt ?? handoffStartedAt)),
              tablesMap.size,
            );
            if (previewHydrationSource === 'fallback') {
              dispatchRuntimeEvent('fallback-timeout');
              updatePreviewSyncStatus('degraded');
              return;
            }
            dispatchRuntimeEvent('remote-snapshot-applied');
            if (currentConnectionStatus === 'connected') {
              updatePreviewSyncStatus('live');
              return;
            }
            previewRemoteReadyPending = true;
          }
        };
        tablesMap.observeDeep(previewExitObserver);
      } else {
        updatePreviewSyncStatus('inactive');
      }

      // 5. YjsProvider 연결
      provider = new YjsProvider(ydoc, {
        diagramId,
        getTicket: async () => {
          ticketRequestedAt = performance.now();
          const ticket = await requestWsTicket(diagramId);
          const ticketResolvedAt = performance.now();
          console.info(
            '%s ticket-issued ms=%d totalMs=%d',
            handoffLogPrefix,
            Math.round(ticketResolvedAt - ticketRequestedAt),
            Math.round(ticketResolvedAt - handoffStartedAt),
          );
          return ticket;
        },
      });

      provider.onConnectionStatusChange = (status: ConnectionStatus) => {
        currentConnectionStatus = status;
        setConnectionStatus(status);
        if (status === 'connecting' && wsConnectedAt !== null) {
          dispatchRuntimeEvent('reconnect-start');
        }
        if (status === 'disconnected') {
          dispatchRuntimeEvent('disconnect');
        }
        if (status === 'connected') {
          dispatchRuntimeEvent('ws-connected');
          wsConnectedAt = performance.now();
          console.info(
            '%s ws-connected totalMs=%d afterTicketMs=%s',
            handoffLogPrefix,
            Math.round(wsConnectedAt - handoffStartedAt),
            ticketRequestedAt === null ? 'n/a' : Math.round(wsConnectedAt - ticketRequestedAt),
          );
        }
        if (status === 'connected' && previewRemoteReadyPending) {
          previewRemoteReadyPending = false;
          updatePreviewSyncStatus('live');
          console.info(
            '%s live-ready totalMs=%d afterWsMs=%s',
            handoffLogPrefix,
            Math.round(performance.now() - handoffStartedAt),
            wsConnectedAt === null ? 'n/a' : Math.round(performance.now() - wsConnectedAt),
          );
        }
      };

      provider.onIdentityResolved = (userId) => {
        setSelfUserId(userId);
      };

      provider.onPresenceModeChange = (mode) => {
        setPresenceMode(mode);
      };

      provider.onPresenceSnapshot = (payload) => {
        applyPresenceSnapshot(payload);
      };

      provider.onPresencePeerJoined = (payload) => {
        applyPeerJoined(payload);
      };

      provider.onPresencePeerLeft = (payload) => {
        applyPeerLeft(payload);
        removePeerByUserId(payload.userId);
      };

      provider.onAwarenessReceived = (clientId, state) => {
        updateAwareness(clientId, state);
      };

      provider.onPeerLeft = (loginId) => {
        removePeerByLoginId(loginId);
      };

      provider.connect();
      providerRef.current = provider;

      // 6. hasYdocSnapshot === true인데 WS 스냅샷이 도착하지 않으면 JSON content로 폴백
      if (diagram.hasYdocSnapshot && diagram.content) {
        snapshotFallbackTimer = setTimeout(() => {
          snapshotFallbackTimer = null;
          if (getTablesMap(ydoc).size === 0) {
            console.warn(
              '%s snapshot-fallback timeoutMs=%d totalMs=%d',
              handoffLogPrefix,
              WS_SNAPSHOT_FALLBACK_MS,
              Math.round(performance.now() - handoffStartedAt),
            );
            // 'remote' origin: WS 브로드캐스트 방지 + useAutoBackup 로컬 변경 미인식
            previewHydrationSource = 'fallback';
            ydoc.transact(() => migrateJsonToYDoc(ydoc, diagram.content!), 'remote');
          }
        }, WS_SNAPSHOT_FALLBACK_MS);
      }
    };

    let snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    void setupCollaboration();

    return () => {
      isDisposed = true;
      if (previewExitObserver) {
        getTablesMap(ydoc).unobserveDeep(previewExitObserver);
      }
      updatePreviewMode(false);
      updatePreviewSyncStatus('inactive');
      resetRuntimeState();
      if (snapshotFallbackTimer) {
        clearTimeout(snapshotFallbackTimer);
      }
      try {
        provider?.destroy();
      } catch (e) {
        console.error('[useYjsCollaboration] provider.destroy() 실패:', e);
      } finally {
        providerRef.current = null;
        destroyYDoc();
        resetCollaboration();
      }
    };
    // 의존성 배열 안전성 근거:
    // - getTicket: useCallback으로 diagramId 캡처, 참조 안정
    // - initYDoc, destroyYDoc: Zustand 셀렉터 — create() 내부 클로저로 참조 안정
    // - setConnectionStatus, updateAwareness, removePeerByLoginId, resetCollaboration: 동일
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, diagram?.id, projectId, teamId]);

  // 스냅샷 크기 임계치 초과 + 단독 접속 시 자동 컴팩션
  useSnapshotCompaction(providerRef, diagramId);

  return { providerRef, isPreviewMode, previewSyncStatus };
}
