import { Suspense, lazy, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DocumentMutationSession } from '@/collaboration/core/session/document-mutation-session';
import { ReactFlowProvider } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DocumentMutationSessionProvider } from '@/collaboration/core/session/document-mutation-session';
import { useDiagramDocumentRuntime } from '@/collaboration/channel/diagram/use-diagram-document-runtime';
import { useDiagramCollaborationStoreBridge } from '@/collaboration/channel/diagram/use-diagram-collaboration-store-bridge';
import { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { ErdDocumentPlugin } from '@/collaboration/plugins/erd/erd-document-plugin';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import ERDCanvas from '@/components/erd/ERDCanvas';
import DiagramSidebar from '@/components/erd/DiagramSidebar';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/constants/routes';
import { useErdLocalPersistence } from './useErdLocalPersistence';
import { ErdLocalDictionaryProvider } from './ErdLocalDictionaryProvider';
import { ErdLocalDictionaryDialog } from './ErdLocalDictionaryDialog';

/** 파일 입력 accept 속성값. */
const ERD_LOCAL_FILE_ACCEPT = '.json,application/json';
/** 좌측 패널 모드. */
type ErdLocalLeftPanel = 'sidebar' | 'code';

/** DDL 코드 에디터 (monaco 무게로 lazy 로드). */
const DdlCodeEditorPanel = lazy(() => import('@/components/erd/DdlCodeEditorPanel'));

/** 로컬 사전과 동일한 Y.Doc의 명령 세션을 편집 UI 전체에 제공한다. */
function ErdLocalProviders({
  session,
  children,
}: {
  session: DocumentMutationSession | null;
  children: ReactNode;
}) {
  return (
    <DocumentMutationSessionProvider value={session}>
      <ErdLocalDictionaryProvider>{children}</ErdLocalDictionaryProvider>
    </DocumentMutationSessionProvider>
  );
}

/**
 * 로그인 불필요 ERD 단독 편집 페이지.
 *
 * 로컬 Y.Doc + localStorage 자동저장 + JSON 파일 저장/열기 + 로컬 사전으로 동작하며
 * 서버·협업 기능은 포함하지 않는다.
 *
 * @returns ERD 로컬 페이지 JSX
 */
export default function ErdLocalPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  /** 새로 시작 확인 다이얼로그 열림 여부 */
  const [resetOpen, setResetOpen] = useState(false);
  /** 로컬 사전 관리 다이얼로그 열림 여부 */
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  /** 좌측 패널 모드 (테이블 목록 | 코드 에디터) */
  const [leftPanel, setLeftPanel] = useState<ErdLocalLeftPanel>('sidebar');
  /** 숨겨진 파일 입력 참조 */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { exportFile, importFileText, resetAll } = useErdLocalPersistence();

  const ydoc = useCanvasStore((state) => state.ydoc);
  const engine = useMemo(() => (ydoc ? new YjsSharedDocumentEngine(ydoc) : null), [ydoc]);
  const plugin = useMemo(() => new ErdDocumentPlugin(), []);
  const storeBridge = useDiagramCollaborationStoreBridge();
  const { documentMutationSession } = useDiagramDocumentRuntime({
    diagram: undefined,
    documentBootstrap: undefined,
    resolvedSessionBootstrap: null,
    sharedDocumentEngine: engine,
    snapshotCodec: null,
    storeBridge,
    plugin,
    isCommandReady: () => useCanvasStore.getState().ydoc === ydoc && ydoc !== null,
  });

  /** 파일 열기 버튼 클릭 시 숨겨진 입력을 연다. */
  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 선택된 파일을 읽어 캔버스에 반영한다.
   *
   * @param event 파일 입력 변경 이벤트
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    void file
      .text()
      .then((text) => {
        importFileText(text);
      })
      .catch(() => toast.error(t('erdLocal.importError')));
  };

  /** 새로 시작을 확정한다. */
  const handleConfirmReset = () => {
    resetAll();
    setResetOpen(false);
  };

  return (
    <ErdLocalProviders session={documentMutationSession}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.GUIDE)}>
            {t('erdLocal.backToGuide')}
          </Button>
          <h1 className="text-sm font-semibold">{t('erdLocal.title')}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportFile}>
              {t('erdLocal.saveFile')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenFileClick}>
              {t('erdLocal.openFile')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDictionaryOpen(true)}>
              {t('erdLocalDictionary.manage')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              {t('erdLocal.reset')}
            </Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <ReactFlowProvider>
            <div className="h-full w-56 shrink-0 border-r border-border bg-card">
              <Tabs
                value={leftPanel}
                onValueChange={(value) => {
                  if (value === 'sidebar' || value === 'code') {
                    setLeftPanel(value);
                  }
                }}
                className="flex h-full min-h-0 flex-col"
              >
                <TabsList className="mx-3 mt-3 h-9 w-fit sm:w-fit sm:justify-start">
                  <TabsTrigger value="sidebar" className="px-3 py-1.5 text-xs">
                    {t('erdLocal.panelTables')}
                  </TabsTrigger>
                  <TabsTrigger value="code" className="px-3 py-1.5 text-xs">
                    {t('erdLocal.panelCode')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sidebar" className="mt-0 min-h-0 flex-1 overflow-hidden">
                  <DiagramSidebar canEdit />
                </TabsContent>
                <TabsContent value="code" className="mt-0 min-h-0 flex-1 overflow-hidden">
                  <Suspense fallback={<Spinner />}>
                    <DdlCodeEditorPanel canEdit />
                  </Suspense>
                </TabsContent>
              </Tabs>
            </div>
            <div className="relative min-w-0 flex-1">
              <ErdPermissionProvider canEdit>
                <ERDCanvas diagramName="erd-local" />
              </ErdPermissionProvider>
            </div>
          </ReactFlowProvider>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ERD_LOCAL_FILE_ACCEPT}
          className="hidden"
          aria-label={t('erdLocal.openFile')}
          onChange={handleFileChange}
        />
        <ErdLocalDictionaryDialog open={dictionaryOpen} onOpenChange={setDictionaryOpen} />
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title={t('erdLocal.resetTitle')}
          description={t('erdLocal.resetDescription')}
          confirmLabel={t('erdLocal.reset')}
          onConfirm={handleConfirmReset}
        />
      </div>
    </ErdLocalProviders>
  );
}
