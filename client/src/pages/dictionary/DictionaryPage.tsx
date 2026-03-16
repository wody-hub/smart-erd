import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import DictionaryWorkspace from '@/components/dictionary/DictionaryWorkspace';
import { ROUTES } from '@/constants/routes';
import { useTeamRole } from '@/hooks/useTeamRole';

/**
 * 데이터 사전 페이지.
 *
 * 사전 세트를 선택한 뒤 도메인/용어 탭을 세트 스코프로 관리한다.
 */
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('dictionary.backToProjects')}
          </Button>

          <h2 className="text-2xl font-bold mb-4">{t('dictionary.title')}</h2>

          {teamId && <DictionaryWorkspace teamId={teamId} canEdit={canEdit} />}
        </div>
      </main>
    </div>
  );
}
