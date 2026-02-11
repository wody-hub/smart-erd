import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { KEYS } from '@/constants/keybindings';
import { useErdDictionary } from './ErdDictionaryContext';
import { DomainCommandList, type SuggestedDomain } from './DomainSelectPopover';
import type { CompoundResolution } from '@/types/dictionary';

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

/** ColumnAutocomplete 컴포넌트 props */
interface ColumnAutocompleteProps {
  /** 현재 논리명 값 */
  value: string;
  /** 논리명 변경 핸들러 */
  onChange: (value: string) => void;
  /** Term 선택 핸들러 */
  onSelectTerm: (result: TermSelectResult) => void;
  /** 복합 용어 선택 핸들러 */
  onSelectCompound: (resolution: CompoundResolution) => void;
  /** 신규 용어 등록 요청 핸들러 (partialOnly=true면 컬럼에 미적용) */
  onRegisterNew: (logicalName: string, partialOnly?: boolean) => void;
  /** 비활성 상태 */
  disabled?: boolean;
  /** 용어가 연결된 상태인지 여부 (termId 존재 시 true) */
  termLinked?: boolean;
}

/**
 * 논리명 자동완성 컴포넌트.
 *
 * 논리명 입력 시 팀 사전에서 매칭되는 Term을 Popover로 표시한다.
 * Term 선택 시 물리명/타입이 자동 매핑되며, 매칭 결과가 없으면
 * 신규 용어 등록 진입점을 제공한다.
 *
 * @param props.value            현재 논리명 값
 * @param props.onChange          논리명 변경 핸들러
 * @param props.onSelectTerm     Term 선택 핸들러
 * @param props.onSelectCompound 복합 용어 선택 핸들러
 * @param props.onRegisterNew    신규 등록 요청 핸들러
 * @param props.disabled         비활성 상태
 * @param props.termLinked       용어 연결 여부 (true면 포커스 시 Popover 미표시)
 */
export default function ColumnAutocomplete({
  value,
  onChange,
  onSelectTerm,
  onSelectCompound,
  onRegisterNew,
  disabled,
  termLinked,
}: ColumnAutocompleteProps) {
  const { t } = useTranslation();
  const { searchTerms, getTermWithType, resolveCompound, partialDecompose, findDomainById } =
    useErdDictionary();

  /** Popover 열림 상태 */
  const [open, setOpen] = useState(false);
  /** 복합 용어 도메인 선택 대기 */
  const [pendingCompound, setPendingCompound] = useState<CompoundResolution | null>(null);
  /** IME 조합 중 로컬 입력 버퍼 (한글 등 조합형 문자 입력 시 스토어 roundtrip 방지) */
  const [localValue, setLocalValue] = useState(value);
  /** IME 조합 진행 중 여부 */
  const composingRef = useRef(false);
  /** debounce 타이머 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 value prop 변경 시 로컬 버퍼 동기화 (IME 조합 중에는 건너뜀)
  useEffect(() => {
    if (!composingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  // debounce 타이머 클린업
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const results = useMemo(
    () => (value.trim().length >= 1 ? searchTerms(value) : []),
    [value, searchTerms],
  );
  const compoundResult = useMemo(
    () => (results.length === 0 && value.trim().length >= 2 ? resolveCompound(value) : null),
    [results, value, resolveCompound],
  );
  const partialResult = useMemo(
    () =>
      results.length === 0 && !compoundResult && value.trim().length >= 2
        ? partialDecompose(value)
        : null,
    [results, compoundResult, value, partialDecompose],
  );

  // 입력값이 비었을 때 Popover 닫기
  useEffect(() => {
    if (!value.trim()) {
      setOpen(false);
    }
  }, [value]);

  /**
   * 스토어에 debounce로 값을 전파한다.
   *
   * 타이머 만료 시점에 IME 조합 중이면 전파를 건너뛴다.
   * 이를 통해 한글 연속 입력 중에는 스토어 갱신(→검색→Popover 리렌더)이
   * 발생하지 않아 IME 컨텍스트가 보존된다.
   */
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

  /**
   * 입력값 변경 핸들러.
   *
   * 항상 로컬 버퍼를 갱신하고, IME 조합 중이 아닐 때만 debounce 스케줄링한다.
   * 빈 값은 즉시 전파하여 Popover 닫기 등이 지연되지 않도록 한다.
   *
   * @param e 입력 이벤트
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // 빈 값은 즉시 전파 (Popover 닫기 등)
    if (!newValue.trim()) {
      clearTimeout(debounceRef.current);
      onChange(newValue);
      return;
    }

    if (!composingRef.current) {
      flushToStore();
    }
  };

  /** IME 조합 시작 핸들러 */
  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  /**
   * IME 조합 완료 핸들러.
   *
   * 조합이 끝나면 debounce를 스케줄링한다.
   * 받침 이동 시 즉시 compositionstart가 뒤따르므로,
   * 타이머 만료 시점의 composingRef 체크로 중간값 전파를 방지한다.
   */
  const handleCompositionEnd = () => {
    composingRef.current = false;
    flushToStore();
  };

  /**
   * blur 핸들러 — 포커스 이탈 시 미전파 값을 즉시 스토어에 반영한다.
   */
  const handleBlur = () => {
    clearTimeout(debounceRef.current);
    if (inputRef.current && inputRef.current.value !== value) {
      onChange(inputRef.current.value);
    }
  };

  /**
   * Term 항목 선택 핸들러.
   *
   * @param termId 선택한 Term ID
   */
  const handleSelectTerm = (termId: number) => {
    const term = results.find((t) => t.id === termId);
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

  /** 복합 용어 선택 핸들러 — 도메인 선택지가 2개 이상이면 2-phase 전환 */
  const handleSelectCompound = () => {
    if (!compoundResult) {
      return;
    }

    const uniqueDomainIds = [
      ...new Set(
        compoundResult.baseTerms.map((bt) => bt.domainId).filter((id): id is number => id !== null),
      ),
    ];

    if (uniqueDomainIds.length <= 1) {
      onSelectCompound(compoundResult);
      setOpen(false);
      return;
    }

    setPendingCompound(compoundResult);
  };

  /**
   * 도메인 선택 완료 핸들러 (2-phase).
   *
   * @param domainId 선택된 도메인 ID (null = 해제)
   */
  const handleDomainForCompound = (domainId: number | null) => {
    if (!pendingCompound) {
      return;
    }
    const domain = domainId != null ? findDomainById(domainId) : undefined;
    onSelectCompound({
      ...pendingCompound,
      domainId,
      physicalType: domain?.physicalType,
    });
    setPendingCompound(null);
    setOpen(false);
  };

  /** pendingCompound 기본 용어에서 추출된 고유 추천 도메인 목록 */
  const pendingSuggestedDomains = useMemo(() => {
    if (!pendingCompound) {
      return [];
    }
    const seen = new Set<number>();
    const result: SuggestedDomain[] = [];
    for (const bt of pendingCompound.baseTerms) {
      if (bt.domainId != null && !seen.has(bt.domainId)) {
        seen.add(bt.domainId);
        const domain = findDomainById(bt.domainId);
        if (domain) {
          result.push({ domain, fromTermName: bt.logicalName });
        }
      }
    }
    return result;
  }, [pendingCompound, findDomainById]);

  /** 신규 용어 등록 클릭 핸들러 */
  const handleRegisterNew = () => {
    onRegisterNew(localValue);
    setOpen(false);
  };

  /**
   * 부분 미매칭 세그먼트 등록 핸들러.
   *
   * @param segmentText 등록할 세그먼트 논리명
   */
  const handleRegisterPartial = (segmentText: string) => {
    onRegisterNew(segmentText, true);
    setOpen(false);
  };

  /**
   * 키보드 이벤트 핸들러.
   *
   * @param e 키보드 이벤트
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === KEYS.ESCAPE) {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === KEYS.ARROW_DOWN && !open && localValue.trim().length >= 1) {
      setOpen(true);
    }
    // Popover 열린 상태에서 ArrowUp/Down이 React Flow로 전파되는 것을 차단
    if (open && (e.key === KEYS.ARROW_DOWN || e.key === KEYS.ARROW_UP)) {
      e.stopPropagation();
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPendingCompound(null);
      }}
    >
      <PopoverAnchor asChild>
        <input
          ref={inputRef}
          className="nodrag flex-1 bg-transparent outline-none hover:bg-accent focus:bg-accent focus-visible:ring-1 focus-visible:ring-ring px-1 rounded min-w-0 text-xs"
          value={localValue}
          onChange={handleInputChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          onFocus={() => {
            if (!termLinked && localValue.trim().length >= 1) {
              // 클릭 이벤트 완료 후 Popover 열기 — Radix dismiss 로직과의 경합 방지
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
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          // input(Anchor) 클릭 시 Popover 닫힘 방지 — 커서 이동 의도
          if (inputRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        {pendingCompound ? (
          /* 2-phase: 도메인 선택 단계 */
          <Command>
            <CommandInput placeholder={t('erd.domain.searchPlaceholder')} />
            <CommandList>
              {/* 선택된 복합 용어 요약 */}
              <div className="px-3 py-2 border-b border-border text-xs">
                <span className="font-medium">{pendingCompound.query}</span>
                <span className="text-muted-foreground ml-1">→ {pendingCompound.physicalName}</span>
              </div>

              <DomainCommandList
                suggestedDomains={pendingSuggestedDomains}
                selectedDomainId={pendingCompound.domainId}
                onSelect={handleDomainForCompound}
              />
            </CommandList>
          </Command>
        ) : (
          /* 기본 검색 결과 */
          <Command shouldFilter={false}>
            <CommandList>
              {results.length === 0 && !compoundResult && !partialResult ? (
                <CommandEmpty>{t('erd.autocomplete.noResults')}</CommandEmpty>
              ) : results.length > 0 ? (
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
                          {termWithType.physicalType && ` (${termWithType.physicalType})`}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}

              {/* 복합 용어 해석 결과 */}
              {compoundResult && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t('erd.autocomplete.compoundHeading')}>
                    <CommandItem
                      value="compound-result"
                      onSelect={handleSelectCompound}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div>
                          <span className="font-medium">{compoundResult.query}</span>
                          <span className="text-muted-foreground ml-1">
                            → {compoundResult.physicalName}
                            {compoundResult.physicalType && ` (${compoundResult.physicalType})`}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {compoundResult.baseTerms
                            .map((bt) => `${bt.logicalName}→${bt.physicalName}`)
                            .join(' + ')}
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              {/* 부분 분해 결과 */}
              {partialResult && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t('erd.autocomplete.partialHeading')}>
                    {partialResult.segments.map((seg, i) =>
                      seg.matched ? (
                        <div key={i} className="px-3 py-1 text-xs flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-erd-validation-matched shrink-0" />
                          <span>{seg.text}</span>
                          <span className="text-muted-foreground">→ {seg.term!.physicalName}</span>
                        </div>
                      ) : (
                        <CommandItem
                          key={i}
                          value={`partial-${i}`}
                          onSelect={() => handleRegisterPartial(seg.text)}
                          className="cursor-pointer"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span className="font-medium">{seg.text}</span>
                          <span className="text-muted-foreground ml-1">
                            {t('erd.autocomplete.partialUnregistered')}
                          </span>
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={handleRegisterNew} className="cursor-pointer">
                  <Plus className="h-3 w-3" />
                  <span>{t('erd.autocomplete.registerNew')}</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
