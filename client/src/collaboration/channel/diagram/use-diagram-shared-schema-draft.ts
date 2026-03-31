import { useCallback, useEffect, useState } from 'react';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import type { DiagramPreviewPositionRecord } from '@/lib/diagram-code-draft';
import {
  getSharedSchemaDraftMap,
  hasSharedSchemaDraftContent,
  readSharedSchemaDraftSnapshot,
  SHARED_SCHEMA_DRAFT_ORIGIN,
  type SharedSchemaDraftSnapshot,
  writeSharedSchemaDraftPositions,
} from '@/lib/shared-schema-draft';

interface UseDiagramSharedSchemaDraftResult {
  sharedSchemaDraft: SharedSchemaDraftSnapshot | null;
  writePreviewPositionOverrides: (nextPositions: DiagramPreviewPositionRecord) => void;
}

export function useDiagramSharedSchemaDraft(): UseDiagramSharedSchemaDraftResult {
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
      if (!ydoc && Object.keys(nextPositions).length === 0) {
        return;
      }
      if (!ydoc) {
        return;
      }
      writeSharedSchemaDraftPositions(ydoc, nextPositions, SHARED_SCHEMA_DRAFT_ORIGIN);
    },
    [ydoc],
  );

  return {
    sharedSchemaDraft,
    writePreviewPositionOverrides,
  };
}
