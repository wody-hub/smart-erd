import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

/** ConfirmDialog 컴포넌트의 props. */
interface ConfirmDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목 */
  title: string;
  /** 다이얼로그 설명 문구 */
  description: string;
  /** 확인 버튼 텍스트 (미지정 시 t('common.button.delete') 사용) */
  confirmLabel?: string;
  /** 확인 버튼 스타일 변형 (기본: "destructive") */
  confirmVariant?: ButtonProps['variant'];
  /** 확인 버튼 클릭 핸들러 */
  onConfirm: () => void;
  /** 비동기 작업 진행 중 여부 (true이면 버튼 비활성화) */
  loading?: boolean;
}

/**
 * 확인/취소 다이얼로그. window.confirm() 대체용.
 *
 * @param props.open           다이얼로그 열림 상태
 * @param props.onOpenChange   다이얼로그 열림 상태 변경 핸들러
 * @param props.title          다이얼로그 제목
 * @param props.description    다이얼로그 설명 문구
 * @param props.confirmLabel   확인 버튼 텍스트 (미지정 시 t('common.button.delete') 사용)
 * @param props.confirmVariant 확인 버튼 스타일 (기본: "destructive")
 * @param props.onConfirm      확인 버튼 클릭 핸들러
 * @param props.loading        로딩 중 여부 (true이면 버튼 비활성화)
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = 'destructive',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.button.cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? t('common.button.processing') : (confirmLabel ?? t('common.button.delete'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
