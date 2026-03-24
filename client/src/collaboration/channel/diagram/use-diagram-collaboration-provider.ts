import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import type { CreateDiagramCollaborationProviderLifecycle } from './use-diagram-collaboration-runtime.js';

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
}: UseDiagramCollaborationProviderOptions): UseDiagramCollaborationProviderReturn {
  const providerRef = useRef<YjsProvider | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (!collaborationBootstrap || !diagramId) {
      return;
    }

    const ydoc = new Y.Doc();
    initYDoc(ydoc);
    const providerLifecycle = createProviderLifecycle({
      ydoc,
      diagramId,
      teamId,
      projectId,
      updatePreviewMode: setIsPreviewMode,
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
  }, [
    collaborationBootstrap,
    createProviderLifecycle,
    destroyYDoc,
    diagramId,
    initYDoc,
    projectId,
    resetCollaboration,
    resetRuntimeState,
    teamId,
  ]);

  return { providerRef, isPreviewMode };
}
