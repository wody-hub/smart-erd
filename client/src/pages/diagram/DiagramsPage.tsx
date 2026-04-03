import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchDiagrams } from '@/api/diagramApi';
import { fetchDictionarySets } from '@/api/dictionarySetApi';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import DocumentHubRow from '@/components/workspace/DocumentHubRow';
import DocumentTypeBadge from '@/components/workspace/DocumentTypeBadge';
import CreateDocumentDialog from '@/components/workspace/CreateDocumentDialog';
import ProjectWorkspaceHero from '@/components/workspace/ProjectWorkspaceHero';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Header from '@/components/layout/Header';
import Spinner from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useDiagramDocumentHubActions } from '@/hooks/useDiagramDocumentHubActions';
import { useRecentProjectContext } from '@/hooks/useRecentProjectContext';
import { useTeamRole } from '@/hooks/useTeamRole';
import { getWorkspaceDocumentsTitleLabel } from '@/lib/workspace-labels';
import type { DocumentListItem } from '@/types/workspace';

/**
 * 문서 허브 페이지.
 *
 * ERD와 Markdown 문서를 같은 프로젝트 허브에서 관리한다.
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
  const { data: dictionarySets = [] } = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId!),
    queryFn: () => fetchDictionarySets(teamId!),
    enabled: !!teamId,
  });
  const diagramsQuery = useQuery({
    queryKey: queryKeys.diagrams.byProject(teamId!, projectId!),
    queryFn: () => fetchDiagrams(teamId!, projectId!),
    enabled: !!teamId && !!projectId,
  });
  const { data: diagrams = [], isLoading, isError } = diagramsQuery;

  const {
    dialogOpen,
    setDialogOpen,
    deleteTarget,
    setDeleteTarget,
    renamingId,
    renameValue,
    setRenameValue,
    startRename,
    confirmRename,
    cancelRename,
    createDocument,
    confirmDeleteDocument,
    updateDictionaryContext,
    deleteDocumentPending,
  } = useDiagramDocumentHubActions({
    teamId,
    projectId,
  });

  const documentTitleToken = getWorkspaceDocumentsTitleLabel();
  const documentItems = useMemo<DocumentListItem[]>(
    () =>
      diagrams.map((diagram) => ({
        id: diagram.id,
        name: diagram.name,
        type: diagram.pluginId,
        updatedAt: diagram.updatedAt,
        dictionaryContextName: diagram.pluginId === 'erd' ? diagram.dictionarySetName : null,
        templateLabel: diagram.templateLabel,
        summaryText: diagram.summaryText,
      })),
    [diagrams],
  );

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
                <span>{t('workspace.documents.documentCount', { count: diagrams.length })}</span>
              </>
            }
            primaryAction={
              canEdit ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('workspace.action.newDocument')}
                </Button>
              ) : undefined
            }
            utilityActions={
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
            }
          />

          <div className="surface-operational mt-6 rounded-xl px-4 py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <DocumentTypeBadge documentType="erd" />
                <DocumentTypeBadge documentType="markdown" />
                <p className="text-sm text-ink-secondary">
                  {t('workspace.documents.typeScopeHint')}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {t('workspace.documents.documentCount', { count: diagrams.length })}
              </span>
            </div>
          </div>

          {isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : isError ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<AlertTriangle className="h-10 w-10" />}
                title={t('workspace.status.loadFailedTitle')}
                description={t('workspace.status.documentsLoadFailed')}
                tone="error"
                role="alert"
                action={
                  <Button variant="outline" onClick={() => void diagramsQuery.refetch()}>
                    {t('workspace.status.retry')}
                  </Button>
                }
              />
            </div>
          ) : diagrams.length === 0 ? (
            <div className="mt-6">
              <WorkspaceEmptyState
                icon={<FileText className="h-10 w-10" />}
                title={t('workspace.documents.title')}
                description={t('workspace.documents.empty')}
                action={
                  canEdit ? (
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('workspace.action.newDocument')}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {diagrams.map((diagram, index) => (
                <DocumentHubRow
                  key={diagram.id}
                  item={documentItems[index]!}
                  locale={i18n.resolvedLanguage ?? i18n.language}
                  onOpen={() => navigate(ROUTES.DIAGRAM(teamId!, projectId!, diagram.id))}
                  canEdit={canEdit}
                  contextControl={
                    canEdit && diagram.pluginId === 'erd' && dictionarySets.length > 0 ? (
                      <div onClick={(event) => event.stopPropagation()}>
                        <Select
                          value={
                            diagram.dictionarySetId != null ? String(diagram.dictionarySetId) : ''
                          }
                          onValueChange={(value) =>
                            updateDictionaryContext(diagram.id, Number(value))
                          }
                        >
                          <SelectTrigger className="h-9 min-w-[220px]">
                            <SelectValue placeholder={t('diagram.list.selectDictionaryContext')} />
                          </SelectTrigger>
                          <SelectContent>
                            {dictionarySets.map((set) => (
                              <SelectItem key={set.id} value={String(set.id)}>
                                {set.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : undefined
                  }
                  renameState={
                    renamingId === diagram.id
                      ? {
                          value: renameValue,
                          onValueChange: setRenameValue,
                          onConfirm: confirmRename,
                          onCancel: cancelRename,
                        }
                      : undefined
                  }
                  onStartRename={canEdit ? () => startRename(diagram) : undefined}
                  onDelete={canEdit ? () => setDeleteTarget(diagram.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dictionarySets={dictionarySets}
        onCreate={createDocument}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('workspace.action.deleteErdDocumentTitle')}
        description={t('workspace.action.deleteErdDocumentDescription')}
        onConfirm={confirmDeleteDocument}
        loading={deleteDocumentPending}
      />
    </div>
  );
}
