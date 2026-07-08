import { createContext, useContext } from 'react';

export type CompactTableRenderingMode = 'off' | 'compact' | 'aggressive';

const CompactTableRenderingContext = createContext<CompactTableRenderingMode>('off');

export function resolveCompactTableRenderingMode(
  _nodeCount: number,
  _zoom: number,
): CompactTableRenderingMode {
  return 'off';
}

export function resolveInteractiveCompactTableMode(
  baseMode: CompactTableRenderingMode,
  options: {
    selected: boolean;
    isEditing: boolean;
    fkMode: boolean;
    expanded: boolean;
  },
): CompactTableRenderingMode {
  if (
    baseMode === 'off' ||
    options.selected ||
    options.isEditing ||
    options.fkMode ||
    options.expanded
  ) {
    return 'off';
  }
  return baseMode;
}

export function resolvePreviewCompactTableMode(
  baseMode: CompactTableRenderingMode,
  options?: {
    override?: CompactTableRenderingMode;
    ghost?: boolean;
  },
): CompactTableRenderingMode {
  if (options?.ghost) {
    return 'off';
  }
  return options?.override ?? baseMode;
}

export function CompactTableRenderingProvider({
  mode,
  children,
}: {
  mode: CompactTableRenderingMode;
  children: React.ReactNode;
}) {
  return (
    <CompactTableRenderingContext.Provider value={mode}>
      {children}
    </CompactTableRenderingContext.Provider>
  );
}

export function useCompactTableRendering(): boolean {
  return useContext(CompactTableRenderingContext) !== 'off';
}

export function useCompactTableRenderingMode(): CompactTableRenderingMode {
  return useContext(CompactTableRenderingContext);
}
