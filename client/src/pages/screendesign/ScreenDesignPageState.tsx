import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';

interface ScreenDesignPageLoadErrorStateProps {
  teamId: string;
  teamName?: string;
  projectId: string;
  projectName?: string;
  onRetry: () => void;
}

/**
 * 화면기획 문서가 초기화되는 동안 전체 페이지 로딩 상태를 렌더링한다.
 *
 * @returns 중앙 정렬된 spinner 레이아웃
 */
export function ScreenDesignPageLoadingState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

/**
 * 화면기획 문서를 불러오지 못했을 때 재시도 액션이 포함된 에러 상태를 렌더링한다.
 *
 * @param props 팀/프로젝트 breadcrumb 정보와 재시도 콜백
 * @returns 헤더와 empty state를 포함한 전체 페이지 에러 레이아웃
 */
export function ScreenDesignPageLoadErrorState({
  teamId,
  teamName,
  projectId,
  projectName,
  onRetry,
}: ScreenDesignPageLoadErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        workspaceContext={{
          team: teamName ? { id: teamId, name: teamName } : undefined,
          project: projectName ? { id: projectId, name: projectName } : undefined,
          section: 'documents',
          documentType: 'screen-spec',
        }}
      />
      <main className="workspace-shell flex-1 overflow-auto p-6">
        <div className="workspace-container max-w-5xl">
          <WorkspaceEmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title={t('workspace.status.loadFailedTitle')}
            description={t('screenSpec.status.loadFailed')}
            tone="error"
            action={
              <Button variant="outline" onClick={onRetry}>
                {t('workspace.status.retry')}
              </Button>
            }
          />
        </div>
      </main>
    </div>
  );
}
