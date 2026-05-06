import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WbsLevelBadgeProps {
  label: string;
  className?: string;
  dense?: boolean;
}

export default function WbsLevelBadge({ label, className, dense = false }: WbsLevelBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        dense
          ? 'shrink-0 border-border/70 bg-secondary/35 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground'
          : 'shrink-0 border-border/70 bg-secondary/35 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground',
        className,
      )}
    >
      {label}
    </Badge>
  );
}
