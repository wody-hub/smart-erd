import * as Y from 'yjs';
import type { DiagramCollaborationProviderLike } from './diagram-collaboration-provider-connection.js';

export interface DiagramCollaborationProviderLifecycleFactoryArgs {
  ydoc: Y.Doc;
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
