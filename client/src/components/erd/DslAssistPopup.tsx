import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { AssistPopupItem } from '@/hooks/useDslEditorCompletion';

/** 보조 팝업 전체 상태 */
export interface AssistPopupState {
  /** 보조 팝업 항목 배열 */
  items: AssistPopupItem[];
  /** 현재 선택된 항목 인덱스 */
  selectedIndex: number;
  /** CSS left 위치 (px) */
  left: number;
  /** CSS top 위치 (px) */
  top: number;
  /** 미리보기(반투명) 모드 여부 */
  preview: boolean;
  /** 현재 노출 중인 항목 수 */
  visibleCount: number;
}

/** DslAssistPopup 컴포넌트 props */
interface DslAssistPopupProps {
  /** 팝업 상태 (null이면 렌더링하지 않음) */
  popup: AssistPopupState;
  /** 팝업 리스트 DOM ref */
  listRef: React.RefObject<HTMLUListElement | null>;
  /** 마우스 진입 시 선택 인덱스 갱신 */
  onSelectIndex: (index: number) => void;
  /** 항목 클릭 실행 */
  onExecuteItem: (item: AssistPopupItem) => void;
  /** 미리보기 → 강조 모드 승격 */
  onPromote: () => void;
  /** 더 보기 클릭 */
  onExpand: () => void;
}

/**
 * DSL 에디터 보조(Assist) 팝업 UI.
 *
 * 커서 주변에 표시되며 용어/도메인 자동완성 및 빠른 등록 액션을 제공한다.
 *
 * @param props 팝업 상태 및 콜백
 * @returns 보조 팝업 JSX
 */
export default function DslAssistPopup({
  popup,
  listRef,
  onSelectIndex,
  onExecuteItem,
  onPromote,
  onExpand,
}: DslAssistPopupProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute z-20 pointer-events-none" style={{ left: popup.left, top: popup.top }}>
      <div
        className={cn(
          'pointer-events-auto w-[312px] animate-in fade-in zoom-in-95 duration-150 rounded-xl border p-2.5 shadow-lg backdrop-blur-sm transition-all',
          popup.preview
            ? 'border-border/60 bg-card/70 opacity-40 hover:opacity-100'
            : 'border-border/80 bg-card/100 opacity-100',
        )}
        onMouseDown={onPromote}
      >
        <div className="mb-2 flex items-center justify-between border-b border-border/70 pb-2">
          <p className="text-2xs font-medium text-muted-foreground">{t('erd.dsl.assist.title')}</p>
          <div className="flex items-center gap-2 text-2xs text-muted-foreground">
            <span>
              {t('erd.dsl.assist.moreCount', {
                shown: Math.min(popup.visibleCount, popup.items.length),
                total: popup.items.length,
              })}
            </span>
            <span>{t('erd.dsl.assist.keyboardHint')}</span>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {`${popup.selectedIndex + 1}/${Math.min(
            popup.visibleCount,
            popup.items.length,
          )} ${popup.items[popup.selectedIndex]?.label ?? ''}`}
        </p>
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t('erd.dsl.assist.title')}
          aria-activedescendant={`dsl-assist-option-${popup.selectedIndex}`}
          className="max-h-[228px] space-y-1 overflow-y-auto"
        >
          {popup.items.slice(0, popup.visibleCount).map((item, idx) => {
            const selected = popup.selectedIndex === idx;
            const optionId = `dsl-assist-option-${idx}`;
            return (
              <li key={item.id}>
                <button
                  id={optionId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70',
                  )}
                  data-assist-index={idx}
                  onMouseEnter={() => onSelectIndex(idx)}
                  onMouseDown={(event) => {
                    // 버튼 클릭 시 editor blur가 먼저 발생하면 popup이 닫혀 onClick이 유실될 수 있다.
                    event.preventDefault();
                  }}
                  onClick={() => onExecuteItem(item)}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 text-xs font-medium leading-5">
                      {item.type !== 'insert' && <Sparkles className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.description && (
                      <span className="truncate text-2xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.type !== 'insert' && (
                    <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-2xs font-medium">
                      {t('erd.dsl.assist.badgeNew')}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {popup.visibleCount < popup.items.length && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <button
              type="button"
              aria-label={t('erd.dsl.assist.loadMore')}
              className="w-full rounded-md bg-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={onExpand}
            >
              {t('erd.dsl.assist.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
