import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import { useCollaborationSession } from '@/collaboration/core/use-collaboration-session';
import {
  toPreviewSyncStatus,
  type PreviewSyncStatus,
} from '@/collaboration/core/collaboration-preview-sync-status';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import type { DiagramDetail } from '@/types/diagram';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';
import { DiagramCollaborationPreviewPolicy } from '@/collaboration/channel/diagram/diagram-collaboration-preview-policy';
import { DiagramCollaborationProviderLifecycle } from '@/collaboration/channel/diagram/diagram-collaboration-provider-lifecycle';
import { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';

/** WS 스냅샷이 도착하지 않을 때 JSON content로 폴백하기까지의 대기 시간 (ms) */
const WS_SNAPSHOT_FALLBACK_MS = 5_000;

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
  /** API JSON 프리뷰 모드 (Y.Doc에 데이터가 도착하면 해제) */
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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

  const previewPolicy = useMemo(
    () => new DiagramCollaborationPreviewPolicy(),
    [],
  );
  const documentAdapter = useMemo(
    () => new DiagramYjsDocumentAdapter(),
    [],
  );
  const runtimeTransition = useMemo(
    () => previewPolicy.transition.bind(previewPolicy),
    [previewPolicy],
  );
  const collaborationBootstrap = useMemo<DiagramCollaborationBootstrap | null>(
    () => {
      if (!diagram) {
        return null;
      }
      return {
        content: diagram.content,
        hasYdocSnapshot: diagram.hasYdocSnapshot,
        contentRevision: diagram.contentRevision,
      };
    },
    [diagram?.content, diagram?.contentRevision, diagram?.hasYdocSnapshot],
  );
  const { runtimeState, dispatchRuntimeEvent, resetRuntimeState } = useCollaborationSession({
    transition: runtimeTransition,
  });
  const previewEnabled = Boolean(
    collaborationBootstrap && previewPolicy.shouldStartInPreview(collaborationBootstrap),
  );
  const previewSyncStatus = toPreviewSyncStatus(runtimeState, previewEnabled);

  // Y.Doc 생성 + YjsProvider 연결 + 라이프사이클 관리
  useEffect(() => {
    if (!collaborationBootstrap || !diagramId) {
      return;
    }

    // 1. Y.Doc 생성
    const ydoc = new Y.Doc();
    initYDoc(ydoc);
    const handoffStartedAt = performance.now();
    const handoffLogPrefix = `[useYjsCollaboration][diagramId=${diagramId}]`;
    const providerLifecycle = new DiagramCollaborationProviderLifecycle({
      ydoc,
      bootstrap: collaborationBootstrap,
      diagramId,
      teamId,
      projectId,
      previewEnabled,
      handoffStartedAt,
      handoffLogPrefix,
      fallbackTimeoutMs: WS_SNAPSHOT_FALLBACK_MS,
      documentAdapter,
      dispatchRuntimeEvent,
      updatePreviewMode: (next) => {
        setIsPreviewMode(next);
      },
      loadPreview,
      setConnectionStatus,
      setPresenceMode,
      setSelfUserId,
      applyPresenceSnapshot,
      applyPeerJoined,
      applyPeerLeft,
      updateAwareness,
      removePeerByUserId,
      removePeerByLoginId,
      onProviderReady: (provider) => {
        providerRef.current = provider;
      },
      onProviderDisposed: () => {
        providerRef.current = null;
      },
    });
    void providerLifecycle.setup();

    return () => {
      resetRuntimeState();
      providerLifecycle.dispose();
      destroyYDoc();
      resetCollaboration();
    };
    // 의존성 배열 안전성 근거:
    // - initYDoc, destroyYDoc: Zustand 셀렉터 — create() 내부 클로저로 참조 안정
    // - collaboration store action 셀렉터들도 참조 안정
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyPeerJoined, applyPeerLeft, applyPresenceSnapshot, collaborationBootstrap, destroyYDoc, diagramId, dispatchRuntimeEvent, documentAdapter, initYDoc, projectId, removePeerByLoginId, removePeerByUserId, resetCollaboration, resetRuntimeState, setConnectionStatus, setPresenceMode, setSelfUserId, teamId, updateAwareness]);

  // 스냅샷 크기 임계치 초과 + 단독 접속 시 자동 컴팩션
  useSnapshotCompaction(providerRef, diagramId);

  return { providerRef, isPreviewMode, previewSyncStatus };
}
