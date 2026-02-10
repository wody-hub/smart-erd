import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { migrateJsonToYDoc } from '@/collaboration/yjsBridge';
import useCanvasStore from '@/stores/useCanvasStore';
import useAuthStore from '@/stores/useAuthStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
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
  const markClean = useCanvasStore((s) => s.markClean);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setConnectionStatus = useCollaborationStore((s) => s.setConnectionStatus);
  const updateAwareness = useCollaborationStore((s) => s.updateAwareness);
  const removePeerByLoginId = useCollaborationStore((s) => s.removePeerByLoginId);
  const resetCollaboration = useCollaborationStore((s) => s.reset);

  // Y.Doc 생성 + YjsProvider 연결 + 라이프사이클 관리
  useEffect(() => {
    if (!diagram || !diagramId || !accessToken) return;

    // 1. Y.Doc 생성
    const ydoc = new Y.Doc();

    // 2. 기존 JSON 데이터 마이그레이션 (ydocSnapshot이 없는 레거시 다이어그램용)
    // Y.Doc 스냅샷은 WS 연결 후 SNAPSHOT_REQUEST로 서버에서 로드
    if (diagram.content) {
      migrateJsonToYDoc(ydoc, diagram.content);
    }

    // 3. Y.Doc → Zustand 연결 (observeDeep 등록)
    initYDoc(ydoc);
    markClean();

    // 4. YjsProvider 연결
    const provider = new YjsProvider(ydoc, {
      diagramId,
      token: accessToken,
    });

    provider.onConnectionStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
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
      provider.destroy();
      providerRef.current = null;
      destroyYDoc();
      resetCollaboration();
    };
    // 의존성 배열 안전성 근거:
    // - accessToken: 별도 useEffect에서 providerRef.current.updateToken()으로 갱신
    // - initYDoc, destroyYDoc, markClean: Zustand 셀렉터 — create() 내부 클로저로 참조 안정
    // - setConnectionStatus, updateAwareness, removePeerByLoginId, resetCollaboration: 동일
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, diagramId]);

  // Access Token 갱신 시 Provider에 새 토큰 전달 (재연결 시 사용)
  useEffect(() => {
    if (providerRef.current && accessToken) {
      providerRef.current.updateToken(accessToken);
    }
  }, [accessToken]);

  return { providerRef };
}
