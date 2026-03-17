import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** TextInputDialog 컴포넌트의 props. */
interface TextInputDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목 */
  title: string;
  /** 다이얼로그 설명 문구 */
  description?: string;
  /** 입력 필드 라벨 */
  inputLabel: string;
  /** 입력 필드 기본값 */
  defaultValue?: string;
  /** 확인 버튼 텍스트 */
  confirmLabel?: string;
  /** 확인 버튼 클릭 핸들러. 입력값을 전달한다. */
  onConfirm: (value: string) => void;
  /** 비동기 작업 진행 중 여부 (true이면 버튼 비활성화) */
  loading?: boolean;
}

/**
 * 텍스트 입력 다이얼로그. window.prompt() 대체용.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 * @param props.title        다이얼로그 제목
 * @param props.description  다이얼로그 설명 문구
 * @param props.inputLabel   입력 필드 라벨
 * @param props.defaultValue 입력 필드 기본값
 * @param props.confirmLabel 확인 버튼 텍스트
 * @param props.onConfirm    확인 버튼 클릭 핸들러
 * @param props.loading      로딩 중 여부 (true이면 버튼 비활성화)
 */
export default function TextInputDialog({
  open,
  onOpenChange,
  title,
  description,
  inputLabel,
  defaultValue = '',
  confirmLabel,
  onConfirm,
  loading = false,
}: TextInputDialogProps) {
  const { t } = useTranslation();
  /** 입력값 */
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  /** 폼 제출 핸들러. @param e 폼 이벤트 */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 py-4">
            <Label htmlFor="text-input-dialog-field">{inputLabel}</Label>
            <Input
              id="text-input-dialog-field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !value.trim()}>
              {loading
                ? t('common.button.processing')
                : (confirmLabel ?? t('common.button.confirm'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
