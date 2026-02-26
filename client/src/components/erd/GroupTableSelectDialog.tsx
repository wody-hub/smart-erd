import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import useCanvasStore from '@/stores/useCanvasStore';

/** GroupTableSelectDialog의 props. */
interface GroupTableSelectDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 대상 그룹 ID */
  groupId: string;
  /** 대상 그룹 이름 */
  groupName: string;
  /** 현재 그룹에 이미 속한 테이블 ID 목록 */
  existingTableIds: string[];
}

/**
 * 그룹에 테이블을 추가/제거하는 멀티 셀렉트 다이얼로그.
 */
export default function GroupTableSelectDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  existingTableIds,
}: GroupTableSelectDialogProps) {
  const { t } = useTranslation();
  const nodes = useCanvasStore((s) => s.nodes);
  const updateGroupTables = useCanvasStore((s) => s.updateGroupTables);

  /** 로컬 선택 상태 (체크된 테이블 ID Set) */
  const [selected, setSelected] = useState<Set<string>>(() => new Set(existingTableIds));
  /** 다이얼로그 열림 시점의 테이블 ID 스냅샷 */
  const [snapshotIds, setSnapshotIds] = useState<string[]>(existingTableIds);

  // 다이얼로그 open 전환 시에만 스냅샷과 선택 상태를 초기화한다.
  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(new Set(existingTableIds));
    setSnapshotIds(existingTableIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 전환 시에만 초기화. 원격 변경으로 사용자 선택이 리셋되는 것을 방지.
  }, [open]);

  /**
   * 테이블 체크 상태를 토글한다.
   *
   * @param tableId 테이블 ID
   */
  const handleToggle = (tableId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  /** 확인 버튼 클릭 시 변경분을 그룹에 반영한다. */
  const handleConfirm = () => {
    const snapshotSet = new Set(snapshotIds);
    const currentNodeIds = new Set(nodes.map((node) => node.id));

    const toAdd = [...selected].filter(
      (tableId) => !snapshotSet.has(tableId) && currentNodeIds.has(tableId),
    );
    const toRemove = snapshotIds.filter((tableId) => !selected.has(tableId));

    if (groupId && (toAdd.length > 0 || toRemove.length > 0)) {
      updateGroupTables(groupId, toAdd, toRemove);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('erd.group.selectTables')}</DialogTitle>
          <DialogDescription>
            {t('erd.group.selectTablesDesc', { name: groupName })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-auto space-y-1">
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('erd.sidebar.noTables')}
            </p>
          ) : (
            nodes.map((node) => (
              <label
                key={node.id}
                htmlFor={`group-table-${node.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
              >
                <input
                  id={`group-table-${node.id}`}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.has(node.id)}
                  onChange={() => handleToggle(node.id)}
                />
                <span className="text-sm truncate">{node.data.label}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.button.cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('common.button.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
