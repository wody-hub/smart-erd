import { Card, CardContent } from '@/components/ui/card';

interface ProjectWorkspaceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  meta?: React.ReactNode;
  primaryAction?: React.ReactNode;
  utilityActions?: React.ReactNode;
}

export default function ProjectWorkspaceHero({
  eyebrow,
  title,
  description,
  meta,
  primaryAction,
  utilityActions,
}: ProjectWorkspaceHeroProps) {
  return (
    <Card className="border-border/70 bg-gradient-to-br from-background via-background to-muted/50">
      <CardContent className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            {meta && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{meta}</div>}
          </div>
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {utilityActions && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
            {utilityActions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
