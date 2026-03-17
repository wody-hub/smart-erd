import { useCallback, useRef } from 'react';
import type * as Monaco from 'monaco-editor';

/**
 * Monaco 에디터에 프로그래밍적으로 코드를 반영할 때 커서와 스크롤 위치를 보존한다.
 *
 * ERD→Code 동기화처럼 value prop 전체 교체로 인한 커서 점프를 방지한다.
 * `@monaco-editor/react`의 controlled value 업데이트보다 먼저 모델을 갱신하여,
 * 라이브러리의 `executeEdits` 호출을 건너뛰게 만든다.
 *
 * @param editorRef      Monaco 에디터 인스턴스 ref
 * @param onCodeTextChange React 상태 동기화 함수 (예: handleDslChange)
 * @returns syncCodeChange — 커서 보존 코드 업데이트 함수,
 *          isSyncing — 내부 동기화 중 여부,
 *          shouldIgnoreChange — 내부 동기화로 발생한 onChange 무시 여부
 */
export function useEditorCursorGuard(
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  onCodeTextChange: (value: string | undefined) => void,
) {
  /** 내부 동기화 중 onChange 억제 플래그 */
  const isSyncingRef = useRef(false);
  /** 다음 onChange에서 무시해야 하는 프로그램적 텍스트 */
  const pendingProgrammaticValueRef = useRef<string | null>(null);
  /** 내부 동기화 플래그 해제 예약 */
  const releaseFrameRef = useRef<number | null>(null);

  /**
   * 프로그래밍적 코드 업데이트 — 커서/스크롤 보존.
   *
   * 1. 커서·스크롤 위치를 스냅샷한다.
   * 2. `editor.executeEdits`로 모델을 직접 갱신한다 (onChange 억제).
   * 3. 커서를 복원한다 (문서 범위 내로 클램프).
   * 4. React 상태를 갱신한다 — 라이브러리의 value effect에서
   *    `model.getValue() === value`이므로 추가 executeEdits가 건너뛰어진다.
   *
   * @param value 새 코드 텍스트
   */
  const syncCodeChange = useCallback(
    (value: string | undefined) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const text = value ?? '';

      if (!editor || !model || text === model.getValue()) {
        onCodeTextChange(value);
        return;
      }

      // 1) 커서 · 스크롤 스냅샷
      const position = editor.getPosition();
      const scrollTop = editor.getScrollTop();
      const scrollLeft = editor.getScrollLeft();

      // 2) onChange 억제 후 모델 직접 갱신
      isSyncingRef.current = true;
      pendingProgrammaticValueRef.current = text;
      if (releaseFrameRef.current != null) {
        cancelAnimationFrame(releaseFrameRef.current);
      }
      editor.executeEdits('erd-sync', [
        { range: model.getFullModelRange(), text, forceMoveMarkers: false },
      ]);
      editor.pushUndoStop();
      releaseFrameRef.current = requestAnimationFrame(() => {
        isSyncingRef.current = false;
        releaseFrameRef.current = null;
      });

      // 3) 커서 복원 (문서 범위 내로 클램프)
      if (position) {
        const lineCount = model.getLineCount();
        const line = Math.min(position.lineNumber, lineCount);
        const maxCol = model.getLineMaxColumn(line);
        editor.setPosition({
          lineNumber: line,
          column: Math.min(position.column, maxCol),
        });
      }
      editor.setScrollPosition({ scrollTop, scrollLeft });

      // 4) React 상태 동기화
      onCodeTextChange(value);
    },
    [editorRef, onCodeTextChange],
  );

  /**
   * 내부 동기화 진행 여부를 반환한다 (Editor onChange 가드에서 호출).
   *
   * @returns 내부 동기화 중이면 true
   */
  const isSyncing = useCallback(() => isSyncingRef.current, []);

  /**
   * 프로그램적 변경으로 발생한 Editor onChange를 무시해야 하는지 판정한다.
   *
   * @param value Editor onChange 값
   * @returns 내부 동기화로 발생한 변경이면 true
   */
  const shouldIgnoreChange = useCallback((value: string | undefined) => {
    const text = value ?? '';
    if (pendingProgrammaticValueRef.current != null && text === pendingProgrammaticValueRef.current) {
      pendingProgrammaticValueRef.current = null;
      return true;
    }
    return isSyncingRef.current;
  }, []);

  return { syncCodeChange, isSyncing, shouldIgnoreChange };
}
