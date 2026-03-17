import { useTranslation } from 'react-i18next';
import DictionaryWorkspace from '@/components/dictionary/DictionaryWorkspace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** DictionaryManagementDialog 컴포넌트 props */
interface DictionaryManagementDialogProps {
  /** 다이얼로그 열림 여부 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 팀 ID */
  teamId: string;
  /** 편집 권한 여부 */
  canEdit: boolean;
  /** 연결된 사전 세트 ID */
  dictionarySetId: string;
  /** 사전 세트 표시 이름 */
  dictionarySetName?: string | null;
}

/**
 * 다이어그램 내 사전 관리 다이얼로그.
 *
 * 현재 다이어그램에 연결된 사전 세트를 고정한 상태로
 * 단어/용어/도메인 사전 화면을 재사용한다.
 */
export default function DictionaryManagementDialog({
  open,
  onOpenChange,
  teamId,
  canEdit,
  dictionarySetId,
  dictionarySetName,
}: DictionaryManagementDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[88vh] max-h-[88vh] w-[min(96vw,1400px)] max-w-[1400px] flex-col overflow-hidden gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t('dictionary.title')}</DialogTitle>
          <DialogDescription>
            {t('diagram.edit.dictionaryContext', { name: dictionarySetName ?? '-' })}
          </DialogDescription>
        </DialogHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5"
          data-testid="dictionary-management-body"
        >
          <DictionaryWorkspace
            teamId={teamId}
            canEdit={canEdit}
            fixedSetId={dictionarySetId}
            fixedSetLabel={dictionarySetName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
