import { useState, useRef, useEffect, useCallback } from 'react';
import { parseDdl, type DdlParseResult } from '@/lib/ddl-parser';
import { STORAGE_KEYS } from '@/constants/storage';
import { buildParseQueueKey } from '@/lib/parse-queue-key';
import type { DbmsType } from '@/types/erd';

/** useDdlParse 훅 옵션 */
interface UseDdlParseOptions {
  /** DBMS 변경 시 localStorage에 저장할지 여부 */
  persistDbms?: boolean;
}

/** useDdlParse 훅 반환 타입 */
interface UseDdlParseReturn {
  /** 선택된 DBMS 타입 */
  dbms: DbmsType;
  /** DDL 텍스트 */
  ddlText: string;
  /** 파싱 결과 */
  parseResult: DdlParseResult | null;
  /** 파싱 중 여부 */
  parsing: boolean;
  /** DDL 텍스트 변경 핸들러 (Monaco Editor onChange 호환) */
  handleDdlChange: (value: string | undefined) => void;
  /** DBMS 변경 핸들러 */
  handleDbmsChange: (newDbms: DbmsType) => void;
  /** 상태 초기화 (다이얼로그 닫기 등) */
  resetParse: () => void;
}

/** 빈 코드 입력 시 사용하는 빈 스키마 파싱 결과 */
const EMPTY_PARSE_RESULT: DdlParseResult = {
  diagnostics: [],
  tables: [],
  relations: [],
  errors: [],
  tableRanges: [],
};

/**
 * DDL 디바운스 파싱 공통 훅.
 *
 * DdlCodeEditorPanel(패널)과 DdlImportDialog(다이얼로그)의 공통 상태 및 로직을 추출한다.
 * 500ms 디바운스 + parseSeqRef 시퀀스로 스테일 응답을 거부한다.
 *
 * @param options.persistDbms DBMS 선택을 localStorage에 저장할지 여부 (기본값: false)
 * @returns DDL 파싱 상태 및 핸들러
 */
export function useDdlParse({ persistDbms = false }: UseDdlParseOptions = {}): UseDdlParseReturn {
  /** 선택된 DBMS 타입 */
  const [dbms, setDbms] = useState<DbmsType>(() =>
    persistDbms
      ? (localStorage.getItem(STORAGE_KEYS.DDL_DBMS) as DbmsType) || 'postgresql'
      : 'postgresql',
  );
  /** DDL 텍스트 */
  const [ddlText, setDdlText] = useState('');
  /** 파싱 결과 */
  const [parseResult, setParseResult] = useState<DdlParseResult | null>(null);
  /** 파싱 중 여부 */
  const [parsing, setParsing] = useState(false);

  /** 디바운스 타이머 ref */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 최신 파싱 요청 시퀀스 (스테일 응답 거부용) */
  const parseSeqRef = useRef(0);
  /** 최신 ddlText 참조 (useCallback 안정화용) */
  const ddlTextRef = useRef(ddlText);
  ddlTextRef.current = ddlText;
  /** 최신 dbms 참조 (useCallback 안정화용) */
  const dbmsRef = useRef(dbms);
  dbmsRef.current = dbms;
  /** 마지막으로 큐잉한 DDL 파싱 요청 키 (text + dbms) */
  const lastQueuedParseKeyRef = useRef<string | null>(null);

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      parseSeqRef.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /**
   * DDL 텍스트에 대해 디바운스 파싱을 수행한다.
   *
   * @param text      DDL 텍스트
   * @param targetDbms 대상 DBMS
   */
  const debouncedParse = useCallback((text: string, targetDbms: DbmsType, force = false) => {
    const parseKey = buildParseQueueKey(targetDbms, text);
    if (!force && lastQueuedParseKeyRef.current === parseKey) {
      return;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setParsing(false);
    lastQueuedParseKeyRef.current = parseKey;
    const seq = ++parseSeqRef.current;

    if (!text.trim()) {
      setParseResult(EMPTY_PARSE_RESULT);
      setParsing(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null;
      const isCurrentRequest = () => seq === parseSeqRef.current;
      setParsing(true);
      try {
        const result = await parseDdl(text, targetDbms);
        if (!isCurrentRequest()) {
          return;
        }
        setParseResult(result);
      } catch (err) {
        if (!isCurrentRequest()) {
          return;
        }
        const msg = err instanceof Error ? err.message : 'Failed to parse DDL';
        setParseResult({
          diagnostics: [],
          tables: [],
          relations: [],
          errors: [msg],
          tableRanges: [],
        });
      } finally {
        if (isCurrentRequest()) {
          setParsing(false);
        }
      }
    }, 500);
  }, []);

  useEffect(() => {
    const parseKey = buildParseQueueKey(dbms, ddlText);
    if (!ddlText.trim()) {
      return;
    }
    if (lastQueuedParseKeyRef.current === parseKey && debounceTimerRef.current) {
      return;
    }
    debouncedParse(ddlText, dbms, true);
  }, [dbms, ddlText, debouncedParse]);

  /**
   * DDL 텍스트 변경 핸들러.
   *
   * @param value 새 DDL 텍스트 (Monaco Editor onChange 시그니처)
   */
  const handleDdlChange = useCallback(
    (value: string | undefined) => {
      const text = value ?? '';
      const parseKey = buildParseQueueKey(dbmsRef.current, text);
      if (text === ddlTextRef.current && lastQueuedParseKeyRef.current === parseKey) {
        return;
      }
      setDdlText(text);
      debouncedParse(text, dbmsRef.current);
    },
    [debouncedParse],
  );

  /**
   * DBMS 변경 핸들러.
   *
   * @param newDbms 새 DBMS 타입
   */
  const handleDbmsChange = useCallback(
    (newDbms: DbmsType) => {
      setDbms(newDbms);
      if (persistDbms) {
        localStorage.setItem(STORAGE_KEYS.DDL_DBMS, newDbms);
      }
      if (ddlTextRef.current.trim()) {
        debouncedParse(ddlTextRef.current, newDbms);
      }
    },
    [persistDbms, debouncedParse],
  );

  /** 상태 초기화 (다이얼로그 닫기 등에서 사용) */
  const resetParse = useCallback(() => {
    parseSeqRef.current += 1;
    setDdlText('');
    setParseResult(null);
    setParsing(false);
    lastQueuedParseKeyRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return {
    dbms,
    ddlText,
    parseResult,
    parsing,
    handleDdlChange,
    handleDbmsChange,
    resetParse,
  };
}
