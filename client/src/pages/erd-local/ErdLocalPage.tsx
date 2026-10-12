import { useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ERDCanvas from '@/components/erd/ERDCanvas';
import { ErdPermissionProvider } from '@/components/erd/ErdPermissionContext';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { ROUTES } from '@/constants/routes';
import { useErdLocalPersistence } from './useErdLocalPersistence';
import { ErdLocalDictionaryProvider } from './ErdLocalDictionaryProvider';
import { ErdLocalDictionaryDialog } from './ErdLocalDictionaryDialog';

/** 파일 입력 accept 속성값. */
const ERD_LOCAL_FILE_ACCEPT = '.json,application/json';

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
  /** 숨겨진 파일 입력 참조 */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { exportFile, importFileText, resetAll } = useErdLocalPersistence();

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
    <ErdLocalDictionaryProvider>
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
        <div className="relative flex-1">
          <ReactFlowProvider>
            <ErdPermissionProvider canEdit>
              <ERDCanvas diagramName="erd-local" />
            </ErdPermissionProvider>
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
    </ErdLocalDictionaryProvider>
  );
}
