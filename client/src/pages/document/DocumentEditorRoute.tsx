import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import DiagramPage from '@/pages/diagram/DiagramPage';
import MarkdownDocumentPage from '@/pages/document/MarkdownDocumentPage';
import ScreenDesignPage from '@/pages/screendesign/ScreenDesignPage';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { ROUTES } from '@/constants/routes';
import { useDocumentEditorBootstrap } from '@/pages/document/use-document-editor-bootstrap';
import { isScreenSpecPluginId } from '@/types/document';

/**
 * 문서 플러그인 bootstrap에 따라 ERD/Markdown editor route를 분기한다.
 *
 * @returns plugin-aware 문서 편집 라우트 JSX
 */
export default function DocumentEditorRoute() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const bootstrapQuery = useDocumentEditorBootstrap(teamId, projectId, diagramId);

  /**
   * 편집기를 떠나 문서 목록으로 되돌아간다.
   *
   * @returns 없음
   */
  const handleBackToDocuments = () => {
    if (teamId && projectId) {
      navigate(ROUTES.DIAGRAMS(teamId, projectId));
      return;
    }
    navigate(ROUTES.TEAMS);
  };

  if (bootstrapQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (bootstrapQuery.isError || !bootstrapQuery.data) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <WorkspaceEmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title={t('workspace.status.loadFailedTitle')}
            description={t('workspace.status.documentsLoadFailed')}
            tone="error"
            action={
              <Button variant="outline" onClick={() => void bootstrapQuery.refetch()}>
                {t('workspace.status.retry')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (bootstrapQuery.data?.pluginId === 'markdown') {
    return <MarkdownDocumentPage />;
  }

  if (bootstrapQuery.data?.pluginId && isScreenSpecPluginId(bootstrapQuery.data.pluginId)) {
    return <ScreenDesignPage />;
  }

  if (bootstrapQuery.data?.pluginId !== 'erd') {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <WorkspaceEmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title={t('workspace.status.loadFailedTitle')}
            description={t('workspace.status.documentUnsupported')}
            tone="error"
            action={
              <Button variant="outline" onClick={handleBackToDocuments}>
                {t('workspace.action.backToDocuments')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return <DiagramPage />;
}
