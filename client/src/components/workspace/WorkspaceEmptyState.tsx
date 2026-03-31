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
    <Card>
      <CardContent
        className="flex flex-col items-center justify-center py-14 text-center"
        role={role}
      >
        <div
          className={cn(
            'mb-4 rounded-full border p-4',
            tone === 'error'
              ? 'border-destructive/20 bg-destructive/5 text-destructive'
              : 'bg-muted/60 text-muted-foreground',
          )}
        >
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
