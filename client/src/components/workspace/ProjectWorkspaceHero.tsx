import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const HERO_TONE_CLASSES = {
  teams: 'surface-display--teams',
  projects: 'surface-display--projects',
  documents: 'surface-display--documents',
  dictionary: 'surface-display--dictionary',
} as const;

type ProjectWorkspaceHeroTone = keyof typeof HERO_TONE_CLASSES;

interface ProjectWorkspaceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  meta?: React.ReactNode;
  primaryAction?: React.ReactNode;
  utilityActions?: React.ReactNode;
  tone?: ProjectWorkspaceHeroTone;
  className?: string;
}

export default function ProjectWorkspaceHero({
  eyebrow,
  title,
  description,
  meta,
  primaryAction,
  utilityActions,
  tone = 'projects',
  className,
}: ProjectWorkspaceHeroProps) {
  return (
    <Card
      className={cn(
        'surface-display relative overflow-hidden border-border/90',
        HERO_TONE_CLASSES[tone],
        className,
      )}
    >
      <CardContent className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="workspace-kicker">{eyebrow}</p>
            <h1 className="mt-4 max-w-3xl font-display text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground md:text-[3.15rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-[0.97rem] leading-7 text-ink-secondary">
              {description}
            </p>
            {meta && (
              <div className="mt-5 flex flex-wrap items-center gap-2 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:rounded-full [&>span]:border [&>span]:border-border/80 [&>span]:bg-card/80 [&>span]:px-3 [&>span]:py-1.5 [&>span]:text-[0.72rem] [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[0.12em] [&>span]:text-ink-secondary">
                {meta}
              </div>
            )}
          </div>
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {utilityActions && (
          <div className="-mx-6 -mb-6 flex flex-col gap-3 border-t border-border/70 bg-secondary/70 px-6 pb-6 pt-4 md:-mx-8 md:-mb-8 md:px-8 md:pb-8 lg:flex-row lg:items-end lg:justify-between">
            {utilityActions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
