import { useEffect, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import type { CreateDiagramCollaborationProviderLifecycle } from './diagram-collaboration-provider-factory.js';
import { DiagramCollaborationProviderSession } from './diagram-collaboration-provider-session.js';

interface UseDiagramCollaborationProviderOptions {
  collaborationBootstrap: DiagramCollaborationBootstrap | null;
  diagramId: string | undefined;
  teamId: string | undefined;
  projectId: string | undefined;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  resetCollaboration: () => void;
  resetRuntimeState: () => void;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
  onSetupFailed: (error: unknown) => void;
}

interface UseDiagramCollaborationProviderReturn {
  providerRef: React.RefObject<YjsProvider | null>;
  isPreviewMode: boolean;
}

/**
 * 다이어그램 채널의 Y.Doc/provider 수명주기와 preview lock 상태를 관리한다.
 */
export function useDiagramCollaborationProvider({
  collaborationBootstrap,
  diagramId,
  teamId,
  projectId,
  initYDoc,
  destroyYDoc,
  resetCollaboration,
  resetRuntimeState,
  createProviderLifecycle,
  onSetupFailed,
}: UseDiagramCollaborationProviderOptions): UseDiagramCollaborationProviderReturn {
  const providerRef = useRef<YjsProvider | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (!collaborationBootstrap || !diagramId) {
      return;
    }

    let cancelled = false;
    const providerSession = new DiagramCollaborationProviderSession({
      collaborationBootstrap,
      diagramId,
      teamId,
      projectId,
      initYDoc,
      destroyYDoc,
      resetCollaboration,
      resetRuntimeState,
      createProviderLifecycle,
      updatePreviewMode: setIsPreviewMode,
      onProviderReady: (provider) => {
        providerRef.current = provider as YjsProvider;
      },
      onProviderDisposed: () => {
        providerRef.current = null;
      },
    });
    void providerSession.setup().catch((error) => {
      if (cancelled) {
        return;
      }
      console.error('[useYjsCollaboration] provider session setup failed', error);
      onSetupFailed(error);
    });

    return () => {
      cancelled = true;
      providerSession.dispose();
    };
  }, [
    collaborationBootstrap,
    createProviderLifecycle,
    destroyYDoc,
    diagramId,
    initYDoc,
    projectId,
    resetCollaboration,
    resetRuntimeState,
    onSetupFailed,
    teamId,
  ]);

  return { providerRef, isPreviewMode };
}
