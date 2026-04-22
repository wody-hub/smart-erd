import type { DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ScreenDesignLibraryItem, ScreenDesignScreen } from './screen-design-document';
import {
  resolveScreenDesignLibraryCategoryLabel,
  resolveScreenDesignLibraryItemLabel,
} from './screen-design-labels';

interface ScreenDesignLibraryProps {
  screens: ScreenDesignScreen[];
  selectedScreenId: string | null;
  screenInstanceCounts: Map<string, number>;
  groupedLibraryItems: Array<[string, ScreenDesignLibraryItem[]]>;
  onAddScreen: () => void;
  onSelectScreen: (screenId: string) => void;
  onMoveScreen: (screenId: string, direction: 'up' | 'down') => void;
  onDeleteScreen: (screenId: string) => void;
  onLibraryDragStart: (event: DragEvent<HTMLButtonElement>, item: ScreenDesignLibraryItem) => void;
  onLibraryDragEnd: () => void;
}

/**
 * 화면 목록과 라이브러리 목록 pane을 렌더링한다.
 *
 * @returns 좌측 라이브러리 pane JSX
 */
export default function ScreenDesignLibrary({
  screens,
  selectedScreenId,
  screenInstanceCounts,
  groupedLibraryItems,
  onAddScreen,
  onSelectScreen,
  onMoveScreen,
  onDeleteScreen,
  onLibraryDragStart,
  onLibraryDragEnd,
}: ScreenDesignLibraryProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t('screenSpec.screenList.title')}
          </p>
          <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={onAddScreen}>
            <Plus className="mr-1 h-4 w-4" />
            {t('screenSpec.screenList.add')}
          </Button>
        </div>
        <div className="space-y-2">
          {screens.map((screen, index) => {
            const isActive = screen.id === selectedScreenId;
            const instanceCount = screenInstanceCounts.get(screen.id) ?? 0;
            return (
              <div
                key={screen.id}
                className={cn(
                  'rounded-md border border-border/70 bg-background/72 px-3 py-3',
                  isActive && 'border-primary/45 bg-primary/5',
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onSelectScreen(screen.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{screen.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {screen.width} x {screen.height}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('screenSpec.screenList.instanceCount', {
                        count: instanceCount,
                      })}
                    </span>
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => onMoveScreen(screen.id, 'up')}
                    aria-label={t('screenSpec.screenList.moveUp')}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === screens.length - 1}
                    onClick={() => onMoveScreen(screen.id, 'down')}
                    aria-label={t('screenSpec.screenList.moveDown')}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDeleteScreen(screen.id)}
                    aria-label={t('screenSpec.screenList.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 min-h-0 flex-1">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t('screenSpec.library.title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('screenSpec.library.dragHint')}</p>
        </div>

        <div className="space-y-5">
          {groupedLibraryItems.map(([groupKey, items]) => {
            const groupLabel = resolveScreenDesignLibraryCategoryLabel(t, groupKey);
            return (
              <section key={groupKey}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {groupLabel}
                </p>
                <ul aria-label={groupLabel} className="space-y-2">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        draggable
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-background/72 px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
                        onDragStart={(event) => onLibraryDragStart(event, item)}
                        onDragEnd={onLibraryDragEnd}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {resolveScreenDesignLibraryItemLabel(t, item)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.width} x {item.height}
                          </p>
                        </div>
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
