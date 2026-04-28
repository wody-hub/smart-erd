import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WbsItem } from '@/types/wbs';
import {
  collectDescendantIds,
  type ParentKey,
  ROOT_PARENT_KEY,
  toParentKey,
} from './wbs-tree-utils';

const ROOT_VALUE = '__root__';
const POSITION_START_VALUE = '__start__';
const POSITION_END_VALUE = '__end__';

export interface WbsMoveDialogValues {
  parentId: number | null;
  targetIndex: number;
}

interface WbsMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WbsItem | null;
  items: WbsItem[];
  loading?: boolean;
  onSubmit: (values: WbsMoveDialogValues) => Promise<boolean>;
}

function compareBySortOrder(left: WbsItem, right: WbsItem): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return left.id - right.id;
}

function buildSiblingsByParent(items: WbsItem[]): Map<ParentKey, WbsItem[]> {
  const siblingsByParent = new Map<ParentKey, WbsItem[]>();
  siblingsByParent.set(ROOT_PARENT_KEY, []);

  items.forEach((item) => {
    const key = toParentKey(item.parentId);
    const current = siblingsByParent.get(key) ?? [];
    current.push(item);
    siblingsByParent.set(key, current);
  });

  siblingsByParent.forEach((siblings) => siblings.sort(compareBySortOrder));
  return siblingsByParent;
}

function derivePositionValue(item: WbsItem, siblings: WbsItem[]): string {
  const currentIndex = siblings.findIndex((sibling) => sibling.id === item.id);
  if (currentIndex <= 0) {
    return POSITION_START_VALUE;
  }
  const previousSibling = siblings[currentIndex - 1];
  return previousSibling ? `after:${previousSibling.id}` : POSITION_START_VALUE;
}

export default function WbsMoveDialog({
  open,
  onOpenChange,
  item,
  items,
  loading = false,
  onSubmit,
}: WbsMoveDialogProps) {
  const { t } = useTranslation();
  const [parentId, setParentId] = useState(ROOT_VALUE);
  const [positionValue, setPositionValue] = useState(POSITION_START_VALUE);

  const siblingsByParent = useMemo(() => buildSiblingsByParent(items), [items]);

  const parentCandidates = useMemo(() => {
    if (!item) {
      return items;
    }
    const blockedIds = collectDescendantIds(item.id, items);
    blockedIds.add(item.id);
    return items.filter((candidate) => !blockedIds.has(candidate.id));
  }, [item, items]);

  const targetSiblings = useMemo(() => {
    if (!item) {
      return [];
    }
    const selectedParentId = parentId === ROOT_VALUE ? null : Number(parentId);
    return (siblingsByParent.get(toParentKey(selectedParentId)) ?? []).filter(
      (sibling) => sibling.id !== item.id,
    );
  }, [item, parentId, siblingsByParent]);

  useEffect(() => {
    if (!open || !item) {
      return;
    }
    const currentParentValue = item.parentId == null ? ROOT_VALUE : String(item.parentId);
    setParentId(currentParentValue);
    const siblings = siblingsByParent.get(toParentKey(item.parentId)) ?? [];
    setPositionValue(derivePositionValue(item, siblings));
  }, [item, open, siblingsByParent]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      return;
    }

    const nextParentId = parentId === ROOT_VALUE ? null : Number(parentId);
    let targetIndex = 0;
    if (positionValue === POSITION_END_VALUE) {
      targetIndex = targetSiblings.length;
    } else if (positionValue.startsWith('after:')) {
      const afterId = Number(positionValue.slice('after:'.length));
      const afterIndex = targetSiblings.findIndex((sibling) => sibling.id === afterId);
      targetIndex = afterIndex < 0 ? targetSiblings.length : afterIndex + 1;
    }

    const didMove = await onSubmit({ parentId: nextParentId, targetIndex });
    if (didMove) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('wbs.move.title')}</DialogTitle>
          <DialogDescription>
            {item
              ? t('wbs.move.description', { name: item.name })
              : t('wbs.move.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wbs-move-parent">{t('wbs.move.parent')}</Label>
            <Select
              value={parentId}
              onValueChange={(value) => {
                setParentId(value);
                setPositionValue(POSITION_END_VALUE);
              }}
            >
              <SelectTrigger id="wbs-move-parent">
                <SelectValue placeholder={t('wbs.move.parentPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_VALUE}>{t('wbs.form.parentRoot')}</SelectItem>
                {parentCandidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={String(candidate.id)}>
                    {'\u00A0'.repeat(candidate.depth * 2)}
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wbs-move-position">{t('wbs.move.position')}</Label>
            <Select value={positionValue} onValueChange={setPositionValue}>
              <SelectTrigger id="wbs-move-position">
                <SelectValue placeholder={t('wbs.move.positionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POSITION_START_VALUE}>{t('wbs.move.positionStart')}</SelectItem>
                {targetSiblings.map((sibling) => (
                  <SelectItem key={sibling.id} value={`after:${sibling.id}`}>
                    {t('wbs.move.positionAfter', { name: sibling.name })}
                  </SelectItem>
                ))}
                <SelectItem value={POSITION_END_VALUE}>{t('wbs.move.positionEnd')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !item}>
              {loading ? t('common.button.processing') : t('wbs.move.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
