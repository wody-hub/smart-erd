import { YjsProvider } from '@/collaboration/YjsProvider';
import {
  type PreviewSyncStatus,
} from '@/collaboration/core/collaboration-preview-sync-status';
import { useSnapshotCompaction } from '@/hooks/useSnapshotCompaction';
import type { DiagramDetail } from '@/types/diagram';
import { useDiagramCollaborationRuntime } from '@/collaboration/channel/diagram/use-diagram-collaboration-runtime';
import { useDiagramCollaborationProvider } from '@/collaboration/channel/diagram/use-diagram-collaboration-provider';

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
  const {
    collaborationBootstrap,
    previewSyncStatus,
    initYDoc,
    destroyYDoc,
    storeBridge,
    resetRuntimeState,
    createProviderLifecycle,
  } = useDiagramCollaborationRuntime(diagram);
  const { providerRef, isPreviewMode } = useDiagramCollaborationProvider({
    collaborationBootstrap,
    diagramId,
    teamId,
    projectId,
    initYDoc,
    destroyYDoc,
    resetCollaboration: storeBridge.resetCollaboration,
    resetRuntimeState,
    createProviderLifecycle,
  });

  // 스냅샷 크기 임계치 초과 + 단독 접속 시 자동 컴팩션
  useSnapshotCompaction(providerRef, diagramId);

  return { providerRef, isPreviewMode, previewSyncStatus };
}
