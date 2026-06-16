import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { AUTO_ASSIST_TRIGGER_DELAY_MS, type AssistPopupTrigger } from '@/lib/dsl-assist';

type AutoAssistTrigger = Exclude<AssistPopupTrigger, 'manual'>;
/** Monaco mount 이후 ref 준비를 기다리는 재시도 간격 */
const IDLE_CURSOR_ATTACH_RETRY_MS = 50;
const TYPING_ASSIST_CONTEXT_REGEX = /[\p{L}\p{N}_]$/u;

function isTypingAssistContext(
  editor: Monaco.editor.IStandaloneCodeEditor,
  position: Monaco.IPosition,
): boolean {
  const model = editor.getModel();
  if (!model) {
    return false;
  }
  const textBeforeCursor = model
    .getLineContent(position.lineNumber)
    .slice(0, Math.max(0, position.column - 1));
  return TYPING_ASSIST_CONTEXT_REGEX.test(textBeforeCursor);
}

/** useIdleCursorAction 훅 옵션 */
interface UseIdleCursorActionOptions {
  /** Monaco 에디터 인스턴스 ref */
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** Monaco editor 인스턴스 교체 감지용 버전 */
  editorInstanceVersion?: number;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 보조 팝업 열기 함수 */
  openAssistPopup: (options?: {
    position?: Monaco.IPosition;
    trigger?: AssistPopupTrigger;
  }) => void;
  /** 보조 팝업 닫기 함수 */
  closeAssistPopup: () => void;
  /** 다음 content change에서 typing 자동 보조 팝업 예약을 1회 억제한다. */
  suppressNextTypingAssistRef?: React.MutableRefObject<boolean>;
  /** 내부 동기화 중 여부 판별 함수 */
  isSyncing: () => boolean;
}

/**
 * 커서가 일정 시간 정지하면 자동으로 보조 팝업을 표시하는 훅.
 *
 * 에디터 내용 변경, 커서 이동, 포커스, 스크롤, 블러 이벤트를 감지하여
 * 적절한 시점에 팝업을 열거나 닫는다.
 *
 * @param options 훅 옵션
 */
export function useIdleCursorAction({
  editorRef,
  editorInstanceVersion = 0,
  canEdit,
  openAssistPopup,
  closeAssistPopup,
  suppressNextTypingAssistRef,
  isSyncing,
}: UseIdleCursorActionOptions): void {
  /** 자동 보조 팝업 타이머 */
  const autoAssistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 현재 예약된 자동 보조 팝업 스냅샷 */
  const scheduledAssistRef = useRef<{
    trigger: AutoAssistTrigger;
    position: Monaco.IPosition;
  } | null>(null);
  /** 직전 변경이 실제 텍스트 수정이었는지 여부 */
  const pendingTypingCursorRef = useRef(false);
  /** 마우스 클릭으로 포커스 예정인지 여부 */
  const pendingMouseFocusRef = useRef(false);
  /** 클릭 직후 hover 자동완성 1회를 억제한다. */
  const suppressHoverUntilMoveRef = useRef(false);
  /** 최신 외부 콜백을 이벤트 리스너와 타이머에서 참조한다. */
  const callbacksRef = useRef({
    openAssistPopup,
    closeAssistPopup,
    isSyncing,
  });

  useEffect(() => {
    callbacksRef.current = {
      openAssistPopup,
      closeAssistPopup,
      isSyncing,
    };
  }, [closeAssistPopup, isSyncing, openAssistPopup]);

  /** 커서 정지 팝업 타이머를 정리한다. */
  const clearAutoAssistTimer = useCallback(() => {
    if (autoAssistTimerRef.current) {
      clearTimeout(autoAssistTimerRef.current);
      autoAssistTimerRef.current = null;
    }
    scheduledAssistRef.current = null;
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposables: Monaco.IDisposable[] = [];

    const attachIdleCursorAction = () => {
      if (disposed) {
        return;
      }

      const editor = editorRef.current;
      if (!canEdit) {
        clearAutoAssistTimer();
        callbacksRef.current.closeAssistPopup();
        return;
      }
      if (!editor) {
        retryTimer = setTimeout(attachIdleCursorAction, IDLE_CURSOR_ATTACH_RETRY_MS);
        return;
      }

      /**
       * 트리거 유형별 자동 보조 팝업을 예약한다.
       */
      const scheduleAutoAssist = (trigger: AutoAssistTrigger, position: Monaco.IPosition) => {
        clearAutoAssistTimer();
        const snapshot = {
          trigger,
          position: { lineNumber: position.lineNumber, column: position.column },
        };
        scheduledAssistRef.current = snapshot;

        autoAssistTimerRef.current = setTimeout(() => {
          const current = scheduledAssistRef.current;
          if (!current || current.trigger !== trigger) {
            return;
          }

          if (trigger === 'hover') {
            if (
              current.position.lineNumber !== snapshot.position.lineNumber ||
              current.position.column !== snapshot.position.column
            ) {
              return;
            }
            callbacksRef.current.openAssistPopup({ position: current.position, trigger });
            return;
          }

          const currentPos = editor.getPosition();
          if (!currentPos) {
            return;
          }
          if (
            trigger !== 'typing' &&
            (currentPos.lineNumber !== snapshot.position.lineNumber ||
              currentPos.column !== snapshot.position.column)
          ) {
            return;
          }

          if (trigger === 'typing') {
            pendingTypingCursorRef.current = false;
            if (!isTypingAssistContext(editor, currentPos)) {
              return;
            }
          }
          callbacksRef.current.openAssistPopup({ position: currentPos, trigger });
        }, AUTO_ASSIST_TRIGGER_DELAY_MS[trigger]);
      };

      const changeDisposable = editor.onDidChangeModelContent(() => {
        if (suppressNextTypingAssistRef?.current) {
          suppressNextTypingAssistRef.current = false;
          pendingTypingCursorRef.current = false;
          clearAutoAssistTimer();
          callbacksRef.current.closeAssistPopup();
          return;
        }
        pendingTypingCursorRef.current = true;
        if (callbacksRef.current.isSyncing()) {
          clearAutoAssistTimer();
          callbacksRef.current.closeAssistPopup();
          return;
        }
        callbacksRef.current.closeAssistPopup();
        const pos = editor.getPosition();
        if (pos) {
          scheduleAutoAssist('typing', pos);
        }
      });
      const cursorDisposable = editor.onDidChangeCursorPosition(() => {
        if (pendingTypingCursorRef.current) {
          pendingTypingCursorRef.current = false;
          const pos = editor.getPosition();
          if (pos && scheduledAssistRef.current?.trigger === 'typing') {
            scheduleAutoAssist('typing', pos);
          }
          return;
        }
        callbacksRef.current.closeAssistPopup();
        clearAutoAssistTimer();
      });
      const mouseDownDisposable = editor.onMouseDown(() => {
        pendingMouseFocusRef.current = true;
        suppressHoverUntilMoveRef.current = true;
        clearAutoAssistTimer();
        callbacksRef.current.closeAssistPopup();
      });
      const focusDisposable = editor.onDidFocusEditorText(() => {
        if (!pendingMouseFocusRef.current) {
          return;
        }
        pendingMouseFocusRef.current = false;
        const pos = editor.getPosition();
        if (pos) {
          scheduleAutoAssist('focus', pos);
        }
      });
      const mouseMoveDisposable = editor.onMouseMove((event) => {
        const pos = event.target.position;
        if (!pos) {
          return;
        }
        if (suppressHoverUntilMoveRef.current) {
          suppressHoverUntilMoveRef.current = false;
          return;
        }
        scheduleAutoAssist('hover', pos);
      });
      const mouseLeaveDisposable = editor.onMouseLeave(() => {
        clearAutoAssistTimer();
      });
      const scrollDisposable = editor.onDidScrollChange((event) => {
        if (!event.scrollTopChanged && !event.scrollLeftChanged) {
          return;
        }
        clearAutoAssistTimer();
        callbacksRef.current.closeAssistPopup();
      });
      const blurDisposable = editor.onDidBlurEditorText(() => {
        pendingMouseFocusRef.current = false;
        suppressHoverUntilMoveRef.current = false;
        clearAutoAssistTimer();
        callbacksRef.current.closeAssistPopup();
      });

      disposables = [
        changeDisposable,
        cursorDisposable,
        mouseDownDisposable,
        focusDisposable,
        mouseMoveDisposable,
        mouseLeaveDisposable,
        scrollDisposable,
        blurDisposable,
      ];
    };

    attachIdleCursorAction();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      clearAutoAssistTimer();
      disposables.forEach((disposable) => disposable.dispose());
    };
  }, [
    canEdit,
    clearAutoAssistTimer,
    editorInstanceVersion,
    editorRef,
    suppressNextTypingAssistRef,
  ]);
}
