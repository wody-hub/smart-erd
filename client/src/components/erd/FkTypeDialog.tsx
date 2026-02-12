import { useTranslation } from 'react-i18next';
import type { RelationType } from '@/types/erd';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** FkTypeDialog의 props */
interface FkTypeDialogProps {
  /** 다이얼로그 열림 여부 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 관계 유형 선택 콜백 */
  onSelect: (type: RelationType) => void;
}

/**
 * FK 관계 유형 선택 다이얼로그.
 *
 * 식별 관계(실선)와 비식별 관계(점선) 중 하나를 선택한다.
 *
 * @param props.open         다이얼로그 열림 여부
 * @param props.onOpenChange 열림 상태 변경 핸들러
 * @param props.onSelect     관계 유형 선택 콜백
 */
export default function FkTypeDialog({ open, onOpenChange, onSelect }: FkTypeDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('erd.fkMode.fkTypeTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* 식별 관계 */}
          <button
            className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer text-left transition-colors"
            onClick={() => onSelect('identifying')}
            aria-label={t('erd.fkMode.identifying')}
          >
            <div className="flex items-center shrink-0 mt-1">
              <svg width="48" height="16" viewBox="0 0 48 16" className="text-foreground">
                <line x1="0" y1="8" x2="48" y2="8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-sm">{t('erd.fkMode.identifying')}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('erd.fkMode.identifyingDesc')}
              </div>
            </div>
          </button>

          {/* 비식별 관계 */}
          <button
            className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer text-left transition-colors"
            onClick={() => onSelect('non-identifying')}
            aria-label={t('erd.fkMode.nonIdentifying')}
          >
            <div className="flex items-center shrink-0 mt-1">
              <svg width="48" height="16" viewBox="0 0 48 16" className="text-foreground">
                <line
                  x1="0"
                  y1="8"
                  x2="48"
                  y2="8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-sm">{t('erd.fkMode.nonIdentifying')}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('erd.fkMode.nonIdentifyingDesc')}
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.button.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
