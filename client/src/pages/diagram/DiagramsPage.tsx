import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  BotMessageSquare,
  CalendarRange,
  CircleAlert,
  ClipboardList,
  FileText,
  Hash,
  ListTree,
  ListTodo,
  Plus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  fetchProjectWorkspaceTabOrder,
  updateProjectWorkspaceTabOrder,
} from '@/api/userSettingsApi';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import Header from '@/components/layout/Header';
import BusinessOverviewTab from '@/components/project/BusinessOverviewTab';
import MyTasksTab from '@/components/project/MyTasksTab';
import ProjectAiHistoryTab from '@/components/project/ProjectAiHistoryTab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GanttTab from '@/components/gantt/GanttTab';
import IssuesTab from '@/components/issues/IssuesTab';
import StaffingTab from '@/components/staffing/StaffingTab';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import DocumentHubTabContent from '@/components/workspace/DocumentHubTabContent';
import TagsTab from '@/components/wbs/TagsTab';
import WbsTab from '@/components/wbs/WbsTab';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import { getErrorMessage } from '@/lib/api-error';
import {
  resolveProjectWorkspaceTabOrder,
  type ProjectWorkspaceTabValue,
} from '@/lib/project-workspace-tab-order';
import { cn } from '@/lib/utils';
import { getWorkspaceDocumentsTitleLabel } from '@/lib/workspace-labels';

type DiagramsTabValue = ProjectWorkspaceTabValue;

interface DiagramsTabRenderContext {
  teamId: string;
  projectId: string;
  canEdit: boolean;
  createDialogOpen: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  onDocumentCountChange: (count: number) => void;
}

interface DiagramsTabConfig {
  value: DiagramsTabValue;
  label: string;
  icon: LucideIcon;
  renderContent: (context: DiagramsTabRenderContext) => ReactNode;
}

interface DiagramsRouteState {
  initialTab?: DiagramsTabValue;
}

interface SortableProjectWorkspaceTabTriggerProps {
  tab: DiagramsTabConfig;
}

/**
 * 드래그 가능한 프로젝트 작업공간 탭 트리거.
 *
 * @param props 탭 렌더링 설정
 * @returns 정렬 가능한 탭 트리거 JSX
 */
function SortableProjectWorkspaceTabTrigger({ tab }: SortableProjectWorkspaceTabTriggerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.value,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TabsTrigger
      ref={setNodeRef}
      value={tab.value}
      style={style}
      className={cn(
        'px-3 text-xs sm:px-4 sm:text-sm',
        isDragging && 'opacity-80 shadow-operational',
      )}
      {...attributes}
      {...listeners}
    >
      <tab.icon className="mr-0 hidden h-4 w-4 sm:mr-2 sm:block" />
      <span className="truncate">{tab.label}</span>
    </TabsTrigger>
  );
}

/**
 * 문서 허브 페이지.
 *
 * ERD와 Markdown 문서를 같은 프로젝트 허브에서 관리한다.
 *
 * @returns 프로젝트 문서 허브 JSX
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const routeState = location.state as DiagramsRouteState | undefined;
  const [activeTab, setActiveTab] = useState<DiagramsTabValue>(
    routeState?.initialTab ?? 'documents',
  );
  const [tabOrder, setTabOrder] = useState<DiagramsTabValue[]>(() =>
    resolveProjectWorkspaceTabOrder([]),
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const { recordRecentProjectContext } = useRecentProjectContext(teamId);
  const { role, canEdit } = useTeamRole(teamId);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(teamId!, projectId!),
    queryFn: () => fetchProject(teamId!, projectId!),
    enabled: !!teamId && !!projectId,
  });
  const projectWorkspaceTabOrderQuery = useQuery({
    queryKey: queryKeys.settings.projectWorkspaceTabs(),
    queryFn: fetchProjectWorkspaceTabOrder,
  });

  const saveTabOrderMutation = useMutation({
    mutationFn: (nextTabOrder: DiagramsTabValue[]) =>
      updateProjectWorkspaceTabOrder({ tabOrder: nextTabOrder }),
  });
  const documentTitleToken = getWorkspaceDocumentsTitleLabel();
  const guideRoute =
    activeTab === 'documents'
      ? ROUTES.GUIDE_ENTRY({
          source: 'documents',
          teamId: teamId!,
          projectId: projectId!,
          hash: 'guide-document-hub',
        })
      : ROUTES.GUIDE_ENTRY({
          source:
            activeTab === 'tags'
              ? 'documents'
              : activeTab === 'myTasks' || activeTab === 'aiHistory'
                ? 'overview'
                : activeTab,
          teamId: teamId!,
          projectId: projectId!,
          hash: 'guide-project-hub',
        });

  const heroCopy =
    activeTab === 'documents'
      ? {
          section: 'documents' as const,
          tone: 'documents' as const,
          eyebrow: t(documentTitleToken.key),
          description: project?.description || t('workspace.documents.description'),
          metaDetail: t('workspace.documents.documentCount', { count: documentCount }),
        }
      : activeTab === 'overview'
        ? {
            section: 'projects' as const,
            tone: 'projects' as const,
            eyebrow: t('businessOverview.tab.title'),
            description: project?.description || t('workspace.projectHub.overviewDescription'),
            metaDetail: t('workspace.projectHub.overviewMeta'),
          }
        : activeTab === 'tags'
          ? {
              section: 'projects' as const,
              tone: 'projects' as const,
              eyebrow: t('workspace.tags.title'),
              description: t('workspace.tags.description'),
              metaDetail: t('workspace.projectHub.tagsMeta'),
            }
          : activeTab === 'wbs'
            ? {
                section: 'projects' as const,
                tone: 'projects' as const,
                eyebrow: t('wbs.tab.title'),
                description: t('wbs.section.description'),
                metaDetail: t('workspace.projectHub.wbsMeta'),
              }
            : activeTab === 'myTasks'
              ? {
                  section: 'projects' as const,
                  tone: 'projects' as const,
                  eyebrow: t('myTasks.tab.title'),
                  description: t('myTasks.section.description'),
                  metaDetail: t('workspace.projectHub.myTasksMeta'),
                }
              : activeTab === 'gantt'
                ? {
                    section: 'projects' as const,
                    tone: 'projects' as const,
                    eyebrow: t('gantt.tab.title'),
                    description: t('workspace.projectHub.ganttDescription'),
                    metaDetail: t('workspace.projectHub.ganttMeta'),
                  }
                : activeTab === 'staffing'
                  ? {
                      section: 'projects' as const,
                      tone: 'projects' as const,
                      eyebrow: t('staffing.tab.title'),
                      description: t('staffing.section.description'),
                      metaDetail: t('workspace.projectHub.staffingMeta'),
                    }
                  : activeTab === 'aiHistory'
                    ? {
                        section: 'projects' as const,
                        tone: 'projects' as const,
                        eyebrow: t('aiHistory.title'),
                        description: t('workspace.projectHub.aiHistoryDescription'),
                        metaDetail: t('workspace.projectHub.aiHistoryMeta'),
                      }
                    : {
                        section: 'projects' as const,
                        tone: 'projects' as const,
                        eyebrow: t('issues.tab.title'),
                        description: t('issues.section.description'),
                        metaDetail: t('workspace.projectHub.issuesMeta'),
                      };

  const tabs: DiagramsTabConfig[] = useMemo(
    () => [
      {
        value: 'overview',
        label: t('businessOverview.tab.title'),
        icon: ClipboardList,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <BusinessOverviewTab
            teamId={currentTeamId}
            projectId={currentProjectId}
            canEdit={currentCanEdit}
          />
        ),
      },
      {
        value: 'documents',
        label: t('businessOverview.documentsTab'),
        icon: FileText,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
          createDialogOpen: currentCreateDialogOpen,
          onCreateDialogOpenChange,
          onDocumentCountChange,
        }) => (
          <DocumentHubTabContent
            teamId={currentTeamId}
            projectId={currentProjectId}
            canEdit={currentCanEdit}
            createDialogOpen={currentCreateDialogOpen}
            onCreateDialogOpenChange={onCreateDialogOpenChange}
            onDocumentCountChange={onDocumentCountChange}
          />
        ),
      },
      {
        value: 'tags',
        label: t('workspace.tags.title'),
        icon: Hash,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <TagsTab teamId={currentTeamId} projectId={currentProjectId} canEdit={currentCanEdit} />
        ),
      },
      {
        value: 'wbs',
        label: t('wbs.tab.title'),
        icon: ListTree,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <WbsTab teamId={currentTeamId} projectId={currentProjectId} canEdit={currentCanEdit} />
        ),
      },
      {
        value: 'myTasks',
        label: t('myTasks.tab.title'),
        icon: ListTodo,
        renderContent: ({ teamId: currentTeamId, projectId: currentProjectId }) => (
          <MyTasksTab
            teamId={currentTeamId}
            projectId={currentProjectId}
            canManagePersonalTodos={role != null}
          />
        ),
      },
      {
        value: 'gantt',
        label: t('gantt.tab.title'),
        icon: CalendarRange,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <GanttTab teamId={currentTeamId} projectId={currentProjectId} canEdit={currentCanEdit} />
        ),
      },
      {
        value: 'staffing',
        label: t('staffing.tab.title'),
        icon: UsersRound,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <StaffingTab
            teamId={currentTeamId}
            projectId={currentProjectId}
            canEdit={currentCanEdit}
          />
        ),
      },
      {
        value: 'issues',
        label: t('issues.tab.title'),
        icon: CircleAlert,
        renderContent: ({
          teamId: currentTeamId,
          projectId: currentProjectId,
          canEdit: currentCanEdit,
        }) => (
          <IssuesTab teamId={currentTeamId} projectId={currentProjectId} canEdit={currentCanEdit} />
        ),
      },
      {
        value: 'aiHistory',
        label: t('aiHistory.tab.title'),
        icon: BotMessageSquare,
        renderContent: ({ teamId: currentTeamId, projectId: currentProjectId }) => (
          <ProjectAiHistoryTab teamId={currentTeamId} projectId={currentProjectId} />
        ),
      },
    ],
    [role, t],
  );
  const tabByValue = useMemo(() => new Map(tabs.map((tab) => [tab.value, tab])), [tabs]);
  const orderedTabs = useMemo(
    () =>
      tabOrder
        .map((value) => tabByValue.get(value))
        .filter((tab): tab is DiagramsTabConfig => tab != null),
    [tabByValue, tabOrder],
  );

  /**
   * 탭 전환 시 overview로 이동하면 문서 생성 다이얼로그를 닫는다.
   *
   * @param value 다음 탭 값
   * @returns 없음
   */
  const handleTabChange = (value: string) => {
    const nextTab = tabs.find((tab) => tab.value === value)?.value ?? 'documents';
    if (nextTab !== 'documents') {
      setCreateDialogOpen(false);
    }
    setActiveTab(nextTab);
  };

  /**
   * 탭 드래그 종료 시 사용자별 탭 순서를 저장한다.
   *
   * @param event 드래그 종료 이벤트
   * @returns 없음
   */
  const handleTabDragEnd = ({ active, over }: DragEndEvent) => {
    if (over == null || active.id === over.id) {
      return;
    }

    setTabOrder((current) => {
      const activeIndex = current.indexOf(active.id as DiagramsTabValue);
      const overIndex = current.indexOf(over.id as DiagramsTabValue);
      if (activeIndex === -1 || overIndex === -1) {
        return current;
      }

      const next = arrayMove(current, activeIndex, overIndex);
      saveTabOrderMutation.mutate(next, {
        onError: (error) => {
          setTabOrder(current);
          toast.error(getErrorMessage(error, t('workspace.projectHub.tabOrderUpdateFailed')));
        },
      });
      return next;
    });
  };

  useEffect(() => {
    if (!projectWorkspaceTabOrderQuery.data?.tabOrder) {
      return;
    }
    setTabOrder(resolveProjectWorkspaceTabOrder(projectWorkspaceTabOrderQuery.data.tabOrder));
  }, [projectWorkspaceTabOrderQuery.data]);

  return (
    <div className="flex h-screen flex-col">
      <Header
        workspaceContext={{
          team: team ? { id: teamId!, name: team.name } : undefined,
          project: project ? { id: projectId!, name: project.name } : undefined,
          section: heroCopy.section,
        }}
      />
      <main className="workspace-shell flex-1 overflow-auto p-3 sm:p-6">
        <div
          className={cn(
            'workspace-container',
            activeTab === 'gantt' ||
              activeTab === 'staffing' ||
              activeTab === 'issues' ||
              activeTab === 'aiHistory'
              ? 'max-w-none'
              : 'max-w-5xl',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 sm:mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('diagram.list.backToProjects')}
          </Button>

          <ProjectWorkspaceHero
            eyebrow={heroCopy.eyebrow}
            title={project?.name ?? t('common.loading')}
            description={heroCopy.description}
            tone={heroCopy.tone}
            meta={
              <>
                {team && <span>{t('workspace.meta.teamContext', { name: team.name })}</span>}
                <span>{heroCopy.metaDetail}</span>
              </>
            }
            primaryAction={
              canEdit && activeTab === 'documents' ? (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('workspace.action.newDocument')}
                </Button>
              ) : undefined
            }
            utilityActions={
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === 'documents' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        recordRecentProjectContext(projectId!);
                        navigate(ROUTES.DICTIONARY(teamId!));
                      }}
                    >
                      <BookOpen className="mr-2 h-4 w-4 text-brand-secondary" />
                      {t('project.list.dictionaryButton')}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate(guideRoute)}>
                    <BookOpen className="mr-2 h-4 w-4 text-primary" />
                    {t('guide.entry.workspace')}
                  </Button>
                </div>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {activeTab === 'documents'
                    ? t('workspace.documents.multiTypeHint')
                    : t('guide.entry.workspaceHint')}
                </p>
              </div>
            }
          />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 sm:mt-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTabDragEnd}
            >
              <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
                <TabsList className="gap-1">
                  {orderedTabs.map((tab) => (
                    <SortableProjectWorkspaceTabTrigger key={tab.value} tab={tab} />
                  ))}
                </TabsList>
              </SortableContext>
            </DndContext>

            {orderedTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.renderContent({
                  teamId: teamId!,
                  projectId: projectId!,
                  canEdit,
                  createDialogOpen,
                  onCreateDialogOpenChange: setCreateDialogOpen,
                  onDocumentCountChange: setDocumentCount,
                })}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
}
