import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchDiagram, fetchDiagramBootstrap } from '@/api/diagramApi';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import MarkdownEditorShell from '@/components/markdown/MarkdownEditorShell';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { DocumentMutationSessionProvider } from '@/collaboration/core/session/document-mutation-session';
import { useDocumentPageHost } from '@/collaboration/core/session/use-document-page-host';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { exportMarkdownBuffer, parseMarkdownBuffer, renderMarkdownPreview } from '@/lib/markdown';
import type { DocumentExportFormat } from '@/types/document';
import { useMarkdownDocumentSession } from '@/pages/document/use-markdown-document-session';
import '@/lib/monaco-setup';

const MARKDOWN_PLUGIN_ID = 'markdown';
const MARKDOWN_ENGINE_ID = 'yjs';

/**
 * Markdown 문서 편집 화면을 렌더링한다.
 *
 * @returns markdown 문서 편집 페이지 JSX
 */
export default function MarkdownDocumentPage() {
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isMobile = useMediaQuery('(max-width: 767px)');
  const showDesktopInfo = useMediaQuery('(min-width: 1280px)');

  /** 현재 편집 모드 */
  const [mode, setMode] = useState<'write' | 'split' | 'preview'>('split');
  /** 모바일 문서 정보 drawer 오픈 여부 */
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);

  const resolvedTeamId = teamId ?? '';
  const resolvedProjectId = projectId ?? '';
  const resolvedDiagramId = diagramId ?? '';

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(resolvedTeamId),
    queryFn: () => fetchTeam(resolvedTeamId),
    enabled: Boolean(resolvedTeamId),
  });
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(resolvedTeamId, resolvedProjectId),
    queryFn: () => fetchProject(resolvedTeamId, resolvedProjectId),
    enabled: Boolean(resolvedTeamId) && Boolean(resolvedProjectId),
  });
  const {
    documentBootstrap,
    documentDetail,
    isLoading,
    isError,
    retryDocumentSetup,
  } = useDocumentPageHost({
    bootstrapQueryKey: queryKeys.diagrams.bootstrap(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
    bootstrapQueryFn: () => fetchDiagramBootstrap(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
    detailQueryKey: queryKeys.diagrams.detail(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
    detailQueryFn: () => fetchDiagram(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
    expectedPluginId: MARKDOWN_PLUGIN_ID,
    expectedEngineId: MARKDOWN_ENGINE_ID,
    enabled: Boolean(resolvedTeamId) && Boolean(resolvedProjectId) && Boolean(resolvedDiagramId),
  });
  const {
    buffer,
    setEditorBuffer,
    dirty,
    lastSavedAt,
    savePending,
    collaborationReady,
    collaborationError,
    handleSave,
    retryCollaborationSetup,
    documentMutationSession,
  } = useMarkdownDocumentSession({
    teamId: resolvedTeamId,
    projectId: resolvedProjectId,
    diagramId: resolvedDiagramId,
    documentDetail,
    documentBootstrap,
  });
  const parsedBuffer = useMemo(() => parseMarkdownBuffer(buffer), [buffer]);
  const previewHtml = useMemo(() => renderMarkdownPreview(parsedBuffer.body), [parsedBuffer.body]);

  const handleBack = () => navigate(ROUTES.DIAGRAMS(resolvedTeamId, resolvedProjectId));

  const handleExport = async (format: DocumentExportFormat) => {
    if (!documentDetail) {
      return;
    }
    try {
      exportMarkdownBuffer(documentDetail.name, buffer, format);
      toast.success(t('markdown.toast.exported'));
    } catch {
      toast.error(t('markdown.toast.exportFailed'));
    }
  };

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    setMode((currentMode) => (currentMode === 'split' ? 'write' : currentMode));
  }, [isMobile]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !documentBootstrap || !documentDetail) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: resolvedTeamId, name: team.name } : undefined,
            project: project ? { id: resolvedProjectId, name: project.name } : undefined,
            section: 'documents',
            documentType: 'markdown',
          }}
        />
        <main className="workspace-shell flex-1 overflow-auto p-6">
          <div className="workspace-container max-w-5xl">
            <WorkspaceEmptyState
              icon={<AlertTriangle className="h-10 w-10" />}
              title={t('workspace.status.loadFailedTitle')}
              description={t('markdown.status.loadFailed')}
              tone="error"
              action={
                <Button variant="outline" onClick={() => void retryDocumentSetup()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  if (collaborationError) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: resolvedTeamId, name: team.name } : undefined,
            project: project ? { id: resolvedProjectId, name: project.name } : undefined,
            section: 'documents',
            documentType: 'markdown',
          }}
        />
        <main className="workspace-shell flex-1 overflow-auto p-6">
          <div className="workspace-container max-w-5xl">
            <WorkspaceEmptyState
              icon={<AlertTriangle className="h-10 w-10" />}
              title={t('workspace.status.loadFailedTitle')}
              description={t('markdown.status.loadFailed')}
              tone="error"
              action={
                <Button variant="outline" onClick={retryCollaborationSetup}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  if (documentBootstrap.snapshotAvailable && !collaborationReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <DocumentMutationSessionProvider value={documentMutationSession}>
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: resolvedTeamId, name: team.name } : undefined,
            project: project ? { id: resolvedProjectId, name: project.name } : undefined,
            section: 'documents',
            document: {
              id: resolvedDiagramId,
              name: documentDetail.name,
              type: 'markdown',
            },
            documentType: 'markdown',
          }}
        />
        <main className="workspace-shell flex-1 overflow-auto p-6">
          <div className="workspace-container max-w-[1480px]">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4"
              onClick={handleBack}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('workspace.action.backToDocuments')}
            </Button>
            <MarkdownEditorShell
              headings={parsedBuffer.headings}
              previewHtml={previewHtml}
              frontmatter={parsedBuffer.frontmatter}
              templateLabel={documentDetail.templateLabel}
              mode={mode}
              onModeChange={setMode}
              onSave={handleSave}
              onOpenInfo={() => setInfoDrawerOpen(true)}
              onExport={handleExport}
              dirty={dirty}
              savePending={savePending}
              lastSavedAt={lastSavedAt}
              showDesktopInfo={showDesktopInfo}
              editorPane={
                <Editor
                  height="min(70vh, 780px)"
                  defaultLanguage="markdown"
                  value={buffer}
                  onChange={(value) => setEditorBuffer(value ?? '')}
                  options={{
                    automaticLayout: true,
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    readOnly: !collaborationReady,
                    padding: { top: 20, bottom: 20 },
                  }}
                />
              }
              isMobile={isMobile}
              infoDrawerOpen={infoDrawerOpen}
              onInfoDrawerOpenChange={setInfoDrawerOpen}
              frontmatterValid={parsedBuffer.frontmatterValid}
            />
          </div>
        </main>
      </div>
    </DocumentMutationSessionProvider>
  );
}
