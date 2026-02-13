import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useErdDictionary } from './ErdDictionaryContext';
import QuickDomainDialog from './QuickDomainDialog';
import type { Domain } from '@/types/dictionary';

/** 조합 용어 기본 용어에서 추출된 추천 도메인 */
export interface SuggestedDomain {
  /** 도메인 객체 */
  domain: Domain;
  /** 해당 도메인을 가진 기본 용어 이름 */
  fromTermName: string;
}

/** DomainCommandList 컴포넌트 props */
export interface DomainCommandListProps {
  /** 우선 표시할 도메인 목록 (복합 용어 기본 용어 도메인) */
  suggestedDomains?: SuggestedDomain[];
  /** 현재 선택된 도메인 ID */
  selectedDomainId?: number | null;
  /** 도메인 선택 핸들러 (null = 해제) */
  onSelect: (domainId: number | null) => void;
  /** 신규 도메인 등록 요청 핸들러 (미제공 시 버튼 미표시) */
  onRegisterNew?: () => void;
}

/**
 * 도메인 선택 Command 목록 컴포넌트.
 *
 * 추천 도메인, 전체 도메인, "없음" 옵션을 CommandGroup으로 렌더링한다.
 * DomainSelectPopover와 ColumnAutocomplete(복합 용어 2-phase)에서 공통으로 사용한다.
 * 반드시 부모의 Command > CommandList 내부에서 렌더링해야 한다.
 *
 * @param props.suggestedDomains  우선 표시 도메인 목록
 * @param props.selectedDomainId  현재 선택된 도메인 ID
 * @param props.onSelect          도메인 선택 핸들러
 * @param props.onRegisterNew     신규 도메인 등록 요청 핸들러
 */
export function DomainCommandList({
  suggestedDomains = [],
  selectedDomainId,
  onSelect,
  onRegisterNew,
}: DomainCommandListProps) {
  const { t } = useTranslation();
  const { domains } = useErdDictionary();

  /** suggested에 포함되지 않은 나머지 도메인 */
  const otherDomains = useMemo(() => {
    const suggestedIds = new Set(suggestedDomains.map((s) => s.domain.id));
    return domains.filter((d) => !suggestedIds.has(d.id));
  }, [domains, suggestedDomains]);

  return (
    <>
      {suggestedDomains.length > 0 && (
        <>
          <CommandGroup heading={t('erd.domain.baseTermDomains')}>
            {suggestedDomains.map((s) => (
              <CommandItem
                key={`suggested-${s.domain.id}`}
                value={`${s.domain.logicalName} ${s.domain.physicalType}`}
                onSelect={() => onSelect(s.domain.id)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'h-3 w-3 mr-1 shrink-0',
                    selectedDomainId === s.domain.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">
                    {s.domain.logicalName}{' '}
                    <span className="text-muted-foreground">{s.domain.physicalType}</span>
                  </span>
                  <span className="text-2xs text-muted-foreground truncate">{s.fromTermName}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
        </>
      )}

      <CommandGroup heading={t('erd.domain.allDomains')}>
        {otherDomains.map((d) => (
          <CommandItem
            key={d.id}
            value={`${d.logicalName} ${d.physicalType}`}
            onSelect={() => onSelect(d.id)}
            className="cursor-pointer"
          >
            <Check
              className={cn(
                'h-3 w-3 mr-1 shrink-0',
                selectedDomainId === d.id ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="truncate">
              {d.logicalName} <span className="text-muted-foreground">{d.physicalType}</span>
            </span>
          </CommandItem>
        ))}
      </CommandGroup>

      <CommandSeparator />
      <CommandGroup>
        <CommandItem onSelect={() => onSelect(null)} className="cursor-pointer">
          <Check
            className={cn(
              'h-3 w-3 mr-1 shrink-0',
              selectedDomainId == null ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span>{t('erd.domain.none')}</span>
        </CommandItem>
        {onRegisterNew && (
          <CommandItem onSelect={onRegisterNew} className="cursor-pointer">
            <Plus className="h-3 w-3 mr-1 shrink-0" />
            <span>{t('erd.domain.registerNew')}</span>
          </CommandItem>
        )}
      </CommandGroup>
    </>
  );
}

/** DomainSelectPopover 컴포넌트 props */
interface DomainSelectPopoverProps {
  /** Popover 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 현재 선택된 도메인 ID */
  selectedDomainId?: number;
  /** 도메인 선택 핸들러 (null = 해제, physicalType은 신규 생성 시 캐시 갱신 전 즉시 전달) */
  onSelect: (domainId: number | null, physicalType?: string) => void;
  /** 우선 표시할 도메인 목록 (복합 용어 기본 용어 도메인) */
  suggestedDomains?: SuggestedDomain[];
  /** Popover 정렬 */
  align?: 'start' | 'center' | 'end';
  /** 트리거 요소 */
  children: React.ReactNode;
}

/**
 * 도메인 선택 Popover 컴포넌트.
 *
 * Command 패턴으로 도메인을 검색/선택할 수 있다.
 * 조합 용어 기본 용어 도메인을 우선 표시하는 suggestedDomains를 지원한다.
 *
 * @param props.open              Popover 열림 상태
 * @param props.onOpenChange      열림 상태 변경 핸들러
 * @param props.selectedDomainId  현재 선택된 도메인 ID
 * @param props.onSelect          도메인 선택 핸들러
 * @param props.suggestedDomains  우선 표시 도메인 목록
 * @param props.align             Popover 정렬
 * @param props.children          트리거 요소
 */
export default function DomainSelectPopover({
  open,
  onOpenChange,
  selectedDomainId,
  onSelect,
  suggestedDomains = [],
  align = 'start',
  children,
}: DomainSelectPopoverProps) {
  const { t } = useTranslation();

  /** 빠른 도메인 등록 다이얼로그 열림 상태 */
  const [quickDomainOpen, setQuickDomainOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          className="w-56 p-0"
          align={align}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandInput placeholder={t('erd.domain.searchPlaceholder')} />
            <CommandList>
              <DomainCommandList
                suggestedDomains={suggestedDomains}
                selectedDomainId={selectedDomainId}
                onSelect={onSelect}
                onRegisterNew={() => {
                  onOpenChange(false);
                  setQuickDomainOpen(true);
                }}
              />
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <QuickDomainDialog
        open={quickDomainOpen}
        onOpenChange={setQuickDomainOpen}
        onCreated={(domain) => onSelect(domain.id, domain.physicalType)}
      />
    </>
  );
}
