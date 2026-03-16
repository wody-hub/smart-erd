import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';

/** 커서 정지 시 빠른 등록 팝업 노출 대기 시간(ms) */
const QUICK_ACTION_IDLE_DELAY_MS = 700;

/** useIdleCursorAction 훅 옵션 */
interface UseIdleCursorActionOptions {
  /** Monaco 에디터 인스턴스 ref */
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 보조 팝업 열기 함수 */
  openAssistPopup: (options?: { position?: Monaco.Position; autoOnly?: boolean }) => void;
  /** 보조 팝업 닫기 함수 */
  closeAssistPopup: () => void;
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
  canEdit,
  openAssistPopup,
  closeAssistPopup,
  isSyncing,
}: UseIdleCursorActionOptions): void {
  /** 커서 정지 기반 빠른 등록 팝업 타이머 */
  const idleQuickActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 커서 정지 판정용 마지막 커서 위치 */
  const idleCursorSnapshotRef = useRef<{ lineNumber: number; column: number } | null>(null);

  /** 커서 정지 팝업 타이머를 정리한다. */
  const clearIdleQuickActionTimer = useCallback(() => {
    if (idleQuickActionTimerRef.current) {
      clearTimeout(idleQuickActionTimerRef.current);
      idleQuickActionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !canEdit) {
      clearIdleQuickActionTimer();
      closeAssistPopup();
      return;
    }

    /**
     * 커서 정지 후 자동 보조 팝업을 띄우기 위한 타이머를 예약한다.
     */
    const scheduleIdleQuickAction = () => {
      clearIdleQuickActionTimer();
      const pos = editor.getPosition();
      if (!pos) {
        return;
      }
      idleCursorSnapshotRef.current = { lineNumber: pos.lineNumber, column: pos.column };

      idleQuickActionTimerRef.current = setTimeout(() => {
        const currentPos = editor.getPosition();
        const snapshot = idleCursorSnapshotRef.current;
        if (!currentPos || !snapshot) {
          return;
        }
        if (
          currentPos.lineNumber !== snapshot.lineNumber ||
          currentPos.column !== snapshot.column
        ) {
          return;
        }

        openAssistPopup({ position: currentPos, autoOnly: true });
      }, QUICK_ACTION_IDLE_DELAY_MS);
    };

    const changeDisposable = editor.onDidChangeModelContent(() => {
      // ERD→Code 동기화(커서 가드)에 의한 콘텐츠 변경 시 팝업을 유지한다.
      if (!isSyncing()) {
        closeAssistPopup();
      }
      scheduleIdleQuickAction();
    });
    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      closeAssistPopup();
      scheduleIdleQuickAction();
    });
    const focusDisposable = editor.onDidFocusEditorText(scheduleIdleQuickAction);
    const scrollDisposable = editor.onDidScrollChange(closeAssistPopup);
    const blurDisposable = editor.onDidBlurEditorText(() => {
      clearIdleQuickActionTimer();
      closeAssistPopup();
    });

    scheduleIdleQuickAction();

    return () => {
      clearIdleQuickActionTimer();
      changeDisposable.dispose();
      cursorDisposable.dispose();
      focusDisposable.dispose();
      scrollDisposable.dispose();
      blurDisposable.dispose();
    };
  }, [canEdit, clearIdleQuickActionTimer, closeAssistPopup, editorRef, isSyncing, openAssistPopup]);
}
