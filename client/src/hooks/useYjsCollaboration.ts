import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { getTablesMap, migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import useCanvasStore from '@/stores/useCanvasStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import { requestWsTicket } from '@/api/diagramApi';
import type { DiagramDetail } from '@/types/diagram';
import type { ConnectionStatus } from '@/types/collaboration';
import { ENABLE_API_PREVIEW } from '@/constants/feature-flags';

/** WS 스냅샷이 도착하지 않을 때 JSON content로 폴백하기까지의 대기 시간 (ms) — feature flag OFF 전용 */
const WS_SNAPSHOT_FALLBACK_MS = 5_000;

/**
 * useYjsCollaboration 훅의 반환 타입.
 */
interface UseYjsCollaborationReturn {
  /** YjsProvider 참조 (ERDCanvas에 전달) */
  providerRef: React.RefObject<YjsProvider | null>;
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
): UseYjsCollaborationReturn {
  const providerRef = useRef<YjsProvider | null>(null);

  const initYDoc = useCanvasStore((s) => s.initYDoc);
  const destroyYDoc = useCanvasStore((s) => s.destroyYDoc);
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

  /** 일회용 ticket 발급 콜백 (diagramId 캡처, 참조 안정) */
  const getTicket = useCallback(() => requestWsTicket(diagramId!), [diagramId]);

  // Y.Doc 생성 + YjsProvider 연결 + 라이프사이클 관리
  useEffect(() => {
    if (!diagram || !diagramId) {
      return;
    }

    // 1. Y.Doc 생성
    const ydoc = new Y.Doc();

    // 2. 기존 JSON 데이터 마이그레이션 (ydocSnapshot이 없는 레거시 다이어그램용)
    // feature flag ON: useDiagramSyncStage에서 제어하므로 즉시 마이그레이션 생략
    // feature flag OFF: 기존 동작 유지
    if (!ENABLE_API_PREVIEW && diagram.content && !diagram.hasYdocSnapshot) {
      migrateJsonToYDoc(ydoc, diagram.content);
    }

    // 3. Y.Doc → Zustand 연결 (observeDeep 등록)
    initYDoc(ydoc);

    // 4. YjsProvider 연결
    const provider = new YjsProvider(ydoc, {
      diagramId,
      getTicket,
      protocolVersion: ENABLE_API_PREVIEW ? 2 : 1,
    });

    provider.onConnectionStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
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

    // 5. hasYdocSnapshot === true인데 WS 스냅샷이 도착하지 않으면 JSON content로 폴백
    // feature flag ON: useDiagramSyncStage에서 타임아웃/재시도를 관리하므로 폴백 타이머 비활성화
    let snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (!ENABLE_API_PREVIEW && diagram.hasYdocSnapshot && diagram.content) {
      snapshotFallbackTimer = setTimeout(() => {
        snapshotFallbackTimer = null;
        if (getTablesMap(ydoc).size === 0) {
          console.warn(
            '[useYjsCollaboration] WS 스냅샷 %dms 내 미도착 — JSON content로 폴백',
            WS_SNAPSHOT_FALLBACK_MS,
          );
          // 'remote' origin: WS 브로드캐스트 방지 + useAutoBackup 로컬 변경 미인식
          ydoc.transact(() => migrateJsonToYDoc(ydoc, diagram.content!), 'remote');
        }
      }, WS_SNAPSHOT_FALLBACK_MS);
    }

    return () => {
      if (snapshotFallbackTimer) {
        clearTimeout(snapshotFallbackTimer);
      }
      try {
        provider.destroy();
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
  }, [diagramId, diagram?.id]);

  // 스냅샷 크기 임계치 초과 + 단독 접속 시 자동 컴팩션
  useSnapshotCompaction(providerRef, diagramId);

  return { providerRef };
}
