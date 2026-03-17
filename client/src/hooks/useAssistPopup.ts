import { useState, useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import type { AssistPopupItem } from '@/hooks/useDslEditorCompletion';
import type { AssistPopupState } from '@/components/erd/DslAssistPopup';
import { filterAssistItemsForTrigger, type AssistPopupTrigger } from '@/lib/dsl-assist';

/** 보조 팝업 최초 노출 건수 */
const ASSIST_POPUP_INITIAL_VISIBLE = 10;
/** 보조 팝업 더보기 증가 건수 */
const ASSIST_POPUP_VISIBLE_STEP = 10;

/** useAssistPopup 훅 옵션 */
interface UseAssistPopupOptions {
  /** Monaco 에디터 인스턴스 ref */
  editorRef: React.MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  /** Monaco 네임스페이스 ref */
  monacoRef: React.MutableRefObject<typeof Monaco | null>;
  /** 편집 가능 여부 */
  canEdit: boolean;
  /** 보조 항목 빌드 함수 */
  buildAssistItems: (
    model: Monaco.editor.ITextModel,
    position: Monaco.IPosition,
    includeSnippets: boolean,
    trigger?: AssistPopupTrigger,
  ) => AssistPopupItem[];
  /** 용어 등록 요청 핸들러 */
  onRegisterTerm: (logicalName: string, lineNumber?: number | null) => void;
  /** 도메인 등록 요청 핸들러 */
  onRegisterDomain: (logicalName: string) => void;
}

/** useAssistPopup 훅 반환값 */
interface UseAssistPopupReturn {
  /** 현재 보조 팝업 상태 (null이면 닫힘) */
  assistPopup: AssistPopupState | null;
  /** 보조 팝업 리스트 DOM ref */
  assistPopupListRef: React.MutableRefObject<HTMLUListElement | null>;
  /** 보조 팝업을 연다 */
  openAssistPopup: (options?: { position?: Monaco.IPosition; trigger?: AssistPopupTrigger }) => void;
  /** 보조 팝업을 닫는다 */
  closeAssistPopup: () => void;
  /** 보조 팝업을 불투명(강조) 모드로 승격한다 */
  promoteAssistPopup: () => void;
  /** 보조 팝업 선택 인덱스를 갱신한다 */
  setAssistPopupSelectedIndex: (nextIndex: number) => void;
  /** 보조 팝업 선택 항목을 실행한다 */
  executeAssistPopupItem: (item: AssistPopupItem) => void;
  /** 보조 팝업 노출 건수를 확장한다 */
  expandAssistPopupVisibleCount: () => void;
}

/**
 * DSL 에디터 보조 팝업(Assist Popup) 상태·조작·키바인딩을 캡슐화하는 훅.
 *
 * 팝업 열기/닫기, 선택 인덱스 이동, 항목 실행, 키보드 단축키 등록을
 * 하나의 훅으로 통합하여 DslCodeEditorPanel의 복잡도를 줄인다.
 *
 * @param options 훅 옵션
 * @returns 보조 팝업 상태 및 조작 함수
 */
export function useAssistPopup({
  editorRef,
  monacoRef,
  canEdit,
  buildAssistItems,
  onRegisterTerm,
  onRegisterDomain,
}: UseAssistPopupOptions): UseAssistPopupReturn {
  /** 단일 보조(Assist) 팝업 상태 */
  const [assistPopup, setAssistPopup] = useState<AssistPopupState | null>(null);
  /** 최신 보조 팝업 상태(ref) */
  const assistPopupRef = useRef<AssistPopupState | null>(null);
  /** 보조 팝업 가시성 컨텍스트 키 ref */
  const assistPopupVisibleKeyRef = useRef<Monaco.editor.IContextKey<boolean> | null>(null);
  /** 보조 팝업 리스트 DOM ref */
  const assistPopupListRef = useRef<HTMLUListElement | null>(null);

  /** 보조 팝업 상태를 ref/state에 동기 반영한다. */
  const setAssistPopupSync = useCallback((next: AssistPopupState | null) => {
    assistPopupRef.current = next;
    assistPopupVisibleKeyRef.current?.set(Boolean(next));
    setAssistPopup(next);
  }, []);

  /** 보조 팝업을 닫는다. */
  const closeAssistPopup = useCallback(() => {
    setAssistPopupSync(null);
  }, [setAssistPopupSync]);

  /** 보조 팝업을 불투명(강조) 모드로 승격한다. */
  const promoteAssistPopup = useCallback(() => {
    const popup = assistPopupRef.current;
    if (!popup || !popup.preview) {
      return;
    }
    setAssistPopupSync({
      ...popup,
      preview: false,
    });
  }, [setAssistPopupSync]);

  /** 보조 팝업 선택 인덱스를 갱신한다. */
  const setAssistPopupSelectedIndex = useCallback(
    (nextIndex: number) => {
      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const visibleLimit = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      const clamped = Math.max(0, Math.min(nextIndex, visibleLimit - 1));
      setAssistPopupSync({
        ...popup,
        selectedIndex: clamped,
      });
    },
    [setAssistPopupSync],
  );

  /** 보조 팝업 노출 건수를 확장한다. */
  const expandAssistPopupVisibleCount = useCallback(() => {
    const popup = assistPopupRef.current;
    if (!popup) {
      return;
    }
    const nextVisible = Math.min(
      popup.items.length,
      popup.visibleCount + ASSIST_POPUP_VISIBLE_STEP,
    );
    if (nextVisible === popup.visibleCount) {
      return;
    }
    setAssistPopupSync({
      ...popup,
      visibleCount: nextVisible,
    });
  }, [setAssistPopupSync]);

  /** 보조 팝업을 연다. */
  const openAssistPopup = useCallback(
    (options?: { position?: Monaco.IPosition; trigger?: AssistPopupTrigger }) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const position = options?.position ?? editor.getPosition();
      if (!position) {
        return;
      }

      const trigger = options?.trigger ?? 'manual';
      const preview = trigger !== 'manual';
      const items = filterAssistItemsForTrigger(buildAssistItems(model, position, true, trigger), trigger);
      if (preview && assistPopupRef.current && !assistPopupRef.current.preview) {
        return;
      }
      if (items.length === 0) {
        closeAssistPopup();
        return;
      }

      const anchor = editor.getScrolledVisiblePosition(position);
      if (!anchor) {
        return;
      }

      const layout = editor.getLayoutInfo();
      const popupWidth = 312;
      const popupHeight = Math.min(260, 76 + items.length * 34);
      const left = Math.min(
        Math.max(anchor.left + 12, 8),
        Math.max(8, layout.width - popupWidth - 8),
      );
      const top =
        anchor.top + anchor.height + popupHeight <= layout.height
          ? anchor.top + anchor.height + 8
          : Math.max(8, anchor.top - popupHeight - 8);

      setAssistPopupSync({
        items,
        selectedIndex: 0,
        left,
        top,
        preview,
        visibleCount: Math.min(ASSIST_POPUP_INITIAL_VISIBLE, items.length),
      });
    },
    [buildAssistItems, closeAssistPopup, editorRef, setAssistPopupSync],
  );

  /** 보조 팝업 선택 항목을 실행한다. */
  const executeAssistPopupItem = useCallback(
    (item: AssistPopupItem) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor) {
        return;
      }

      if (item.type === 'registerTerm') {
        closeAssistPopup();
        onRegisterTerm(item.name ?? '', item.lineNumber);
        return;
      }
      if (item.type === 'registerDomain') {
        closeAssistPopup();
        onRegisterDomain(item.name ?? '');
        return;
      }

      if (!monaco || !item.insertText) {
        return;
      }
      const insertText = item.insertText;
      editor.executeEdits('dsl-assist', [
        {
          range: new monaco.Range(
            item.lineNumber,
            item.startColumn,
            item.lineNumber,
            item.endColumn,
          ),
          text: insertText,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
      closeAssistPopup();
    },
    [closeAssistPopup, editorRef, monacoRef, onRegisterDomain, onRegisterTerm],
  );

  /** 최신 보조 팝업 상태를 ref로 유지한다. */
  useEffect(() => {
    assistPopupRef.current = assistPopup;
    assistPopupVisibleKeyRef.current?.set(Boolean(assistPopup));
  }, [assistPopup]);

  /** 선택 항목이 바뀌면 리스트를 자동 스크롤한다. */
  useEffect(() => {
    if (!assistPopup) {
      return;
    }
    const list = assistPopupListRef.current;
    if (!list) {
      return;
    }
    const selectedEl = list.querySelector<HTMLElement>(
      `[data-assist-index="${assistPopup.selectedIndex}"]`,
    );
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [assistPopup]);

  // Ctrl+Space는 팝업 오픈 트리거로 유지한다.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !canEdit) {
      closeAssistPopup();
      return;
    }

    const keyDownDisposable = editor.onKeyDown((event) => {
      const browserEvent = event.browserEvent;
      /**
       * 현재 키 이벤트를 Monaco/브라우저 양쪽에서 소비 처리한다.
       */
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
        browserEvent.preventDefault();
        browserEvent.stopPropagation();
        browserEvent.stopImmediatePropagation?.();
      };

      const isCtrlSpace =
        event.keyCode === monaco.KeyCode.Space && (browserEvent.ctrlKey || browserEvent.metaKey);
      if (isCtrlSpace) {
        consume();
        openAssistPopup({ trigger: 'manual' });
        return;
      }

      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const visibleCount = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      if (browserEvent.isComposing) {
        return;
      }
      if (browserEvent.altKey || browserEvent.ctrlKey || browserEvent.metaKey) {
        return;
      }

      if (event.keyCode === monaco.KeyCode.DownArrow) {
        consume();
        setAssistPopupSelectedIndex((popup.selectedIndex + 1) % visibleCount);
        return;
      }

      if (event.keyCode === monaco.KeyCode.UpArrow) {
        consume();
        setAssistPopupSelectedIndex((popup.selectedIndex - 1 + visibleCount) % visibleCount);
        return;
      }

      if (
        (event.keyCode === monaco.KeyCode.Enter && !browserEvent.shiftKey) ||
        event.keyCode === monaco.KeyCode.Tab
      ) {
        consume();
        const selected = popup.items[popup.selectedIndex] ?? popup.items[0];
        if (selected) {
          executeAssistPopupItem(selected);
        }
        return;
      }

      if (event.keyCode === monaco.KeyCode.Escape) {
        consume();
        closeAssistPopup();
      }
    });

    return () => keyDownDisposable.dispose();
  }, [
    canEdit,
    closeAssistPopup,
    editorRef,
    executeAssistPopupItem,
    monacoRef,
    openAssistPopup,
    setAssistPopupSelectedIndex,
  ]);

  // 팝업 표시 중 방향키/선택/닫기를 Monaco 키바인딩으로 선점한다.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !canEdit) {
      return;
    }

    assistPopupVisibleKeyRef.current = editor.createContextKey('dslAssistPopupVisible', false);
    assistPopupVisibleKeyRef.current.set(Boolean(assistPopupRef.current));

    /**
     * 보조 팝업 선택 인덱스를 delta만큼 순환 이동한다.
     *
     * @param delta 이동량 (양수: 아래, 음수: 위)
     */
    const moveSelection = (delta: number) => {
      const popup = assistPopupRef.current;
      if (!popup || popup.items.length === 0) {
        return;
      }
      const count = Math.max(1, Math.min(popup.visibleCount, popup.items.length));
      const nextIndex =
        delta > 0
          ? (popup.selectedIndex + delta) % count
          : (popup.selectedIndex + delta + count) % count;
      setAssistPopupSelectedIndex(nextIndex);
    };

    /**
     * 현재 선택된 보조 팝업 항목을 실행한다.
     */
    const executeSelected = () => {
      const popup = assistPopupRef.current;
      if (!popup) {
        return;
      }
      const selected = popup.items[popup.selectedIndex] ?? popup.items[0];
      if (selected) {
        executeAssistPopupItem(selected);
      }
    };

    const disposables: Monaco.IDisposable[] = [
      editor.addAction({
        id: 'dsl-assist-popup-up',
        label: 'DSL Assist Popup Up',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.UpArrow],
        run: () => moveSelection(-1),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-down',
        label: 'DSL Assist Popup Down',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.DownArrow],
        run: () => moveSelection(1),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-accept-enter',
        label: 'DSL Assist Popup Accept Enter',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Enter],
        run: () => executeSelected(),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-accept-tab',
        label: 'DSL Assist Popup Accept Tab',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Tab],
        run: () => executeSelected(),
      }),
      editor.addAction({
        id: 'dsl-assist-popup-close',
        label: 'DSL Assist Popup Close',
        precondition: 'dslAssistPopupVisible',
        keybindings: [monaco.KeyCode.Escape],
        run: () => closeAssistPopup(),
      }),
    ];

    return () => {
      disposables.forEach((disposable) => disposable.dispose());
      assistPopupVisibleKeyRef.current = null;
    };
  }, [
    canEdit,
    closeAssistPopup,
    editorRef,
    executeAssistPopupItem,
    monacoRef,
    setAssistPopupSelectedIndex,
  ]);

  return {
    assistPopup,
    assistPopupListRef,
    openAssistPopup,
    closeAssistPopup,
    promoteAssistPopup,
    setAssistPopupSelectedIndex,
    executeAssistPopupItem,
    expandAssistPopupVisibleCount,
  };
}
