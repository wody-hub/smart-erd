import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WorkspaceEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'default' | 'error';
  role?: 'status' | 'alert';
}

export default function WorkspaceEmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
  role = 'status',
}: WorkspaceEmptyStateProps) {
  return (
    <Card className="surface-display overflow-hidden">
      <CardContent
        className="flex flex-col items-center justify-center py-14 text-center"
        role={role}
      >
        <div
          className={cn(
            'mb-5 rounded-full border p-4 shadow-operational',
            tone === 'error'
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-brand-secondary/15 bg-brand-secondary/10 text-brand-secondary',
          )}
        >
          {icon}
        </div>
        <h3 className="font-display text-[1.8rem] font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
