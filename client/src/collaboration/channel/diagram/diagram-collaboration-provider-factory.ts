import * as Y from 'yjs';
import type { DiagramCollaborationProviderLike } from './diagram-collaboration-provider-connection.js';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';

export interface DiagramCollaborationProviderLifecycleFactoryArgs {
  ydoc: Y.Doc;
  sharedDocumentEngine: YjsSharedDocumentEngine;
  snapshotCodec: DocumentSnapshotCodec;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  updatePreviewMode: (next: boolean) => void;
  onProviderReady: (provider: DiagramCollaborationProviderLike) => void;
  onProviderDisposed: () => void;
}

export interface DiagramCollaborationProviderLifecycleLike {
  setup(): Promise<void>;
  dispose(): void;
}

export type CreateDiagramCollaborationProviderLifecycle = (
  args: DiagramCollaborationProviderLifecycleFactoryArgs,
) => DiagramCollaborationProviderLifecycleLike;
