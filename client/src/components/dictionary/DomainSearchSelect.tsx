import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Domain } from '@/types/dictionary';

/** DomainSearchSelect 컴포넌트 props */
interface DomainSearchSelectProps {
  /** 트리거 버튼 ID */
  id?: string;
  /** 선택 가능한 도메인 목록 */
  domains: Domain[];
  /** 현재 선택된 도메인 ID (미선택 시 null) */
  selectedDomainId: number | null;
  /** 도메인 선택 콜백 (null = 선택 해제) */
  onSelect: (domainId: number | null) => void;
  /** '없음' 항목 라벨 */
  noneLabel: string;
  /** 검색 입력 placeholder */
  searchPlaceholder: string;
  /** 검색 결과 없음 텍스트 */
  noResultsText: string;
  /** 트리거 버튼 추가 CSS 클래스 */
  className?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 도메인 검색 선택 콤보박스.
 *
 * Popover + Command 패턴으로 도메인을 검색하고 선택한다.
 */
export default function DomainSearchSelect({
  id,
  domains,
  selectedDomainId,
  onSelect,
  noneLabel,
  searchPlaceholder,
  noResultsText,
  className,
  disabled = false,
}: DomainSearchSelectProps) {
  /** 팝오버 열림 여부 */
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  /** 포탈 컨테이너 (Dialog 내부 렌더링 시 사용) */
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextContainer = triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    setPortalContainer(nextContainer);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedDomain && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selectedDomain
              ? `${selectedDomain.logicalName} · ${selectedDomain.physicalType}`
              : noneLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={noneLabel}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    selectedDomainId == null ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span>{noneLabel}</span>
              </CommandItem>
              {domains.map((domain) => (
                <CommandItem
                  key={domain.id}
                  value={`${domain.logicalName} ${domain.physicalType}`}
                  onSelect={() => {
                    onSelect(domain.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      selectedDomainId === domain.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{domain.logicalName}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {domain.physicalType}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
