import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { KEYS } from '@/constants/keybindings';
import { useErdDictionary } from './ErdDictionaryContext';
import type { LogicalNameResolution } from '@/lib/logical-name-resolution';

/** 스토어 전파 debounce 시간 (ms) — 한글 IME 조합 완료 후 검색 지연 */
const FLUSH_DEBOUNCE_MS = 300;

/** 자동완성에서 Term 선택 시 전달할 컬럼 업데이트 데이터 */
export interface TermSelectResult {
  /** 논리명 */
  logicalName: string;
  /** 물리명 */
  name: string;
  /** 데이터 타입 (Domain 연결 시) */
  type?: string;
  /** Term ID */
  termId: number;
  /** Domain ID */
  domainId?: number;
}

interface ColumnAutocompleteProps {
  /** 현재 논리명 값 */
  value: string;
  /** 논리명 변경 핸들러 */
  onChange: (value: string) => void;
  /** Term 선택 핸들러 */
  onSelectTerm: (result: TermSelectResult) => void;
  /** 단어사전 기반 해석 결과 적용 핸들러 */
  onSelectDerived: (resolution: LogicalNameResolution) => void;
  /** 신규 등록 흐름 진입 핸들러 */
  onRegisterNew: (logicalName: string) => void;
  /** 비활성 상태 */
  disabled?: boolean;
  /** 용어가 연결된 상태인지 여부 (termId 존재 시 true) */
  termLinked?: boolean;
  /** 입력창 hover/focus 시 accent 배경 강조 사용 여부 */
  highlightOnHover?: boolean;
}

/**
 * 논리명 자동완성 컴포넌트.
 *
 * 우선순위:
 * 1) 용어사전 exact/부분 검색 결과
 * 2) 단어사전 기반 물리명 유도 결과
 * 3) 단어사전 조합 실패/모호함 안내 + 빠른 등록 흐름
 */
export default function ColumnAutocomplete({
  value,
  onChange,
  onSelectTerm,
  onSelectDerived,
  onRegisterNew,
  disabled,
  termLinked,
  highlightOnHover = true,
}: ColumnAutocompleteProps) {
  const { t } = useTranslation();
  const { searchTerms, getTermWithType, resolveLogicalName } = useErdDictionary();

  /** Popover 열림 상태 */
  const [open, setOpen] = useState(false);
  /** IME 조합 중 로컬 입력 버퍼 */
  const [localValue, setLocalValue] = useState(value);
  /** IME 조합 진행 중 여부 */
  const composingRef = useRef(false);
  /** debounce 타이머 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!composingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const results = useMemo(
    () => (value.trim().length >= 1 ? searchTerms(value) : []),
    [value, searchTerms],
  );

  const logicalResolution = useMemo(
    () => (value.trim().length >= 1 ? resolveLogicalName(value) : null),
    [value, resolveLogicalName],
  );

  const derivedResolution = useMemo(
    () =>
      results.length === 0 &&
      logicalResolution &&
      logicalResolution.isWordCompleteMatch &&
      logicalResolution.physicalName
        ? logicalResolution
        : null,
    [results, logicalResolution],
  );

  const compositionAnalysis = useMemo(
    () =>
      results.length === 0 && logicalResolution && !logicalResolution.isWordCompleteMatch
        ? logicalResolution.wordAnalysis
        : null,
    [results, logicalResolution],
  );

  useEffect(() => {
    if (!value.trim()) {
      setOpen(false);
    }
  }, [value]);

  const flushToStore = () => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (composingRef.current || !inputRef.current) {
        return;
      }
      const latest = inputRef.current.value;
      onChange(latest);
      if (latest.trim().length >= 1) {
        setOpen(true);
      }
    }, FLUSH_DEBOUNCE_MS);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (!newValue.trim()) {
      clearTimeout(debounceRef.current);
      onChange(newValue);
      return;
    }

    if (!composingRef.current) {
      flushToStore();
    }
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    flushToStore();
  };

  const handleBlur = () => {
    clearTimeout(debounceRef.current);
    if (inputRef.current && inputRef.current.value !== value) {
      onChange(inputRef.current.value);
    }
  };

  const handleSelectTerm = (termId: number) => {
    const term = results.find((item) => item.id === termId);
    if (!term) {
      return;
    }

    const termWithType = getTermWithType(term);
    onSelectTerm({
      logicalName: term.logicalName,
      name: term.physicalName,
      type: termWithType.physicalType,
      termId: term.id,
      domainId: term.domainId ?? undefined,
    });
    setOpen(false);
  };

  const handleSelectDerived = () => {
    if (!derivedResolution) {
      return;
    }
    onSelectDerived(derivedResolution);
    setOpen(false);
  };

  const handleRegisterNew = () => {
    onRegisterNew(localValue);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === KEYS.ESCAPE) {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === KEYS.ARROW_DOWN && !open && localValue.trim().length >= 1) {
      setOpen(true);
    }
    if (open && (e.key === KEYS.ARROW_DOWN || e.key === KEYS.ARROW_UP)) {
      e.stopPropagation();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <input
          ref={inputRef}
          className={`nodrag flex-1 bg-transparent outline-none ${highlightOnHover ? 'hover:bg-accent focus:bg-accent' : 'hover:bg-transparent focus:bg-transparent'} focus-visible:ring-1 focus-visible:ring-ring px-1 rounded min-w-0 text-xs`}
          value={localValue}
          onChange={handleInputChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          onFocus={() => {
            if (!termLinked && localValue.trim().length >= 1) {
              requestAnimationFrame(() => {
                if (document.activeElement === inputRef.current) {
                  setOpen(true);
                }
              });
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('erd.autocomplete.placeholder')}
          disabled={disabled}
          aria-label={t('erd.tableNode.aria.logicalName')}
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-72 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (inputRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {results.length === 0 && !derivedResolution && !compositionAnalysis ? (
              <CommandEmpty>{t('erd.autocomplete.noResults')}</CommandEmpty>
            ) : null}

            {results.length > 0 ? (
              <CommandGroup>
                {results.map((term) => {
                  const termWithType = getTermWithType(term);
                  return (
                    <CommandItem
                      key={term.id}
                      value={String(term.id)}
                      onSelect={() => handleSelectTerm(term.id)}
                      className="cursor-pointer"
                    >
                      <span className="font-medium">{term.logicalName}</span>
                      <span className="text-muted-foreground ml-1">
                        → {term.physicalName}
                        {termWithType.physicalType ? ` (${termWithType.physicalType})` : ''}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {derivedResolution ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('erd.autocomplete.compoundHeading')}>
                  <CommandItem
                    value="derived-result"
                    onSelect={handleSelectDerived}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div>
                        <span className="font-medium">{derivedResolution.query}</span>
                        <span className="text-muted-foreground ml-1">
                          → {derivedResolution.physicalName}
                          {derivedResolution.physicalType
                            ? ` (${derivedResolution.physicalType})`
                            : ''}
                        </span>
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {derivedResolution.wordAnalysis.matchedWords
                          .map((word) => `${word.logicalName}→${word.physicalName}`)
                          .join(' + ')}
                      </div>
                      {derivedResolution.state === 'term-missing' ? (
                        <div className="text-2xs text-erd-warning">
                          {t('erd.autocomplete.termMissing')}
                        </div>
                      ) : null}
                    </div>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}

            {compositionAnalysis ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={t('erd.autocomplete.partialHeading')}>
                  {compositionAnalysis.isAmbiguous ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
                      <div>{t('dictionary.term.form.compositionAmbiguous')}</div>
                      <div>
                        {t('dictionary.term.form.compositionAmbiguousHint', {
                          names: compositionAnalysis.ambiguousPhysicalNames.join(', '),
                        })}
                      </div>
                    </div>
                  ) : (
                    compositionAnalysis.segments.map((segment, index) =>
                      segment.matched ? (
                        <div key={index} className="px-3 py-1 text-xs flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-erd-validation-matched shrink-0" />
                          <span>{segment.text}</span>
                          <span className="text-muted-foreground">
                            → {segment.word!.physicalName}
                          </span>
                        </div>
                      ) : (
                        <div
                          key={index}
                          className="px-3 py-1 text-xs flex items-center gap-1.5 text-muted-foreground"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span className="font-medium">{segment.text}</span>
                          <span>{t('erd.autocomplete.partialUnregistered')}</span>
                        </div>
                      ),
                    )
                  )}
                </CommandGroup>
              </>
            ) : null}

            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleRegisterNew} className="cursor-pointer">
                <Plus className="h-3 w-3" />
                <span>{t('erd.autocomplete.registerFlow')}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
