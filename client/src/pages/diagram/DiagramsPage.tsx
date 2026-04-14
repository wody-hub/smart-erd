import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ClipboardList, FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import BusinessOverviewTab from '@/components/project/BusinessOverviewTab';
import DocumentHubTabContent from '@/components/workspace/DocumentHubTabContent';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import { getWorkspaceDocumentsTitleLabel } from '@/lib/workspace-labels';

/**
 * 문서 허브 페이지.
 *
 * ERD와 Markdown 문서를 같은 프로젝트 허브에서 관리한다.
 *
 * @returns 프로젝트 문서 허브 JSX
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'documents' | 'overview'>('documents');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const { recordRecentProjectContext } = useRecentProjectContext(teamId);
  const { canEdit } = useTeamRole(teamId);

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
  const documentTitleToken = getWorkspaceDocumentsTitleLabel();

  /**
   * 탭 전환 시 overview로 이동하면 문서 생성 다이얼로그를 닫는다.
   *
   * @param value 다음 탭 값
   */
  const handleTabChange = (value: string) => {
    const nextTab = value === 'overview' ? 'overview' : 'documents';
    if (nextTab !== 'documents') {
      setCreateDialogOpen(false);
    }
    setActiveTab(nextTab);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header
        workspaceContext={{
          team: team ? { id: teamId!, name: team.name } : undefined,
          project: project ? { id: projectId!, name: project.name } : undefined,
          section: 'documents',
        }}
      />
      <main className="workspace-shell flex-1 overflow-auto p-6">
        <div className="workspace-container max-w-5xl">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('diagram.list.backToProjects')}
          </Button>

          <ProjectWorkspaceHero
            eyebrow={t(documentTitleToken.key)}
            title={project?.name ?? t('common.loading')}
            description={project?.description || t('workspace.documents.description')}
            tone="documents"
            meta={
              <>
                {team && <span>{t('workspace.meta.teamContext', { name: team.name })}</span>}
                <span>{t('workspace.documents.documentCount', { count: documentCount })}</span>
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
              activeTab === 'documents' ? (
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                  <p className="max-w-md text-sm leading-6 text-muted-foreground">
                    {t('workspace.documents.multiTypeHint')}
                  </p>
                </div>
              ) : undefined
            }
          />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
            <TabsList>
              <TabsTrigger value="documents">
                <FileText className="mr-2 h-4 w-4" />
                {t('businessOverview.documentsTab')}
              </TabsTrigger>
              <TabsTrigger value="overview">
                <ClipboardList className="mr-2 h-4 w-4" />
                {t('businessOverview.tab.title')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents">
              <DocumentHubTabContent
                teamId={teamId!}
                projectId={projectId!}
                canEdit={canEdit}
                createDialogOpen={createDialogOpen}
                onCreateDialogOpenChange={setCreateDialogOpen}
                onDocumentCountChange={setDocumentCount}
              />
            </TabsContent>

            <TabsContent value="overview">
              <BusinessOverviewTab teamId={teamId!} projectId={projectId!} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
