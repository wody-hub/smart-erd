import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import useCanvasStore from '@/stores/useCanvasStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import { requestWsTicket } from '@/api/diagramApi';
import type { DiagramDetail } from '@/types/diagram';
import type { ConnectionStatus } from '@/types/collaboration';

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
    if (!diagram || !diagramId) return;

    // 1. Y.Doc 생성
    const ydoc = new Y.Doc();

    // 2. 기존 JSON 데이터 낙관적 부트스트랩
    // - hasYdocSnapshot=true여도 content가 있으면 먼저 그려 초기 공백/깜빡임을 줄인다.
    // - 이후 WS SNAPSHOT_RESPONSE가 authoritative 상태로 보정한다.
    if (diagram.content) {
      migrateJsonToYDoc(ydoc, diagram.content);
    }

    // 3. Y.Doc → Zustand 연결 (observeDeep 등록)
    initYDoc(ydoc);

    // 4. YjsProvider 연결
    const provider = new YjsProvider(ydoc, {
      diagramId,
      getTicket,
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

    return () => {
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
