import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import WbsWorkspaceContent, {
  type WbsWorkspaceContentHandle,
} from '@/components/wbs/WbsWorkspaceContent';

/** WbsTab props. */
interface WbsTabProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 가능 여부 */
  canEdit: boolean;
}

/**
 * 프로젝트 허브의 compact WBS tab.
 *
 * @param props WbsTab props
 * @returns WBS tab JSX
 */
export default function WbsTab({ teamId, projectId, canEdit }: WbsTabProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const workspaceRef = useRef<WbsWorkspaceContentHandle | null>(null);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('wbs.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('wbs.section.description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(ROUTES.PROJECT_WBS(teamId, projectId))}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('wbs.workspace.open')}
          </Button>
          {canEdit ? (
            <Button onClick={() => workspaceRef.current?.openCreateDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('wbs.action.create')}
            </Button>
          ) : null}
        </div>
      </div>

      <WbsWorkspaceContent
        ref={workspaceRef}
        teamId={teamId}
        projectId={projectId}
        canEdit={canEdit}
        variant="tab"
      />
    </div>
  );
}
