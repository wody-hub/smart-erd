import { useState } from 'react';
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

/** CreateResourceDialog 컴포넌트의 props. */
interface CreateResourceDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 다이얼로그 제목 (예: "Create New Team") */
  title: string;
  /** 입력 필드 라벨 (예: "Team Name") */
  inputLabel: string;
  /** 입력 필드 플레이스홀더 텍스트 */
  placeholder: string;
  /** 리소스 생성 함수. 에러를 throw하면 다이얼로그가 유지된다. */
  onCreate: (name: string) => Promise<unknown>;
}

/**
 * 리소스 생성 다이얼로그. Team/Project/Diagram 생성에 공통 사용.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 * @param props.title        다이얼로그 제목
 * @param props.inputLabel   입력 필드 라벨
 * @param props.placeholder  입력 필드 플레이스홀더
 * @param props.onCreate     생성 함수 (에러 throw 시 다이얼로그 유지)
 */
export default function CreateResourceDialog({
  open,
  onOpenChange,
  title,
  inputLabel,
  placeholder,
  onCreate,
}: CreateResourceDialogProps) {
  const { t } = useTranslation();
  /** 리소스 이름 입력값 */
  const [name, setName] = useState('');
  /** 생성 API 호출 진행 중 여부 */
  const [creating, setCreating] = useState(false);

  /** 리소스 생성 폼 제출 핸들러. @param e 폼 이벤트 */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    try {
      await onCreate(name.trim());
      setName('');
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  /** 다이얼로그 열림 상태 변경 핸들러. 닫힐 때 입력값을 초기화한다. @param nextOpen 다음 열림 상태 */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setName('');
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('common.dialog.enterName')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resource-name">{inputLabel}</Label>
              <Input
                id="resource-name"
                placeholder={placeholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? t('common.button.creating') : t('common.button.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
