import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Gantt, Willow, WillowDark, type IApi, type IColumnConfig } from '@svar-ui/react-gantt';
import { setID } from '@svar-ui/lib-dom';
import '@svar-ui/react-gantt/all.css';
import { CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchMilestones } from '@/api/milestoneApi';
import { fetchWbsDependencies } from '@/api/wbsDependencyApi';
import { fetchWbsItems, updateWbsItem } from '@/api/wbsApi';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
import { applyExpandedTaskState, collectExpandableTaskIds } from './gantt-tree-utils';
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

type GanttViewFilter = 'all' | 'milestones' | 'delayed';

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
  const isSmallViewport = useMediaQuery('(max-width: 640px)');
  const ThemeWrapper = theme === 'paper' ? Willow : WillowDark;
  const invalidateRelatedQueries = useProjectQueryInvalidation(teamId, projectId);
  const [zoomPreset, setZoomPreset] = useState<GanttZoomPreset>('day');
  const [isApiReady, setIsApiReady] = useState(false);
  const [rangeOverride, setRangeOverride] = useState<GanttRangeOverride | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<GanttViewFilter>('all');
  const ganttShellRef = useRef<HTMLDivElement | null>(null);
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

  const dependenciesQuery = useQuery({
    queryKey: queryKeys.wbs.dependencies(teamId, projectId),
    queryFn: () => fetchWbsDependencies(teamId, projectId),
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
        dependencies: dependenciesQuery.data ?? [],
      }),
    [dependenciesQuery.data, milestonesQuery.data, wbsQuery.data],
  );
  const rangeStartMs = model.range.start.getTime();
  const rangeEndMs = model.range.end.getTime();
  const expandableTaskIds = useMemo(() => collectExpandableTaskIds(model.tasks), [model.tasks]);
  const expandableTaskIdSet = useMemo(
    () => new Set(expandableTaskIds.map((taskId) => String(taskId))),
    [expandableTaskIds],
  );
  const renderedTasks = useMemo(
    () => applyExpandedTaskState(model.tasks, expandedTaskIds),
    [expandedTaskIds, model.tasks],
  );
  const filteredTasks = useMemo(() => {
    if (viewFilter === 'milestones') {
      return renderedTasks.filter((task) => task.kind === 'milestone');
    }

    if (viewFilter === 'delayed') {
      return renderedTasks.filter((task) => task.kind === 'milestone' && task.isDelayed);
    }

    return renderedTasks;
  }, [renderedTasks, viewFilter]);
  const filteredTaskIdSet = useMemo(
    () => new Set(filteredTasks.map((task) => String(task.id))),
    [filteredTasks],
  );
  const filteredLinks = useMemo(
    () =>
      model.links.filter(
        (link) =>
          filteredTaskIdSet.has(String(link.source)) && filteredTaskIdSet.has(String(link.target)),
      ),
    [filteredTaskIdSet, model.links],
  );

  const wbsById = useMemo(
    () => new Map((wbsQuery.data ?? []).map((item) => [item.id, item])),
    [wbsQuery.data],
  );

  const columns = useMemo<IColumnConfig[]>(() => {
    if (isSmallViewport) {
      return [];
    }

    return [
      {
        id: 'text',
        header: t('wbs.field.name'),
        width: 320,
        resize: false,
        sort: true,
      },
      {
        id: 'start',
        header: t('wbs.form.startDate'),
        width: 132,
        resize: false,
      },
      {
        id: 'end',
        header: t('wbs.form.endDate'),
        width: 132,
        resize: false,
      },
      {
        id: 'progress',
        header: t('wbs.field.progressRate'),
        width: 96,
        resize: false,
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
    ];
  }, [isSmallViewport, t]);

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  useEffect(() => {
    taskMetaByIdRef.current = model.taskMetaById;
    wbsByIdRef.current = wbsById;
  }, [model.taskMetaById, wbsById]);

  useEffect(() => {
    setExpandedTaskIds((current) => {
      const next = new Set<string>();
      let changed = current.size !== expandableTaskIdSet.size;

      current.forEach((taskId) => {
        if (expandableTaskIdSet.has(taskId)) {
          next.add(taskId);
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [expandableTaskIdSet]);

  useEffect(() => {
    setRangeOverride(null);
  }, [rangeEndMs, rangeStartMs]);

  useEffect(() => {
    if (selectedTaskId && !filteredTaskIdSet.has(selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [filteredTaskIdSet, selectedTaskId]);

  const applyVisualStates = useCallback(() => {
    const root = ganttShellRef.current;
    if (!root) {
      return;
    }

    const elementsById = new Map<string, HTMLElement[]>();
    root.querySelectorAll<HTMLElement>('[data-id]').forEach((element) => {
      const encodedId = element.getAttribute('data-id');
      if (!encodedId) {
        return;
      }
      const current = elementsById.get(encodedId) ?? [];
      current.push(element);
      elementsById.set(encodedId, current);
    });

    const resetClasses = [
      'gantt-task--has-dependency',
      'gantt-task--milestone-linked',
      'gantt-task--selected',
      'gantt-task--predecessor',
      'gantt-task--successor',
      'gantt-task--selected-milestone',
      'gantt-link--dependency',
      'gantt-link--milestone',
      'gantt-link--predecessor',
      'gantt-link--successor',
      'gantt-link--selected-milestone',
    ];

    elementsById.forEach((elements) => {
      elements.forEach((element) => {
        resetClasses.forEach((className) => element.classList.remove(className));
      });
    });

    const barsById = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('.wx-bar.wx-milestone[data-id]').forEach((bar) => {
      const encodedId = bar.getAttribute('data-id');
      if (encodedId) {
        barsById.set(encodedId, bar);
      }
    });

    const selectedMeta = selectedTaskId ? (model.taskMetaById.get(selectedTaskId) ?? null) : null;
    const predecessorSet = new Set(selectedMeta?.predecessorTaskIds ?? []);
    const successorSet = new Set(selectedMeta?.successorTaskIds ?? []);
    const selectedMilestoneTaskId = selectedMeta?.milestoneTaskId ?? null;

    filteredTasks.forEach((task) => {
      const encodedTaskId = String(setID(String(task.id)));
      const taskMeta = model.taskMetaById.get(String(task.id));
      const taskElements = elementsById.get(encodedTaskId) ?? [];

      if (taskMeta) {
        taskElements.forEach((element) => {
          element.classList.toggle('gantt-task--has-dependency', taskMeta.hasDependencies);
          element.classList.toggle(
            'gantt-task--milestone-linked',
            taskMeta.milestoneTaskId != null,
          );
          element.classList.toggle('gantt-task--selected', selectedTaskId === String(task.id));
          element.classList.toggle('gantt-task--predecessor', predecessorSet.has(String(task.id)));
          element.classList.toggle('gantt-task--successor', successorSet.has(String(task.id)));
          element.classList.toggle(
            'gantt-task--selected-milestone',
            selectedMilestoneTaskId === String(task.id),
          );
        });
      }

      if (task.kind !== 'milestone') {
        return;
      }

      const bar = barsById.get(encodedTaskId);
      if (!bar) {
        return;
      }

      const fillColor = task.isDelayed ? 'hsl(var(--destructive))' : 'hsl(var(--success))';
      const content = bar.querySelector<HTMLElement>('.wx-content');

      bar.style.borderColor = fillColor;
      if (content) {
        content.style.backgroundColor = fillColor;
      }
    });

    filteredLinks.forEach((link) => {
      const encodedLinkId = String(setID(link.id));
      const linkElements = elementsById.get(encodedLinkId) ?? [];
      const isSelectedPredecessorLink =
        selectedTaskId != null &&
        predecessorSet.has(String(link.source)) &&
        String(link.target) === selectedTaskId;
      const isSelectedSuccessorLink =
        selectedTaskId != null &&
        String(link.source) === selectedTaskId &&
        successorSet.has(String(link.target));
      const isSelectedMilestoneLink =
        selectedTaskId != null &&
        link.kind === 'milestone' &&
        String(link.source) === selectedTaskId;

      linkElements.forEach((element) => {
        element.classList.toggle('gantt-link--dependency', link.kind === 'dependency');
        element.classList.toggle('gantt-link--milestone', link.kind === 'milestone');
        element.classList.toggle('gantt-link--predecessor', isSelectedPredecessorLink);
        element.classList.toggle('gantt-link--successor', isSelectedSuccessorLink);
        element.classList.toggle('gantt-link--selected-milestone', isSelectedMilestoneLink);
      });
    });
  }, [filteredLinks, filteredTasks, model.taskMetaById, selectedTaskId]);

  useEffect(() => {
    const root = ganttShellRef.current;
    if (!root) {
      return;
    }

    applyVisualStates();

    if (typeof MutationObserver === 'undefined') {
      return;
    }

    const observer = new MutationObserver(() => {
      applyVisualStates();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [applyVisualStates]);

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
        'open-task',
        ({ id, mode }) => {
          const normalizedId = String(id);
          if (!expandableTaskIdSet.has(normalizedId)) {
            return true;
          }

          setExpandedTaskIds((current) => {
            const isAlreadyExpanded = current.has(normalizedId);
            if (mode === isAlreadyExpanded) {
              return current;
            }

            const next = new Set(current);
            if (mode) {
              next.add(normalizedId);
            } else {
              next.delete(normalizedId);
            }
            return next;
          });

          return true;
        },
        { tag: GANTT_INTERCEPT_TAG },
      );
      api.intercept(
        'select-task',
        ({ id }) => {
          setSelectedTaskId(String(id));
          return true;
        },
        { tag: GANTT_INTERCEPT_TAG },
      );

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
    [expandableTaskIdSet, persistDateMutation],
  );

  const handleGanttInit = useCallback(
    (api: IApi) => {
      apiRef.current = api;
      setIsApiReady(true);
      bindInterceptors(api);
    },
    [bindInterceptors],
  );

  const handleToggleAllBranches = useCallback(
    (mode: boolean) => {
      setExpandedTaskIds(mode ? new Set(expandableTaskIdSet) : new Set());
    },
    [expandableTaskIdSet],
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
    (milestonesQuery.isLoading && !milestonesQuery.data) ||
    (dependenciesQuery.isLoading && !dependenciesQuery.data)
  ) {
    return <Spinner text={t('common.loading')} />;
  }

  if (wbsQuery.isError || milestonesQuery.isError || dependenciesQuery.isError) {
    return (
      <WorkspaceEmptyState
        icon={<CalendarRange className="h-10 w-10" />}
        title={t('gantt.status.loadFailedTitle')}
        description={t('gantt.status.loadFailed')}
        tone="error"
        role="alert"
        action={
          <Button
            variant="outline"
            onClick={() => {
              void wbsQuery.refetch();
              void milestonesQuery.refetch();
              void dependenciesQuery.refetch();
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
  const focusMilestone = model.waveSummary.focusMilestone;
  const hasFilteredTasks = filteredTasks.length > 0;

  return (
    <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
      <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('gantt.wave.currentWave')}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {t('gantt.wave.currentWaveValue', {
              count: model.waveSummary.currentWaveTaskCount,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('gantt.wave.currentWaveHint', {
              completed: model.waveSummary.currentWaveCompletedTaskCount,
              total: model.waveSummary.currentWaveTaskCount,
              unplanned: model.waveSummary.unplannedTaskCount,
            })}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('gantt.wave.nextMilestone')}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {focusMilestone?.name ?? t('gantt.wave.noMilestone')}
          </p>
          <p className="text-xs text-muted-foreground">
            {focusMilestone
              ? t('gantt.wave.nextMilestoneHint', {
                  date: focusMilestone.targetDate,
                  count: focusMilestone.linkedWbsItemCount,
                  status: focusMilestone.isDelayed
                    ? t('gantt.legend.delayed')
                    : t('gantt.legend.onTrack'),
                })
              : t('gantt.wave.noMilestoneHint')}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('gantt.wave.futureCandidates')}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {t('gantt.wave.futureCandidatesValue', {
              milestoneCount: model.waveSummary.futureMilestoneCount,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('gantt.wave.futureCandidatesHint', {
              count: model.waveSummary.futureTaskCount,
            })}
          </p>
        </div>
      </div>

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isApiReady || expandableTaskIds.length === 0}
          onClick={() => void handleToggleAllBranches(true)}
        >
          {t('gantt.toolbar.expandAll')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isApiReady || expandableTaskIds.length === 0}
          onClick={() => void handleToggleAllBranches(false)}
        >
          {t('gantt.toolbar.collapseAll')}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(['all', 'milestones', 'delayed'] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              variant={viewFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewFilter(filter)}
            >
              {t(`gantt.filters.${filter}`)}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t('gantt.description')}</p>

      <div
        ref={ganttShellRef}
        className="gantt-shell min-h-[27rem] overflow-hidden rounded-xl border border-border/70 bg-card sm:min-h-[32rem] lg:min-h-[40rem]"
      >
        {hasFilteredTasks ? (
          <ThemeWrapper>
            <div className="wx-theme h-full min-h-[27rem] sm:min-h-[32rem] lg:min-h-[40rem]">
              <Gantt
                init={handleGanttInit}
                tasks={filteredTasks}
                columns={columns}
                start={activeRange.start}
                end={activeRange.end}
                scales={activePreset.scales}
                cellWidth={activePreset.cellWidth}
                lengthUnit={activePreset.lengthUnit}
                readonly={!canEdit}
                links={filteredLinks}
                zoom={false}
                rollups={false}
                baselines={false}
                criticalPath={{ type: 'strict' }}
                summary={{ autoConvert: false, autoProgress: false }}
              />
            </div>
          </ThemeWrapper>
        ) : (
          <div className="flex min-h-[27rem] items-center justify-center px-6 text-center sm:min-h-[32rem] lg:min-h-[40rem]">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {t('gantt.filters.emptyTitle')}
              </p>
              <p className="text-sm text-muted-foreground">{t('gantt.filters.emptyDescription')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('wbs.tab.title')}</p>
          <p className="text-sm font-semibold text-foreground">{model.stats.datedTaskCount}</p>
          <p className="text-xs text-muted-foreground">
            {t('gantt.stats.omitted', { count: model.stats.omittedItemCount })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('gantt.legend.dependencies')}</p>
          <p className="text-sm font-semibold text-foreground">{model.stats.dependencyCount}</p>
          <p className="text-xs text-muted-foreground">
            {t('gantt.stats.dependencyTasks', { count: model.stats.dependencyTaskCount })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('gantt.legend.milestone')}</p>
          <p className="text-sm font-semibold text-foreground">{model.stats.milestoneCount}</p>
          <p className="text-xs text-muted-foreground">
            {t('gantt.stats.milestoneFlow', { count: model.stats.milestoneFlowCount })}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('gantt.legend.title')}</p>
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <span className="gantt-legend-line gantt-legend-line--dependency" />
            {t('gantt.legend.hasDependencies')}
          </p>
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <span className="gantt-legend-line gantt-legend-line--milestone" />
            {t('gantt.legend.linkedToMilestone')}
          </p>
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
        {canEdit ? t('gantt.dnd.hint') : t('gantt.readOnly.hint')}
      </p>
    </div>
  );
}
