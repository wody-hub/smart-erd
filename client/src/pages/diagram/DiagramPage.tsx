import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ERDCanvas from '@/components/erd/ERDCanvas';
import ValidationPanel from '@/components/erd/ValidationPanel';
import { ErdDictionaryProvider } from '@/components/erd/ErdDictionaryContext';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import useCanvasStore from '@/stores/useCanvasStore';
import useCollaborationStore from '@/stores/useCollaborationStore';
import { fetchDiagram, saveDiagram } from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';
import { KEYBINDINGS } from '@/constants/keybindings';
import { getErrorMessage } from '@/lib/api-error';
import { useTeamRole } from '@/hooks/useTeamRole';
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
  const SIDEBAR_MIN_WIDTH = 180;
  const SIDEBAR_MAX_WIDTH = 480;
  const SIDEBAR_KEYBOARD_STEP = 16;

  /** URL 파라미터: teamId, projectId, diagramId */
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();

  const { t } = useTranslation();

  /** 헤더에 표시할 다이어그램 이름 */
  const [diagramName, setDiagramName] = useState('');
  /** 유효성 검사 패널 열림 상태 */
  const [validationOpen, setValidationOpen] = useState(false);
  /** 좌측 사이드바 너비(px) */
  const [sidebarWidth, setSidebarWidth] = useState(224);
  /** 진행 중인 사이드바 리사이즈 정리 함수 */
  const sidebarResizeCleanupRef = useRef<(() => void) | null>(null);

  const { canEdit } = useTeamRole(teamId);

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

  /** 유효성 검사 패널 토글 핸들러 */
  const handleToggleValidation = () => setValidationOpen((prev) => !prev);

  /** 사이드바 너비를 허용 범위로 보정한다. */
  const clampSidebarWidth = (width: number) =>
    Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));

  /** 현재 진행 중인 사이드바 리사이즈 리스너/전역 스타일을 정리한다. */
  const cleanupSidebarResize = () => {
    if (!sidebarResizeCleanupRef.current) return;
    sidebarResizeCleanupRef.current();
    sidebarResizeCleanupRef.current = null;
  };

  /**
   * 사이드바 리사이즈 시작 핸들러.
   *
   * @param e PointerDown 이벤트
   */
  const handleSidebarResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
    cleanupSidebarResize();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(startWidth + (ev.clientX - startX)));
    };

    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('blur', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      sidebarResizeCleanupRef.current = null;
    };

    sidebarResizeCleanupRef.current = handleEnd;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('blur', handleEnd);
  };

  /**
   * 키보드 기반 사이드바 리사이즈 핸들러.
   *
   * ArrowLeft/ArrowRight로 너비를 조절하고, Home/End로 최소/최대로 이동한다.
   */
  const handleSidebarResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev - SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev + SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  useAutoBackup(saveMutation, teamId!, projectId!, diagramId!);
  useHotkeys(KEYBINDINGS.SAVE, handleSave, { preventDefault: true });

  useEffect(() => {
    return () => {
      if (!sidebarResizeCleanupRef.current) return;
      sidebarResizeCleanupRef.current();
      sidebarResizeCleanupRef.current = null;
    };
  }, []);

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
      <ErdDictionaryProvider teamId={teamId!}>
        <ErdPermissionProvider canEdit={canEdit}>
          <div className="h-screen flex flex-col">
            <Header
              diagramName={diagramName}
              onSave={canEdit ? handleSave : undefined}
              saving={saveMutation.isPending}
              connectionStatus={connectionStatus}
              canEdit={canEdit}
            />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar canEdit={canEdit} width={sidebarWidth} />
              <div
                className="group w-3 shrink-0 cursor-col-resize flex items-stretch justify-center bg-muted/30 hover:bg-muted/60 active:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onPointerDown={handleSidebarResizeStart}
                onKeyDown={handleSidebarResizeKeyDown}
                role="separator"
                aria-orientation="vertical"
                aria-controls="diagram-sidebar"
                aria-label={t('erd.sidebar.resize')}
                aria-valuemin={SIDEBAR_MIN_WIDTH}
                aria-valuemax={SIDEBAR_MAX_WIDTH}
                aria-valuenow={sidebarWidth}
                title={t('erd.sidebar.resize')}
                tabIndex={0}
              >
                <div className="w-px h-full bg-border/80 group-hover:bg-primary/80 group-active:bg-primary transition-colors" />
              </div>
              <main className="flex-1">
                <ERDCanvas
                  diagramName={diagramName || 'diagram'}
                  provider={providerRef.current}
                  validationOpen={validationOpen}
                  onToggleValidation={handleToggleValidation}
                  canEdit={canEdit}
                />
              </main>
              {validationOpen && <ValidationPanel onClose={() => setValidationOpen(false)} />}
            </div>
          </div>
        </ErdPermissionProvider>
      </ErdDictionaryProvider>
    </ReactFlowProvider>
  );
}
