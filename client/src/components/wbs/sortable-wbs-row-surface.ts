import { cn } from '@/lib/utils';

export interface WbsRowSurfaceOptions {
  highlighted: boolean;
  isDragging: boolean;
  pageAuthoringMode: boolean;
  selected: boolean;
}

export interface WbsRowSurfaceClasses {
  denseCell: string | undefined;
  dividerCell: string | undefined;
  actionCell: string | undefined;
  stickyActionSurface: string;
  compactControl: string;
  row: string;
}

export function getWbsRowSurfaceClasses({
  highlighted,
  isDragging,
  pageAuthoringMode,
  selected,
}: WbsRowSurfaceOptions): WbsRowSurfaceClasses {
  const stickyActionSurface = selected
    ? 'bg-secondary/55'
    : highlighted
      ? 'bg-primary/5'
      : isDragging
        ? 'bg-accent/40'
        : 'bg-transparent group-hover/wbs-row:bg-secondary/35';

  return {
    denseCell: pageAuthoringMode ? 'px-3 py-2' : undefined,
    dividerCell: pageAuthoringMode
      ? 'border-b-0 shadow-[inset_0_-1px_0_hsl(var(--border)/0.95)]'
      : undefined,
    actionCell: pageAuthoringMode
      ? cn(
          'sticky right-0 z-10 border-b-0 border-l border-border/80 pl-2 pr-3 shadow-[inset_0_-1px_0_hsl(var(--border)/0.95)]',
          stickyActionSurface,
        )
      : undefined,
    stickyActionSurface,
    compactControl: pageAuthoringMode ? 'mt-0 h-6 w-6' : 'mt-0.5 h-7 w-7',
    row: cn(
      'align-top',
      pageAuthoringMode && 'group/wbs-row',
      isDragging && 'bg-accent/40',
      selected && 'bg-secondary/55',
      highlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
    ),
  };
}
