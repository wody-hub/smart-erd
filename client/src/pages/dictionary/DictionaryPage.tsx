import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DomainTab from '@/components/dictionary/DomainTab';
import TermTab from '@/components/dictionary/TermTab';
import { ROUTES } from '@/constants/routes';

/**
 * 데이터 사전 페이지.
 *
 * 도메인 사전과 용어 사전을 탭으로 구분하여 관리한다.
 */
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('dictionary.backToProjects')}
          </Button>

          <h2 className="text-2xl font-bold mb-6">{t('dictionary.title')}</h2>

          <Tabs defaultValue="domains">
            <TabsList>
              <TabsTrigger value="domains">{t('dictionary.tabs.domains')}</TabsTrigger>
              <TabsTrigger value="terms">{t('dictionary.tabs.terms')}</TabsTrigger>
            </TabsList>
            <TabsContent value="domains">
              <DomainTab />
            </TabsContent>
            <TabsContent value="terms">
              <TermTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
