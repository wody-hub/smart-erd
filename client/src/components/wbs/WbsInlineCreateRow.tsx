import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TREE_INDENT } from './wbs-tree-utils';

const PAGE_ROW_DIVIDER_CLASS = 'border-b-0 shadow-[inset_0_-1px_0_hsl(var(--border)/0.95)]';

/** WbsInlineCreateRow props. */
interface WbsInlineCreateRowProps {
  /** root 여부 */
  kind: 'root' | 'child' | 'sibling';
  /** 생성할 부모 ID */
  parentId: number | null;
  /** 새 row 깊이 */
  depth: number;
  /** 상위 항목 이름 */
  parentName?: string | null;
  /** 생성 처리 */
  onCreate: (input: { name: string; parentId: number | null }) => Promise<void>;
  /** 로딩 여부 */
  loading?: boolean;
  /** table column 수 */
  columnCount: number;
}

/**
 * dedicated WBS workspace용 inline 생성 row.
 *
 * @param props WbsInlineCreateRow props
 * @returns inline 생성 row JSX
 */
export default function WbsInlineCreateRow({
  kind,
  parentId,
  depth,
  parentName,
  onCreate,
  loading = false,
  columnCount,
}: WbsInlineCreateRowProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [name, setName] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    inputRef.current?.focus();
  }, [active]);

  const promptLabel =
    kind === 'root'
      ? t('wbs.quickAdd.root')
      : kind === 'child'
        ? t('wbs.quickAdd.child')
        : t('wbs.quickAdd.sibling');

  /**
   * inline 생성 row를 원래 상태로 되돌린다.
   */
  const reset = () => {
    setActive(false);
    setName('');
    setValidationMessage(null);
  };

  /**
   * inline 생성 요청을 제출한다.
   */
  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationMessage(t('wbs.quickAdd.nameRequired'));
      inputRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    try {
      await onCreate({ name: trimmedName, parentId });
      setName('');

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch {
      inputRef.current?.focus();
    }
  };

  if (!active) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columnCount} className={cn(PAGE_ROW_DIVIDER_CLASS, 'px-3 py-2')}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/35 hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2',
              (kind === 'child' || kind === 'sibling') && 'ml-1',
            )}
            onClick={() => setActive(true)}
            aria-label={
              kind === 'child' && parentName ? `${promptLabel}: ${parentName}` : promptLabel
            }
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span
              className="truncate"
              style={{
                paddingLeft: kind === 'root' ? 0 : `${Math.max(depth - 1, 0) * TREE_INDENT}px`,
              }}
            >
              {promptLabel}
            </span>
          </button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-secondary/20 hover:bg-secondary/25">
      <TableCell className={PAGE_ROW_DIVIDER_CLASS}>
        <div className="space-y-1">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${depth * TREE_INDENT}px` }}
          >
            <Plus className="h-4 w-4 shrink-0 text-primary" />
            <Input
              ref={inputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (validationMessage) {
                  setValidationMessage(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  reset();
                }
              }}
              disabled={loading}
              placeholder={t('wbs.form.namePlaceholder')}
              maxLength={200}
              aria-label={promptLabel}
            />
          </div>
          {validationMessage ? (
            <p className="pl-6 text-xs text-destructive">{validationMessage}</p>
          ) : null}
        </div>
      </TableCell>

      <TableCell className={cn(PAGE_ROW_DIVIDER_CLASS, 'text-sm text-muted-foreground')}>
        {t('wbs.quickAdd.setLater')}
      </TableCell>
      <TableCell className={cn(PAGE_ROW_DIVIDER_CLASS, 'text-sm text-muted-foreground')}>
        {t('wbs.quickAdd.setLater')}
      </TableCell>
      <TableCell className={cn(PAGE_ROW_DIVIDER_CLASS, 'text-sm text-muted-foreground')}>
        {t('wbs.quickAdd.setLater')}
      </TableCell>
      <TableCell className={cn(PAGE_ROW_DIVIDER_CLASS, 'text-sm text-muted-foreground')}>
        {t('wbs.quickAdd.setLater')}
      </TableCell>
      <TableCell className={cn(PAGE_ROW_DIVIDER_CLASS, 'text-sm text-muted-foreground')}>
        {t('wbs.quickAdd.setLater')}
      </TableCell>
      <TableCell className={PAGE_ROW_DIVIDER_CLASS}>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void handleSubmit()} disabled={loading}>
            {t('wbs.quickAdd.add')}
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={loading}>
            {t('wbs.quickAdd.cancel')}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
