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
import type { WbsItem } from '@/types/wbs';
import { buildWbsHierarchyOptions } from './wbs-hierarchy-options';

interface WbsHierarchySelectProps {
  id?: string;
  items: WbsItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  unlinkedLabel: string;
  searchPlaceholder: string;
  noResultsText: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable WBS selector that exposes hierarchy paths for duplicate-name branches.
 */
export default function WbsHierarchySelect({
  id,
  items,
  value,
  onValueChange,
  placeholder,
  unlinkedLabel,
  searchPlaceholder,
  noResultsText,
  className,
  disabled = false,
}: WbsHierarchySelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const options = useMemo(() => buildWbsHierarchyOptions(items), [items]);
  const selectedOption = useMemo(
    () => options.find((option) => String(option.itemId) === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextContainer = triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    setPortalContainer(nextContainer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  const triggerLabel =
    value === 'none' ? unlinkedLabel : (selectedOption?.fullPathLabel ?? placeholder);

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
            !selectedOption && value !== 'none' && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command>
          <CommandInput ref={inputRef} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={unlinkedLabel}
                onSelect={() => {
                  onValueChange('none');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    value === 'none' ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span>{unlinkedLabel}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.itemId}
                  value={option.searchValue}
                  onSelect={() => {
                    onValueChange(String(option.itemId));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === String(option.itemId) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{option.itemName}</span>
                    {option.ancestorPathLabel ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.ancestorPathLabel}
                      </span>
                    ) : null}
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
