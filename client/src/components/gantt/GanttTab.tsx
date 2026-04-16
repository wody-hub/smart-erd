import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Gantt, Willow, WillowDark, type IApi, type IColumnConfig } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import { CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchMilestones } from '@/api/milestoneApi';
import { fetchWbsItems, updateWbsItem } from '@/api/wbsApi';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useProjectQueryInvalidation } from '@/hooks/useProjectQueryInvalidation';
import { getErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import useThemeStore from '@/stores/useThemeStore';
import type { UpdateWbsItemPayload, WbsItem } from '@/types/wbs';
import { buildGanttModel, type GanttTaskMeta } from './gantt-adapter';
import { expandDateRange, formatDateOnly, parseDateOnly } from './gantt-date-utils';
import { resolveWbsDateRangeUpdate } from './gantt-update-guards';
import {
  GANTT_SCALE_PRESETS,
  GANTT_SCALE_PRESET_ORDER,
  type GanttZoomPreset,
} from './gantt-scale-presets';
import './gantt.css';

/** Gantt event intercept tag to prevent duplicate bindings. */
const GANTT_INTERCEPT_TAG = 'gantt-tab-intercepts';

/** GanttTab component props. */
interface GanttTabProps {
  /** Team ID */
  teamId: string;
  /** Project ID */
  projectId: string;
  /** Whether current user can edit */
  canEdit: boolean;
}

/** Optional range override when the chart API cannot jump to today directly. */
interface GanttRangeOverride {
  start: Date;
  end: Date;
}

function buildPersistencePayload(
  item: WbsItem,
  startDate: string,
  endDate: string,
): UpdateWbsItemPayload {
  return {
    name: item.name,
    assigneeUserId: item.assigneeUserId,
    startDate,
    endDate,
    progressRate: item.progressRate,
    estimatedMm: item.estimatedMm,
    milestoneId: item.milestoneId,
  };
}

/**
 * Gantt tab that visualizes WBS + Milestone timelines and persists drag-edited dates.
 *
 * @param props GanttTab props
 * @returns Gantt tab JSX
 */
export default function GanttTab({ teamId, projectId, canEdit }: GanttTabProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const ThemeWrapper = theme === 'paper' ? Willow : WillowDark;
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);
  const [zoomPreset, setZoomPreset] = useState<GanttZoomPreset>('week');
  const [rangeOverride, setRangeOverride] = useState<GanttRangeOverride | null>(null);
  const apiRef = useRef<IApi | null>(null);
  const canEditRef = useRef(canEdit);
  const taskMetaByIdRef = useRef<Map<string, GanttTaskMeta>>(new Map());
  const wbsByIdRef = useRef<Map<number, WbsItem>>(new Map());
  const activePreset = GANTT_SCALE_PRESETS[zoomPreset];

  const wbsQuery = useQuery({
    queryKey: queryKeys.wbs.all(teamId, projectId),
    queryFn: () => fetchWbsItems(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const milestonesQuery = useQuery({
    queryKey: queryKeys.milestones.all(teamId, projectId),
    queryFn: () => fetchMilestones(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  const persistDateMutation = useMutation({
    mutationFn: ({ wbsId, payload }: { wbsId: number; payload: UpdateWbsItemPayload }) =>
      updateWbsItem(teamId, projectId, wbsId, payload),
    onSuccess: () => {
      invalidateRelatedQueries();
      toast.success(t('gantt.toast.updateSuccess'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('gantt.toast.updateFailed'))),
  });

  const model = useMemo(
    () =>
      buildGanttModel({
        wbsItems: wbsQuery.data ?? [],
        milestones: milestonesQuery.data ?? [],
      }),
    [milestonesQuery.data, wbsQuery.data],
  );

  const wbsById = useMemo(
    () => new Map((wbsQuery.data ?? []).map((item) => [item.id, item])),
    [wbsQuery.data],
  );

  const columns = useMemo<IColumnConfig[]>(
    () => [
      {
        id: 'text',
        header: t('wbs.field.name'),
        width: 300,
        flexgrow: 1,
        sort: true,
      },
      {
        id: 'start',
        header: t('wbs.form.startDate'),
        width: 132,
      },
      {
        id: 'end',
        header: t('wbs.form.endDate'),
        width: 132,
      },
      {
        id: 'progress',
        header: t('wbs.field.progressRate'),
        width: 116,
        getter: (task) => {
          if (task.kind === 'milestone') {
            return task.isDelayed ? t('gantt.legend.delayed') : t('gantt.legend.onTrack');
          }
          if (task.kind === 'summary') {
            return '-';
          }
          const progress = Number(task.progress ?? 0);
          const normalized = Math.round(Math.min(Math.max(progress, 0), 100));
          return `${normalized}%`;
        },
      },
      {
        id: 'milestoneLinks',
        header: t('wbs.field.milestone'),
        width: 120,
        getter: (task) => {
          if (task.kind !== 'milestone') {
            return '';
          }
          return task.linkedWbsItemCount ?? 0;
        },
      },
    ],
    [t],
  );

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  useEffect(() => {
    taskMetaByIdRef.current = model.taskMetaById;
    wbsByIdRef.current = wbsById;
  }, [model.taskMetaById, wbsById]);

  useEffect(() => {
    setRangeOverride(null);
  }, [model.range.end.getTime(), model.range.start.getTime()]);

  const bindInterceptors = useCallback(
    (api: IApi) => {
      api.detach(GANTT_INTERCEPT_TAG);

      api.intercept('add-task', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('delete-task', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('copy-task', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('move-task', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('indent-task', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('add-link', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('update-link', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('delete-link', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('show-editor', () => false, { tag: GANTT_INTERCEPT_TAG });
      api.intercept('split-task', () => false, { tag: GANTT_INTERCEPT_TAG });

      api.intercept(
        'drag-task',
        (event) => {
          if (!canEditRef.current) {
            return false;
          }

          if (typeof event.top !== 'undefined') {
            return false;
          }

          const meta = taskMetaByIdRef.current.get(String(event.id));
          if (!meta) {
            return false;
          }

          if (meta.kind === 'summary' || meta.kind === 'milestone') {
            return false;
          }

          return true;
        },
        { tag: GANTT_INTERCEPT_TAG },
      );

      api.intercept(
        'update-task',
        (event) => {
          if (!canEditRef.current) {
            return true;
          }

          if (event.inProgress) {
            return true;
          }

          const taskId = Number(event.id);
          if (!Number.isFinite(taskId)) {
            return false;
          }

          const meta = taskMetaByIdRef.current.get(String(event.id));
          if (!meta) {
            return false;
          }
          if (meta.kind === 'summary') {
            return true;
          }
          if (meta.kind !== 'wbs') {
            return false;
          }

          const start = event.task.start;
          const end = event.task.end;
          const original = wbsByIdRef.current.get(taskId);
          if (!original) {
            return false;
          }
          const dateRangeUpdate = resolveWbsDateRangeUpdate({
            start,
            end,
            originalStartDate: original.startDate,
            originalEndDate: original.endDate,
          });
          if (!dateRangeUpdate) {
            return false;
          }

          persistDateMutation.mutate({
            wbsId: taskId,
            payload: buildPersistencePayload(
              original,
              dateRangeUpdate.startDate,
              dateRangeUpdate.endDate,
            ),
          });
          return true;
        },
        { tag: GANTT_INTERCEPT_TAG },
      );
    },
    [persistDateMutation],
  );

  const handleGanttInit = useCallback(
    (api: IApi) => {
      apiRef.current = api;
      bindInterceptors(api);
    },
    [bindInterceptors],
  );

  const handleToday = async () => {
    const today = parseDateOnly(formatDateOnly(new Date()));
    const api = apiRef.current;

    if (api) {
      try {
        await api.exec('scroll-chart', {
          date: today,
          eventSource: 'gantt-toolbar-today',
        });
        return;
      } catch {
        // fall through to range override
      }
    }

    const padding = zoomPreset === 'day' ? 14 : zoomPreset === 'week' ? 56 : 180;
    setRangeOverride(expandDateRange(today, today, padding));
  };

  if (
    (wbsQuery.isLoading && !wbsQuery.data) ||
    (milestonesQuery.isLoading && !milestonesQuery.data)
  ) {
    return <Spinner text={t('common.loading')} />;
  }

  if (wbsQuery.isError || milestonesQuery.isError) {
    return (
      <WorkspaceEmptyState
        icon={<CalendarRange className="h-10 w-10" />}
        title={t('workspace.status.loadFailedTitle')}
        description={t('workspace.status.documentsLoadFailed')}
        tone="error"
        role="alert"
        action={
          <Button
            variant="outline"
            onClick={() => {
              void wbsQuery.refetch();
              void milestonesQuery.refetch();
            }}
          >
            {t('workspace.status.retry')}
          </Button>
        }
      />
    );
  }

  if (model.tasks.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={<CalendarRange className="h-10 w-10" />}
        title={t('gantt.empty.title')}
        description={t('gantt.empty.description')}
      />
    );
  }

  const activeRange = rangeOverride ?? model.range;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {GANTT_SCALE_PRESET_ORDER.map((preset) => {
          const isActive = preset === zoomPreset;
          return (
            <Button
              key={preset}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setZoomPreset(preset)}
            >
              {t(GANTT_SCALE_PRESETS[preset].labelKey)}
            </Button>
          );
        })}
        <Button type="button" variant="outline" size="sm" onClick={() => void handleToday()}>
          {t('gantt.toolbar.today')}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{t('gantt.description')}</p>

      <div className="gantt-shell min-h-[32rem] overflow-hidden rounded-xl border border-border/70 bg-card lg:min-h-[40rem]">
        <ThemeWrapper>
          <div className="wx-theme h-full min-h-[32rem] lg:min-h-[40rem]">
            <Gantt
              init={handleGanttInit}
              tasks={model.tasks}
              columns={columns}
              start={activeRange.start}
              end={activeRange.end}
              scales={activePreset.scales}
              cellWidth={activePreset.cellWidth}
              lengthUnit={activePreset.lengthUnit}
              readonly={!canEdit}
              links={[]}
              zoom={false}
              rollups={false}
              baselines={false}
              summary={{ autoConvert: false, autoProgress: false }}
            />
          </div>
        </ThemeWrapper>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('wbs.tab.title')}</p>
          <p className="text-sm font-semibold text-foreground">{model.stats.datedTaskCount}</p>
          <p className="text-xs text-muted-foreground">omitted {model.stats.omittedItemCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('gantt.legend.milestone')}</p>
          <p className="text-sm font-semibold text-foreground">{model.stats.milestoneCount}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('gantt.legend.milestone')}</p>
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <span className="gantt-legend-marker gantt-legend-marker--on-track" />
            {t('gantt.legend.onTrack')}
          </p>
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <span className="gantt-legend-marker gantt-legend-marker--delayed" />
            {t('gantt.legend.delayed')}
          </p>
        </div>
      </div>

      <p className={cn('text-xs text-muted-foreground')}>
        {canEdit ? t('wbs.dnd.hint') : t('gantt.description')}
      </p>
    </div>
  );
}
