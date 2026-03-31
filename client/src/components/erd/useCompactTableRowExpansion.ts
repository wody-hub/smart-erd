import { useEffect, useState } from 'react';
import {
  type CompactTableRenderingMode,
  resolveInteractiveCompactTableMode,
} from './CompactTableRenderingContext';

export function useCompactTableRowExpansion(
  baseMode: CompactTableRenderingMode,
  options: {
    selected: boolean;
    isEditing: boolean;
    fkMode: boolean;
  },
) {
  const [expanded, setExpanded] = useState(false);
  const compactMode = resolveInteractiveCompactTableMode(baseMode, {
    ...options,
    expanded,
  });
  const isCompactCandidate =
    baseMode !== 'off' && !options.selected && !options.isEditing && !options.fkMode;

  useEffect(() => {
    if (!isCompactCandidate) {
      setExpanded(false);
    }
  }, [isCompactCandidate]);

  return {
    compactMode,
    canExpandHiddenColumns: compactMode !== 'off',
    expandHiddenColumns: () => setExpanded(true),
  };
}
