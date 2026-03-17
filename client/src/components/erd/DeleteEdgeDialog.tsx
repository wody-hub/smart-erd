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

/** DeleteEdgeDialog 컴포넌트의 props. */
interface DeleteEdgeDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** FK 컬럼이 속한 자식 테이블 이름 */
  childTableName: string;
  /** FK 컬럼 정보 문자열 (예: "users_id (BIGINT)") */
  fkColumnsText: string;
  /** FK 컬럼 제거 + 엣지 삭제 핸들러 */
  onRemoveFk: () => void;
  /** FK 컬럼 유지 + 엣지만 삭제 핸들러 */
  onKeepFk: () => void;
}

/**
 * 엣지 삭제 시 FK 컬럼 처리 방식을 선택하는 다이얼로그.
 *
 * 3개 버튼: FK 제거 (destructive) / FK 유지 (outline) / 취소 (ghost)
 *
 * @param props.open            다이얼로그 열림 상태
 * @param props.onOpenChange    다이얼로그 열림 상태 변경 핸들러
 * @param props.childTableName  FK 컬럼이 속한 자식 테이블 이름
 * @param props.fkColumnsText   FK 컬럼 정보 문자열
 * @param props.onRemoveFk      FK 컬럼 제거 + 엣지 삭제 핸들러
 * @param props.onKeepFk        FK 컬럼 유지 + 엣지만 삭제 핸들러
 */
export default function DeleteEdgeDialog({
  open,
  onOpenChange,
  childTableName,
  fkColumnsText,
  onRemoveFk,
  onKeepFk,
}: DeleteEdgeDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('erd.edge.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('erd.edge.deleteDescription', { childTable: childTableName })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('erd.edge.fkColumns', { columns: fkColumnsText })}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.button.cancel')}
          </Button>
          <Button variant="outline" onClick={onKeepFk}>
            {t('erd.edge.keepFk')}
          </Button>
          <Button variant="destructive" onClick={onRemoveFk}>
            {t('erd.edge.removeFk')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
