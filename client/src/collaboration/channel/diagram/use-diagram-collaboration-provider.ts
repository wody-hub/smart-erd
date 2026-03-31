import { useEffect, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { YjsProvider } from '@/collaboration/YjsProvider';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';
import type { CreateDiagramCollaborationProviderLifecycle } from './diagram-collaboration-provider-factory.js';
import { DiagramCollaborationProviderSession } from './diagram-collaboration-provider-session.js';
import { AuthoritativeBootstrapRequiredError } from './diagram-collaboration-provider-lifecycle.js';

export type DiagramCollaborationSetupErrorKind = 'authoritative-bootstrap-required' | null;

interface UseDiagramCollaborationProviderOptions {
  collaborationBootstrap: DiagramCollaborationBootstrap | null;
  sharedDocumentEngine: YjsSharedDocumentEngine | null;
  snapshotCodec: DocumentSnapshotCodec | null;
  diagramId: string | undefined;
  teamId: string | undefined;
  projectId: string | undefined;
  initYDoc: (doc: Y.Doc) => void;
  destroyYDoc: () => void;
  resetCollaboration: () => void;
  resetRuntimeState: () => void;
  beforeDestroyYDoc?: (() => void) | null;
  createProviderLifecycle: CreateDiagramCollaborationProviderLifecycle;
  onSetupFailed: (error: unknown) => void;
  setupAttempt: number;
}

interface UseDiagramCollaborationProviderReturn {
  providerRef: React.RefObject<YjsProvider | null>;
  isPreviewMode: boolean;
  setupErrorKind: DiagramCollaborationSetupErrorKind;
}

/**
 * 다이어그램 채널의 Y.Doc/provider 수명주기와 preview lock 상태를 관리한다.
 */
export function useDiagramCollaborationProvider({
  collaborationBootstrap,
  sharedDocumentEngine,
  snapshotCodec,
  diagramId,
  teamId,
  projectId,
  initYDoc,
  destroyYDoc,
  resetCollaboration,
  resetRuntimeState,
  beforeDestroyYDoc,
  createProviderLifecycle,
  onSetupFailed,
  setupAttempt,
}: UseDiagramCollaborationProviderOptions): UseDiagramCollaborationProviderReturn {
  const providerRef = useRef<YjsProvider | null>(null);
  const beforeDestroyYDocRef = useRef<(() => void) | null>(beforeDestroyYDoc ?? null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [setupErrorKind, setSetupErrorKind] = useState<DiagramCollaborationSetupErrorKind>(null);

  useEffect(() => {
    beforeDestroyYDocRef.current = beforeDestroyYDoc ?? null;
  }, [beforeDestroyYDoc]);

  useEffect(() => {
    if (!collaborationBootstrap || !diagramId || !sharedDocumentEngine || !snapshotCodec) {
      return;
    }

    setSetupErrorKind(null);
    let cancelled = false;
    const providerSession = new DiagramCollaborationProviderSession({
      collaborationBootstrap,
      sharedDocumentEngine,
      snapshotCodec,
      diagramId,
      teamId,
      projectId,
      initYDoc,
      destroyYDoc,
      resetCollaboration,
      resetRuntimeState,
      beforeDestroyYDoc: () => beforeDestroyYDocRef.current?.(),
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
      if (error instanceof AuthoritativeBootstrapRequiredError) {
        setSetupErrorKind('authoritative-bootstrap-required');
      }
      console.error('[useDiagramCollaborationSession] provider session setup failed', error);
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
    sharedDocumentEngine,
    snapshotCodec,
    setupAttempt,
    teamId,
  ]);

  return { providerRef, isPreviewMode, setupErrorKind };
}
