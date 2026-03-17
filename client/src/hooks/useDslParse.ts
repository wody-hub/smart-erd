import { useState, useRef, useEffect, useCallback } from 'react';
import { parseDsl, type DslDictionary, type DslParseResult } from '@/lib/dsl-parser';
import type {
  DslParserWorkerRequest,
  DslParserWorkerResponse,
} from '@/lib/dsl-parser-worker-contract';
import { buildParseQueueKey } from '@/lib/parse-queue-key';

/** useDslParse 훅 옵션 */
interface UseDslParseOptions {
  /** 사전 데이터 (Term/Domain 매핑) */
  dictionary: DslDictionary;
}

/** useDslParse 훅 반환 타입 */
interface UseDslParseReturn {
  /** DSL 텍스트 */
  dslText: string;
  /** 파싱 결과 */
  parseResult: DslParseResult | null;
  /** 파싱 중 여부 */
  parsing: boolean;
  /** DSL 텍스트 변경 핸들러 (Monaco Editor onChange 호환) */
  handleDslChange: (value: string | undefined) => void;
  /** 현재 DSL 텍스트를 강제로 다시 파싱한다. */
  reparseDsl: () => void;
}

/** 빈 코드 입력 시 사용하는 빈 스키마 파싱 결과 */
const EMPTY_PARSE_RESULT: DslParseResult = {
  result: {
    diagnostics: [],
    tables: [],
    relations: [],
    errors: [],
    tableRanges: [],
  },
  diagnostics: [],
  physicalNameHints: [],
};

/**
 * DSL 디바운스 파싱 훅.
 *
 * useDdlParse 패턴과 동일하되, parseDsl()은 동기 함수이므로 async/await 불필요.
 * 500ms 디바운스 + parseSeqRef 시퀀스로 스테일 응답을 거부한다.
 *
 * @param options.dictionary 사전 데이터
 * @returns DSL 파싱 상태 및 핸들러
 */
export function useDslParse({ dictionary }: UseDslParseOptions): UseDslParseReturn {
  /** DSL 텍스트 */
  const [dslText, setDslText] = useState('');
  /** 파싱 결과 */
  const [parseResult, setParseResult] = useState<DslParseResult | null>(null);
  /** 파싱 중 여부 */
  const [parsing, setParsing] = useState(false);

  /** 디바운스 타이머 ref */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 최신 파싱 요청 시퀀스 (스테일 응답 거부용) */
  const parseSeqRef = useRef(0);
  /** 최신 dictionary 참조 */
  const dictionaryRef = useRef(dictionary);
  dictionaryRef.current = dictionary;
  /** 마지막으로 반영한 dictionary 참조 */
  const lastDictionaryRef = useRef(dictionary);
  /** 최신 dslText 참조 */
  const dslTextRef = useRef(dslText);
  dslTextRef.current = dslText;
  /** 마지막으로 큐잉한 DSL 파싱 요청 키 */
  const lastQueuedParseKeyRef = useRef<string | null>(null);
  /** 마지막으로 실제 실행된 DSL 파싱 요청 키 */
  const lastExecutedParseKeyRef = useRef<string | null>(null);
  /** DSL parser worker 참조 */
  const workerRef = useRef<Worker | null>(null);
  /** 워커 사용 가능 여부 */
  const workerEnabledRef = useRef(false);

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      parseSeqRef.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      workerEnabledRef.current = false;
      return;
    }

    const worker = new Worker(new URL('../workers/dslParser.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    workerEnabledRef.current = true;
    worker.postMessage({
      type: 'set-dictionary',
      dictionary: dictionaryRef.current,
    } satisfies DslParserWorkerRequest);

    const handleWorkerMessage = (event: MessageEvent<DslParserWorkerResponse>) => {
      const message = event.data;
      if (message.requestId !== parseSeqRef.current) {
        return;
      }
      if (message.type === 'parsed') {
        lastExecutedParseKeyRef.current = message.parseKey;
        setParseResult(message.result);
        setParsing(false);
        return;
      }

      workerEnabledRef.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
      const fallbackResult = parseDsl(dslTextRef.current, dictionaryRef.current);
      if (message.requestId !== parseSeqRef.current) {
        setParsing(false);
        return;
      }
      lastExecutedParseKeyRef.current = message.parseKey;
      setParseResult(fallbackResult);
      setParsing(false);
    };

    const handleWorkerError = () => {
      workerEnabledRef.current = false;
      worker.terminate();
      workerRef.current = null;
      const latestText = dslTextRef.current;
      if (!latestText.trim()) {
        setParsing(false);
        return;
      }
      const parseKey = buildParseQueueKey(latestText);
      const result = parseDsl(latestText, dictionaryRef.current);
      if (parseKey !== lastQueuedParseKeyRef.current) {
        setParsing(false);
        return;
      }
      lastExecutedParseKeyRef.current = parseKey;
      setParseResult(result);
      setParsing(false);
    };

    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', handleWorkerError);

    return () => {
      worker.removeEventListener('message', handleWorkerMessage);
      worker.removeEventListener('error', handleWorkerError);
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * DSL 텍스트에 대해 디바운스 파싱을 수행한다.
   *
   * @param text DSL 텍스트
   */
  const debouncedParse = useCallback((text: string, force = false) => {
    const parseKey = buildParseQueueKey(text);
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

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setParsing(true);
      if (seq !== parseSeqRef.current) {
        setParsing(false);
        return;
      }
      const worker = workerRef.current;
      if (workerEnabledRef.current && worker) {
        worker.postMessage({
          type: 'parse',
          requestId: seq,
          parseKey,
          text,
        } satisfies DslParserWorkerRequest);
        return;
      }
      lastExecutedParseKeyRef.current = parseKey;
      const result = parseDsl(text, dictionaryRef.current);
      if (seq !== parseSeqRef.current) {
        setParsing(false);
        return;
      }
      setParseResult(result);
      setParsing(false);
    }, 300);
  }, []);

  useEffect(() => {
    const parseKey = buildParseQueueKey(dslText);
    if (!dslText.trim()) {
      return;
    }
    if (lastExecutedParseKeyRef.current === parseKey || debounceTimerRef.current) {
      return;
    }
    debouncedParse(dslText, true);
  }, [debouncedParse, dslText]);

  useEffect(() => {
    if (lastDictionaryRef.current === dictionary) {
      return;
    }
    lastDictionaryRef.current = dictionary;
    if (workerEnabledRef.current && workerRef.current) {
      workerRef.current.postMessage({
        type: 'set-dictionary',
        dictionary,
      } satisfies DslParserWorkerRequest);
    }
    if (!dslTextRef.current.trim()) {
      return;
    }
    debouncedParse(dslTextRef.current, true);
  }, [debouncedParse, dictionary]);

  /**
   * DSL 텍스트 변경 핸들러.
   *
   * @param value 새 DSL 텍스트 (Monaco Editor onChange 시그니처)
   */
  const handleDslChange = useCallback(
    (value: string | undefined) => {
      const text = value ?? '';
      const parseKey = buildParseQueueKey(text);
      if (text === dslTextRef.current && lastQueuedParseKeyRef.current === parseKey) {
        return;
      }
      setDslText(text);
      debouncedParse(text);
    },
    [debouncedParse],
  );

  /**
   * 현재 DSL 텍스트를 강제로 다시 파싱한다.
   *
   * 사전 갱신처럼 동일 텍스트 재평가가 필요한 경우에 사용한다.
   */
  const reparseDsl = useCallback(() => {
    debouncedParse(dslTextRef.current, true);
  }, [debouncedParse]);

  return {
    dslText,
    parseResult,
    parsing,
    handleDslChange,
    reparseDsl,
  };
}
