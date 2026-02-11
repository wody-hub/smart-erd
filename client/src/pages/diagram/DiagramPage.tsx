import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ERDCanvas from '@/components/erd/ERDCanvas';
import useCanvasStore from '@/stores/useCanvasStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
import { fetchDiagram, saveDiagram } from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';
import { KEYBINDINGS } from '@/constants/keybindings';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';
import { useYjsCollaboration } from '@/hooks/useYjsCollaboration';
import { useAutoBackup } from '@/hooks/useAutoBackup';

/**
 * 다이어그램 편집 페이지.
 *
 * URL 파라미터에서 teamId/projectId/diagramId를 추출하여
 * 다이어그램을 로드하고, Y.Doc 기반 실시간 협업 캔버스를 제공한다.
 * Ctrl+S(Mac: Cmd+S) 단축키로 JSON 백업 저장을 할 수 있다.
 */
export default function DiagramPage() {
  /** URL 파라미터: teamId, projectId, diagramId */
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();

  const { t } = useTranslation();

  /** 헤더에 표시할 다이어그램 이름 */
  const [diagramName, setDiagramName] = useState('');

  const prepareBackup = useCanvasStore((s) => s.prepareBackup);
  const markBackedUp = useCanvasStore((s) => s.markBackedUp);
  const connectionStatus = useCollaborationStore((s) => s.connectionStatus);

  const {
    data: diagram,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    queryFn: () => fetchDiagram(teamId!, projectId!, diagramId!),
    enabled: !!teamId && !!projectId && !!diagramId,
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveDiagram(teamId!, projectId!, diagramId!, content),
  });

  /** 다이어그램을 서버에 백업한다. 변경이 없으면 생략하고, 백업 중이면 중복 실행을 방지한다. */
  const handleSave = () => {
    if (saveMutation.isPending) {
      return;
    }
    const result = prepareBackup();
    if (!result) {
      toast.info(t('diagram.toast.noChanges'));
      return;
    }
    saveMutation.mutate(result.content, {
      onSuccess: () => {
        markBackedUp(result.hash);
        toast.success(t('diagram.toast.backupSynced'));
      },
      onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.backupFailed'))),
    });
  };

  useAutoBackup(saveMutation, teamId!, projectId!, diagramId!);
  useHotkeys(KEYBINDINGS.SAVE, handleSave, { preventDefault: true });

  // Y.Doc + YjsProvider 라이프사이클 관리
  const { providerRef } = useYjsCollaboration(diagram, diagramId);

  // diagram 로드 완료 시 이름 설정
  useEffect(() => {
    if (diagram) {
      setDiagramName(diagram.name);
    }
  }, [diagram]);

  if (isError) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-destructive">{t('diagram.edit.loadError')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Spinner text={t('diagram.edit.loadingDiagram')} />
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <Header
          diagramName={diagramName}
          onSave={handleSave}
          saving={saveMutation.isPending}
          connectionStatus={connectionStatus}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1">
            <ERDCanvas diagramName={diagramName || 'diagram'} provider={providerRef.current} />
          </main>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
