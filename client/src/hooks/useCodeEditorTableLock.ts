import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type * as Monaco from 'monaco-editor';
import { CODE_LOCK_GRACE_MS } from '@/constants/code-sync';
import type { ParsedTableRange } from '@/lib/ddl-parser';
import useCanvasStore from '@/stores/useCanvasStore';

/** 코드 에디터 테이블 락 훅 옵션 */
interface UseCodeEditorTableLockOptions {
  /** 기능 활성 여부 */
  enabled: boolean;
  /** 에디터 mount 완료 여부 */
  editorReady?: boolean;
  /** Monaco 에디터 인스턴스 ref */
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** 파싱된 테이블 라인 범위 목록 */
  tableRanges: ParsedTableRange[];
  /** 현재 파싱 에러 존재 여부 */
  hasParseErrors: boolean;
  /** 파싱 에러 시 락 유지 grace 시간 */
  graceMs?: number;
}

/**
 * 코드 에디터 커서 위치를 기준으로 편집 테이블 락을 발행한다.
 *
 * 문법 오류 중에는 마지막 정상 락 키를 grace 시간만큼 유지한다.
 */
export function useCodeEditorTableLock({
  enabled,
  editorReady = true,
  editorRef,
  tableRanges,
  hasParseErrors,
  graceMs = CODE_LOCK_GRACE_MS,
}: UseCodeEditorTableLockOptions): void {
  const setCodeEditingTableKey = useCanvasStore((s) => s.setCodeEditingTableKey);

  const focusedRef = useRef(false);
  const currentLockKeyRef = useRef<string | null>(null);
  const currentRangeRef = useRef<{ startLine: number; endLine: number; tableKey: string } | null>(
    null,
  );
  const lastResolvedKeyRef = useRef<string | null>(null);
  const lastResolvedAtRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const tableRangesRef = useRef(tableRanges);
  const hasParseErrorsRef = useRef(hasParseErrors);

  const setLockKey = useCallback(
    (nextKey: string | null) => {
      if (currentLockKeyRef.current === nextKey) {
        return;
      }
      currentLockKeyRef.current = nextKey;
      setCodeEditingTableKey(nextKey);
    },
    [setCodeEditingTableKey],
  );

  const resolveRangeByLine = useCallback((lineNumber: number): ParsedTableRange | null => {
    for (const range of tableRangesRef.current) {
      if (lineNumber >= range.startLine && lineNumber <= range.endLine) {
        return range;
      }
    }
    return null;
  }, []);

  const evaluateCurrentLock = useCallback(() => {
    if (!enabledRef.current || !focusedRef.current) {
      setLockKey(null);
      return;
    }

    const editor = editorRef.current;
    const position = editor?.getPosition();
    if (!position) {
      setLockKey(null);
      return;
    }

    const resolvedRange = resolveRangeByLine(position.lineNumber);
    if (resolvedRange) {
      const currentRange = currentRangeRef.current;
      if (
        currentRange &&
        currentRange.startLine === resolvedRange.startLine &&
        currentRange.endLine === resolvedRange.endLine
      ) {
        // 편집 중 같은 범위에 머무는 동안에는 락 키를 고정한다.
        setLockKey(currentRange.tableKey);
        lastResolvedKeyRef.current = currentRange.tableKey;
      } else {
        currentRangeRef.current = {
          startLine: resolvedRange.startLine,
          endLine: resolvedRange.endLine,
          tableKey: resolvedRange.tableKey,
        };
        lastResolvedKeyRef.current = resolvedRange.tableKey;
        setLockKey(resolvedRange.tableKey);
      }
      lastResolvedAtRef.current = Date.now();
      return;
    }

    if (
      hasParseErrorsRef.current &&
      lastResolvedKeyRef.current &&
      Date.now() - lastResolvedAtRef.current <= graceMs
    ) {
      setLockKey(lastResolvedKeyRef.current);
      return;
    }

    setLockKey(null);
    currentRangeRef.current = null;
  }, [editorRef, graceMs, resolveRangeByLine, setLockKey]);

  useEffect(() => {
    if (!editorReady) {
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    focusedRef.current = editor.hasTextFocus();
    evaluateCurrentLock();

    const focusDisposable = editor.onDidFocusEditorText(() => {
      focusedRef.current = true;
      evaluateCurrentLock();
    });
    const blurDisposable = editor.onDidBlurEditorText(() => {
      focusedRef.current = false;
      currentRangeRef.current = null;
      setLockKey(null);
    });
    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      evaluateCurrentLock();
    });
    const contentDisposable = editor.onDidChangeModelContent(() => {
      evaluateCurrentLock();
    });

    return () => {
      focusDisposable.dispose();
      blurDisposable.dispose();
      cursorDisposable.dispose();
      contentDisposable.dispose();
      focusedRef.current = false;
      currentLockKeyRef.current = null;
      currentRangeRef.current = null;
      setCodeEditingTableKey(null);
    };
  }, [editorReady, editorRef, evaluateCurrentLock, setCodeEditingTableKey, setLockKey]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      currentRangeRef.current = null;
    }
    evaluateCurrentLock();
  }, [enabled, evaluateCurrentLock]);

  useEffect(() => {
    tableRangesRef.current = tableRanges;
    evaluateCurrentLock();
  }, [evaluateCurrentLock, tableRanges]);

  useEffect(() => {
    hasParseErrorsRef.current = hasParseErrors;
    evaluateCurrentLock();
  }, [evaluateCurrentLock, hasParseErrors]);
}
