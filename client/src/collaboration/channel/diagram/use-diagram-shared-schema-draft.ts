import type { DiagramDocumentMutationSession } from './diagram-document-mutation-session';
import { useCallback, useEffect, useState } from 'react';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  getSharedSchemaDraftMap,
  hasSharedSchemaDraftContent,
  readSharedSchemaDraftSnapshot,
  type SharedSchemaDraftSnapshot,
} from '@/lib/shared-schema-draft';

interface UseDiagramSharedSchemaDraftResult {
  sharedSchemaDraft: SharedSchemaDraftSnapshot | null;
  writePreviewPositionOverrides: (nextPositions: DiagramPreviewPositionRecord) => void;
}

export function useDiagramSharedSchemaDraft(
  session: DiagramDocumentMutationSession | null,
): UseDiagramSharedSchemaDraftResult {
  const ydoc = useCanvasStore((state) => state.ydoc);
  const [sharedSchemaDraft, setSharedSchemaDraft] = useState<SharedSchemaDraftSnapshot | null>(
    null,
  );

  useEffect(() => {
    if (!ydoc) {
      setSharedSchemaDraft(null);
      return;
    }

    const draftMap = getSharedSchemaDraftMap(ydoc);
    const syncSharedSchemaDraft = () => {
      const nextSnapshot = readSharedSchemaDraftSnapshot(ydoc);
      setSharedSchemaDraft(hasSharedSchemaDraftContent(nextSnapshot) ? nextSnapshot : null);
    };

    syncSharedSchemaDraft();
    draftMap.observe(syncSharedSchemaDraft);
    return () => {
      draftMap.unobserve(syncSharedSchemaDraft);
    };
  }, [ydoc]);

  const writePreviewPositionOverrides = useCallback(
    (nextPositions: DiagramPreviewPositionRecord) => {
      session?.emitCommand({
        key: 'schema-draft:positions',
        payload: { positions: nextPositions },
      });
    },
    [session],
  );

  return {
    sharedSchemaDraft,
    writePreviewPositionOverrides,
  };
}
