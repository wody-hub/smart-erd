import {
  CodeBlockRecoverySession,
  browserRecoveryJournal,
  recoveryAccountActive,
} from '@/lib/code-block-recovery-session';
import { RECOVERY_LIMITS } from '@/lib/code-block-recovery-journal';
import { duplicateColumnNames } from '@/lib/code-block-names';
import { useEffect, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type { editor, IDisposable, IRange } from 'monaco-editor';
import type { TFunction } from 'i18next';
import { useDiagramRejectedCommandToast } from './use-diagram-command-feedback';
import { useDiagramErdCodeBlockActions } from './use-diagram-erd-code-block-actions';
import type { useDiagramCodeProjection } from './use-diagram-code-projection';
import type { ProjectionDictionaryVersion } from '@/collaboration/plugins/erd/erd-code-projection-port';
import { bindBlockIds } from '@/lib/code-block-commit';
import { CodeBlockEditingController, type EditingBlock } from '@/lib/diagram-code-block-editing';
import { diffProjection, type DslProjection, type TableBlock } from '@/lib/dsl-block-projection';
import {
  applyLiveProjectionBatch,
  buildLiveProjectionDecorations,
  initializeLiveProjectionModel,
} from '@/lib/dsl-live-projection-model';
import {
  CODE_BLOCK_MARKER_OWNER,
  layoutEditableProjection,
  replaceEditableBlock,
  readEditableBlockChange,
} from '@/lib/dsl-editable-projection-model';
import {
  probeExposeProjectionEditor,
  probeProjectionPatchApplied,
  probeCodeBlockCommitPhase,
  probeCounter,
} from '@/lib/erd-performance-probe';
import useCanvasStore from '@/stores/erd/useCanvasStore';

/** 편집 전용 패널의 Monaco·문서 연결 입력. */
interface CodeBlockEditingInput {
  /** 인증된 계정의 안정 로그인 ID. 익명은 복구하지 않는다. */
  accountId?: string | null;
  /** 저널을 분리할 다이어그램 ID. */
  diagramId?: string;
  /** 누락 없는 S3 투영 스트림. */
  projection: ReturnType<typeof useDiagramCodeProjection>;
  /** 공유 사전. */
  dictionary: ProjectionDictionaryVersion;
  /** 현재 권한·세션 준비 검사. */
  ready: boolean;
  /** dispatch·undo 직전에 다시 검사하는 함수. */
  isReady: () => boolean;
  /** 진단·상태 번역기. */
  t: TFunction;
}
/**
 * 최신 상태를 유지하는 편집 모델·컨트롤러 연결.
 * @param input 투영·사전·쓰기 권한·번역기
 * @returns Monaco 마운트 함수와 상태·충돌 선택 액션
 */
export function useDiagramCodeBlockEditing(input: CodeBlockEditingInput) {
  const actions = useDiagramErdCodeBlockActions();
  const notifyRejected = useDiagramRejectedCommandToast();
  const latest = useRef({ ...input, actions, notifyRejected });
  latest.current = { ...input, actions, notifyRejected };
  const pageActive = useRef(true);
  const recoveryRef = useRef<CodeBlockRecoverySession | null>(null);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const controllerRef = useRef<CodeBlockEditingController | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  /** 헤더·충돌 안내에 필요한 블록 상태 사본. */
  const blocks = useRef<EditingBlock[]>([]);
  const [, refreshBlocks] = useState(0);
  const refreshRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    controllerRef.current?.setReady(input.ready && pageActive.current);
    recoveryRef.current?.restore();
  }, [input.ready]);
  useEffect(() => {
    refreshRef.current?.();
  }, [input.t]);
  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    /**
     * pagehide에서는 공유 문서에 쓰지 않고 예약된 자동 커밋만 취소한다.
     * @returns 없음
     */
    const hide = () => {
      pageActive.current = false;
      controllerRef.current?.setReady(false);
      recoveryRef.current?.release();
    };
    /**
     * BFCache 복귀 시 현재 세션 권한으로 로컬 텍스트를 재검증한다.
     * @returns 없음
     */
    const show = () => {
      pageActive.current = true;
      controllerRef.current?.setReady(latest.current.ready && latest.current.isReady());
      recoveryRef.current?.restore();
    };
    /** 숨김 전환에서는 로컬 저널만 동기 저장한다. */
    const visibility = () => {
      if (document.visibilityState === 'hidden') recoveryRef.current?.flush();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, []);

  /**
   * 마운트마다 독립 모델에 decoration·입력·history 라우터를 설치한다.
   * @param codeEditor 전용 편집 에디터
   * @param monaco 설치된 Monaco API
   * @returns 없음
   */
  const onMount: OnMount = (codeEditor, monaco) => {
    cleanupRef.current?.();
    const model = codeEditor.getModel();
    if (!model) return;
    const disposables: IDisposable[] = [];
    let recovery: CodeBlockRecoverySession | undefined;
    const accountId = input.accountId;
    const journal = browserRecoveryJournal(accountId, input.diagramId);
    const collections = new Map<string, editor.IEditorDecorationsCollection>();
    const tableIds = new Map<string, string>();
    let previousFresh = true;
    const localBlocks = new Map<string, TableBlock>();
    let applying = false;
    let activeId: string | undefined;
    let composingId: string | undefined;
    let current = input.projection.getSnapshot();
    let revision = 0;
    /** 중복 검사는 입력이 아니라 authoritative 투영이 바뀔 때만 수행한다. */
    const duplicateIssues = () =>
      current.blocks.flatMap((block) =>
        duplicateColumnNames(block.metadata.columns).map((issue) => ({
          ...issue,
          tableId: block.tableId,
        })),
      );
    let duplicates = duplicateIssues();
    const structuralUndo: {
      projection: DslProjection;
      blocks: EditingBlock[];
      selection: ReturnType<typeof codeEditor.getSelection>;
    }[] = [];
    const structuralRedo: typeof structuralUndo = [];
    let deferred:
      | Parameters<Parameters<typeof input.projection.subscribePatches>[0]>[0]
      | undefined;
    const deferredCommitIds = new Set<string>();
    let previous: DslProjection = { text: '', blocks: [], revision };
    initializeLiveProjectionModel(model, current.text);
    probeExposeProjectionEditor(codeEditor);
    /**
     * 현재 decoration 위치를 모델 오프셋과 함께 읽는다.
     * @param range 현재 Monaco 범위
     * @returns UTF-16 오프셋과 행·열
     */
    const rangeData = (range: IRange) => ({
      start: model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn }),
      end: model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn }),
      startLine: range.startLineNumber,
      startColumn: range.startColumn,
      endLine: range.endLineNumber,
      endColumn: range.endColumn,
    });
    /**
     * dirty decoration은 재생성하지 않는다. CLEAN만 새 authoritative 위치로 갱신한다.
     * @param items 표시 중인 블록
     * @returns 없음
     */
    const decorate = (items: TableBlock[]) => {
      for (const block of items) {
        const existing = collections.get(block.tableId);
        if (existing && controller.get(block.tableId)?.state.dirtySince !== undefined) continue;
        const decorations = buildLiveProjectionDecorations([block]);
        tableIds.set(decorations[0].options.className!, block.tableId);
        decorations[0].options.stickiness =
          monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
        if (existing) existing.set(decorations);
        else collections.set(block.tableId, codeEditor.createDecorationsCollection(decorations));
      }
      for (const [id, collection] of collections)
        if (!items.some((block) => block.tableId === id)) {
          collection.clear();
          collections.delete(id);
        }
    };
    /**
     * 사용자 입력에 따라 이동한 블록·컬럼 범위를 캡처한다.
     * @returns 모델의 실제 텍스트·ID·좌표
     */
    const visible = (): DslProjection => ({
      text: model.getValue(),
      revision,
      blocks: [...collections]
        .flatMap(([id, collection]) => {
          const block = controller.get(id),
            range = collection.getRange(0);
          if (!block || !range) return [];
          return [
            {
              ...block.base,
              text: model.getValueInRange(range),
              tableRange: rangeData(range),
              columnRanges: block.base.columnRanges.map((column, index) => {
                const tracked = collection.getRange(index + 1);
                return tracked ? { ...column, ...rangeData(tracked) } : column;
              }),
            },
          ];
        })
        .sort((a, b) => a.tableRange.start - b.tableRange.start),
    });
    /**
     * 블록 상태와 해당 블록의 진단만 갱신한다.
     * @returns 없음
     */
    const blockIndexes = new Map<string, number>();
    const failedIds = new Set<string>();
    /** 진단이 있는 블록만 현재 decoration으로 마커를 만든다. */
    const blockMarkers = (block: EditingBlock): editor.IMarkerData[] => {
      if (
        !block.failure ||
        block.state.status === 'CONFLICT' ||
        (block.state.status === 'BLOCKED' && block.state.blockedReason !== 'entity-removed')
      )
        return [];
      const range = collections.get(block.base.tableId)?.getRange(0);
      if (!range) return [];
      const reason = block.failure.reasons[0];
      const key =
        reason === 'dictionary-linked'
          ? 'dictionaryLinked'
          : reason === 'dictionary-changed'
            ? 'dictionaryChanged'
            : reason === 'missing-target' || reason === 'entity-removed'
              ? 'entityRemoved'
              : block.failure.status === 'invalid'
                ? 'invalid'
                : 'unsupported';
      const message = latest.current.t(`erd.unifiedEditing.${key}`);
      const diagnostics = block.failure.diagnostics.filter((d) => d.severity === 'error');
      return (diagnostics.length ? diagnostics : [{ line: 1, startColumn: 1, endColumn: 2 }]).map(
        (diagnostic) => {
          const line = Math.min(model.getLineCount(), range.startLineNumber + diagnostic.line - 1);
          return {
            startLineNumber: line,
            endLineNumber: line,
            startColumn: Math.min(diagnostic.startColumn, model.getLineMaxColumn(line)),
            endColumn: Math.min(
              Math.max(diagnostic.endColumn, diagnostic.startColumn + 1),
              model.getLineMaxColumn(line),
            ),
            severity: monaco.MarkerSeverity.Error,
            message,
          };
        },
      );
    };
    /** 로컬 입력에서는 변경 ID의 상태만 교체하고 전체 투영 시에만 목록을 재구성한다. */
    const refresh = (id?: string) => {
      recovery?.changed(id);
      const changed = id && controller.get(id);
      const items = changed ? [changed] : [...controller.blocks.values()];
      if (!changed) {
        blocks.current = [];
        blockIndexes.clear();
        failedIds.clear();
      }
      for (const block of items) {
        const id = block.base.tableId;
        const index = blockIndexes.get(id) ?? blocks.current.length;
        blockIndexes.set(id, index);
        blocks.current[index] = { ...block, state: { ...block.state } };
        if (block.failure) failedIds.add(id);
        else failedIds.delete(id);
      }
      refreshBlocks((version) => version + 1);
      monaco.editor.setModelMarkers(model, CODE_BLOCK_MARKER_OWNER, [
        ...duplicates.flatMap((issue) =>
          issue.columnIds.flatMap((id) => {
            const block = controller.get(issue.tableId);
            const index = block?.base.metadata.columnIds.indexOf(id) ?? -1;
            const range =
              index >= 0 ? collections.get(issue.tableId)?.getRange(index + 1) : undefined;
            if (!range) return [];
            return [
              {
                startLineNumber: range.startLineNumber,
                endLineNumber: range.startLineNumber,
                startColumn: range.startColumn,
                endColumn: Math.max(range.startColumn + 1, range.endColumn),
                severity: monaco.MarkerSeverity.Error,
                message: latest.current.t('erd.unifiedEditing.duplicateColumnNames', {
                  count: issue.columnIds.length,
                  names: issue.name,
                }),
              },
            ];
          }),
        ),
        ...[...failedIds].flatMap((id) => {
          const block = controller.get(id);
          return block ? blockMarkers(block) : [];
        }),
      ]);
    };
    const parseStarts = new Map<string, number>();
    const controller = new CodeBlockEditingController({
      now: () => performance.now(),
      schedule: (run, delay) => {
        const timer = setTimeout(run, delay);
        return () => clearTimeout(timer);
      },
      ready: () => pageActive.current && latest.current.isReady(),
      fingerprint: () => latest.current.dictionary.fingerprint,
      snapshot: () => ({
        revision: current.revision,
        dictionary: latest.current.dictionary.dictionary,
        nodes: current.blocks.map((block) => ({
          id: block.tableId,
          data: {
            label: block.metadata.tablePhysicalName,
            logicalTableName: block.metadata.tableLogicalName,
            tableTermId: block.metadata.tableTermId,
            columns: block.metadata.columns,
          },
        })),
        edges: current.blocks.flatMap((block) => block.metadata.relations.map((item) => item.edge)),
      }),
      uuid: () => crypto.randomUUID(),
      commit: (commit) => {
        // heartbeat 만료 후 다른 탭이 가져간 원문으로 중복 커밋하지 않는다.
        if (
          journal &&
          (!accountId || !recoveryAccountActive(accountId) || !journal.owns(commit.tableId))
        )
          return { status: 'rejected', commitId: commit.commitId, reason: 'not-ready' };
        return latest.current.actions.commitCodeBlock(commit);
      },
      changed: refresh,
      replaceText: (id, text, authoritative) => {
        const range = collections.get(id)?.getRange(0);
        if (!range) return;
        applying = true;
        try {
          if (authoritative) {
            const before = visible();
            const after = layoutEditableProjection(
              before.blocks.map((block) => (block.tableId === id ? authoritative : block)),
              ++revision,
            );
            const selection = codeEditor.getSelection();
            const top = codeEditor.getVisibleRanges()[0]?.startLineNumber ?? 1;
            const scrollLeft = codeEditor.getScrollLeft();
            const restored = applyLiveProjectionBatch(
              model,
              before,
              { ...diffProjection(before, after), blockMetadata: after.blocks },
              {
                anchor: selection
                  ? model.getOffsetAt({
                      lineNumber: selection.selectionStartLineNumber,
                      column: selection.selectionStartColumn,
                    })
                  : 0,
                active: selection ? model.getOffsetAt(selection.getPosition()) : 0,
                top: model.getOffsetAt({ lineNumber: top, column: 1 }),
                pixelOffset: codeEditor.getScrollTop() - codeEditor.getTopForLineNumber(top),
              },
            );
            decorate(after.blocks);
            if (selection) {
              const anchor = model.getPositionAt(restored.anchor),
                active = model.getPositionAt(restored.active);
              codeEditor.setSelection(
                new monaco.Selection(
                  anchor.lineNumber,
                  anchor.column,
                  active.lineNumber,
                  active.column,
                ),
              );
            }
            codeEditor.setScrollPosition(
              {
                scrollTop:
                  codeEditor.getTopForLineNumber(model.getPositionAt(restored.top).lineNumber) +
                  restored.pixelOffset,
                scrollLeft,
              },
              monaco.editor.ScrollType.Immediate,
            );
          } else replaceEditableBlock(model, range, text);
        } finally {
          applying = false;
        }
        previous = visible();
        previousFresh = true;
        localBlocks.clear();
      },
      mark: (phase, tableId) => {
        if (phase === 'parse') parseStarts.set(tableId, performance.now());
        probeCodeBlockCommitPhase(
          phase,
          tableId,
          parseStarts.get(tableId) ?? performance.now(),
          controller.get(tableId)?.state.lastInputAt,
        );
      },
    });
    controllerRef.current = controller;
    refreshRef.current = refresh;
    for (const block of current.blocks) controller.add(block);
    decorate(current.blocks);
    previous = visible();
    previousFresh = true;
    localBlocks.clear();
    refresh();
    /**
     * 커서의 decoration 기준 블록 ID를 찾는다.
     * @returns 커서의 테이블 ID 또는 없음
     */
    const cursorBlock = () => {
      const position = codeEditor.getPosition();
      return position
        ? [...collections].find(([, collection]) =>
            collection.getRange(0)?.containsPosition(position),
          )?.[0]
        : undefined;
    };
    activeId = cursorBlock();
    disposables.push(
      model.onDidChangeContent((event) => {
        if (applying) return;
        const changed = !structuralUndo.length && readEditableBlockChange(model, event, tableIds);
        if (changed) {
          // Monaco가 이동 범위를 추적하므로 다른 블록·컬럼을 읽거나 다시 꾸미지 않는다.
          const block = controller.get(changed.tableId)!;
          const collection = collections.get(changed.tableId)!;
          const range = collection.getRange(0)!;
          const edited = {
            ...block.base,
            text: changed.text,
            tableRange: rangeData(range),
            columnRanges: block.base.columnRanges.map((column, index) => {
              const tracked = collection.getRange(index + 1);
              if (!tracked) return column;
              // 행 내부 치환이 기존 decoration 끝과 겹쳐도 새 토큰 전체를 포함한다.
              const line = tracked.startLineNumber;
              return {
                ...column,
                ...rangeData(
                  !changed.multiline
                    ? {
                        startLineNumber: line,
                        startColumn: 1,
                        endLineNumber: line,
                        endColumn: model.getLineMaxColumn(line),
                      }
                    : tracked,
                ),
              };
            }),
          };
          localBlocks.set(changed.tableId, edited);
          if (!changed.multiline) {
            const items = buildLiveProjectionDecorations([edited]);
            items[0].options.stickiness =
              monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
            collection.set(items);
          }
          previousFresh = false;
          structuralRedo.length = 0;
          controller.edit(
            changed.tableId,
            changed.text,
            changed.multiline ? 'replace-lines' : 'field',
          );
          return;
        }
        if (!previousFresh) {
          // 경계를 넘는 입력에서만 이전 텍스트와 ID 범위를 전체 재구성한다.
          previous = layoutEditableProjection(
            previous.blocks.map((block) => localBlocks.get(block.tableId) ?? block),
            revision,
          );
        }
        const touched = previous.blocks.filter((block) =>
          event.changes.some(
            (change) =>
              change.rangeOffset <= block.tableRange.end &&
              change.rangeOffset + change.rangeLength >= block.tableRange.start,
          ),
        );
        const ambiguous =
          touched.length !== 1 ||
          event.changes.some(
            (change) =>
              change.range.startLineNumber !== change.range.endLineNumber ||
              change.text.includes('\n'),
          );
        const after = visible();
        const structure =
          structuralUndo.length > 0 ||
          touched.length !== 1 ||
          after.blocks.map((block) => block.text).join('\n') !== after.text;
        if (structure) {
          structuralUndo.push({
            projection: previous,
            blocks: controller.checkpoint(),
            selection: codeEditor.getSelection(),
          });
          controller.pause();
        }
        structuralRedo.length = 0;
        const selected = touched.length ? touched : previous.blocks.slice(0, 1);
        for (const block of selected) {
          const edited = after.blocks.find((item) => item.tableId === block.tableId);
          if (edited)
            controller.edit(block.tableId, edited.text, ambiguous ? 'replace-lines' : 'field');
          if (structure) controller.unsupportedStructure(block.tableId);
        }
        previous = after;
        previousFresh = true;
        localBlocks.clear();
      }),
    );
    disposables.push(
      codeEditor.onDidChangeCursorPosition(() => {
        if (applying) return;
        const id = cursorBlock();
        if (activeId && activeId !== id) controller.event(activeId, 'leave');
        activeId = id;
      }),
    );
    disposables.push(
      codeEditor.onDidBlurEditorText(() => {
        for (const id of controller.blocks.keys()) controller.event(id, 'blur');
      }),
    );
    disposables.push(
      codeEditor.onDidCompositionStart(() => {
        composingId = cursorBlock();
        if (composingId) controller.event(composingId, 'composition-start');
      }),
    );
    disposables.push(
      codeEditor.onDidCompositionEnd(() => {
        if (composingId) controller.event(composingId, 'composition-end');
        composingId = undefined;
      }),
    );
    /** 모든 키보드·메뉴·모델 이력 요청을 같은 라우터로 전달한다. */
    const routeHistory = (direction: 'undo' | 'redo') => {
      if (!pageActive.current || !latest.current.isReady() || composingId) return;
      const from = direction === 'undo' ? structuralUndo : structuralRedo;
      const to = direction === 'undo' ? structuralRedo : structuralUndo;
      if (from.length) {
        const target = from.pop()!;
        to.push({
          projection: visible(),
          blocks: controller.checkpoint(),
          selection: codeEditor.getSelection(),
        });
        applying = true;
        try {
          replaceEditableBlock(model, model.getFullModelRange(), target.projection.text);
          collections.forEach((collection) => collection.clear());
          collections.clear();
          controller.restore(target.blocks);
          // 체크포인트는 사용자 ID 매핑을 포함하므로 범위를 추측하지 않고 그대로 복원한다.
          for (const block of target.projection.blocks) {
            const items = buildLiveProjectionDecorations([block]);
            items[0].options.stickiness =
              monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
            collections.set(block.tableId, codeEditor.createDecorationsCollection(items));
          }
          if (target.selection) codeEditor.setSelection(target.selection);
        } finally {
          applying = false;
        }
        if (structuralUndo.length) controller.pause();
        previous = visible();
        previousFresh = true;
        localBlocks.clear();
        activeId = cursorBlock();
        refresh();
        if (!structuralUndo.length && deferred) {
          const event = deferred;
          deferred = undefined;
          // 원격 변경 후 구조 redo로 오래된 CLEAN 텍스트를 되살리지 않는다.
          structuralRedo.length = 0;
          acceptPatch({
            ...event,
            batch: { ...event.batch, commitIds: [...deferredCommitIds] },
          });
          deferredCommitIds.clear();
        }
        return;
      }
      const id = cursorBlock();
      const routed = controller.history(id, direction);
      if (routed === 'text' && id) {
        const block = controller.get(id);
        const bound = block && bindBlockIds(block.base, block.state.text);
        if (block && bound?.status === 'bound') {
          const before = visible();
          const restored = layoutEditableProjection(
            before.blocks.map((item) =>
              item.tableId === id
                ? {
                    ...item,
                    columnRanges: bound.parsed.columnRanges,
                    tableRange: { ...item.tableRange, start: 0, end: item.text.length },
                  }
                : item,
            ),
            revision,
          );
          const template = restored.blocks.find((item) => item.tableId === id)!;
          const items = buildLiveProjectionDecorations([template]);
          items[0].options.stickiness =
            monaco.editor.TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges;
          collections.get(id)?.set(items);
          previous = visible();
          previousFresh = true;
          localBlocks.clear();
        }
      }
      if (routed === 'document')
        useCanvasStore
          .getState()
          [direction](() => latest.current.isReady(), latest.current.notifyRejected);
    };
    // 기본 Monaco 명령도 model.undo/redo를 호출하므로 전용 모델에 한해 우회한다.
    const nativeUndo = model.undo,
      nativeRedo = model.redo;
    model.undo = () => routeHistory('undo');
    model.redo = () => routeHistory('redo');
    disposables.push({
      dispose: () => {
        model.undo = nativeUndo;
        model.redo = nativeRedo;
      },
    });
    const dom = codeEditor.getDomNode();
    /** 검색·치환 등 보조 입력은 제외하고 본문 텍스트 입력만 이력을 라우팅한다. */
    const isEditorTextInput = (event: Event) =>
      codeEditor.hasTextFocus() &&
      (event.target as Element | null)?.matches?.('textarea.inputarea') === true;
    /** 브라우저·execCommand의 네이티브 이력 입력을 편집 이력으로 바꾼다. */
    const beforeInput = (event: Event) => {
      const type = (event as InputEvent).inputType;
      if (!isEditorTextInput(event) || (type !== 'historyUndo' && type !== 'historyRedo')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      routeHistory(type === 'historyUndo' ? 'undo' : 'redo');
    };
    /** 플랫폼별 보조 키 조합도 Monaco 기본 핸들러보다 먼저 소비한다. */
    const keyDown = (event: KeyboardEvent) => {
      if (!isEditorTextInput(event) || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      routeHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
    };
    dom?.addEventListener('beforeinput', beforeInput, true);
    dom?.addEventListener('keydown', keyDown, true);
    disposables.push({
      dispose: () => {
        dom?.removeEventListener('beforeinput', beforeInput, true);
        dom?.removeEventListener('keydown', keyDown, true);
      },
    });
    for (const direction of ['undo', 'redo'] as const)
      disposables.push(
        codeEditor.addAction({
          id: `erd-unified-editing.${direction}`,
          label: latest.current.t(`erd.unifiedEditing.${direction}`),
          keybindings:
            direction === 'undo'
              ? [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ]
              : [
                  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
                ],
          precondition: 'editorTextFocus',
          contextMenuGroupId: '1_modification',
          contextMenuOrder: direction === 'undo' ? 1 : 2,
          run: () => routeHistory(direction),
        }),
      );
    /**
     * dirty 블록을 보존하며 authoritative 배치를 현재 표시 좌표로 재계산한다.
     * @param event S3 투영 배치
     * @returns 없음
     */
    const acceptPatch: Parameters<typeof input.projection.subscribePatches>[0] = ({
      batch,
      snapshot,
      receivedAt,
    }) => {
      if (structuralUndo.length) {
        deferred = { batch, snapshot, receivedAt };
        for (const id of batch.commitIds ?? []) deferredCommitIds.add(id);
        return;
      }
      const before = visible();
      current = snapshot;
      duplicates = duplicateIssues();
      const keep = new Set<string>();
      for (const id of [...controller.blocks.keys()]) {
        if (
          controller.remote(
            snapshot.blocks.find((block) => block.tableId === id),
            batch.commitIds ?? [],
            id,
          )
        )
          keep.add(id);
      }
      for (const block of snapshot.blocks) controller.add(block);
      // separator·다중 블록 구조가 깨졌으면 범위를 추측해 원격 텍스트를 덮어쓰지 않는다.
      if (before.blocks.map((block) => block.text).join('\n') !== before.text) {
        refresh();
        return;
      }
      const mixed = new Map(snapshot.blocks.map((block) => [block.tableId, block]));
      for (const block of before.blocks)
        if (keep.has(block.tableId)) mixed.set(block.tableId, block);
      const after = layoutEditableProjection(
        [...mixed.values()].sort((a, b) =>
          a.tableId < b.tableId ? -1 : a.tableId > b.tableId ? 1 : 0,
        ),
        ++revision,
      );
      const patches = diffProjection(before, after);
      const selection = codeEditor.getSelection();
      const top = codeEditor.getVisibleRanges()[0]?.startLineNumber ?? 1;
      const scrollLeft = codeEditor.getScrollLeft();
      applying = true;
      try {
        const restored = applyLiveProjectionBatch(
          model,
          before,
          { ...patches, blockMetadata: after.blocks },
          {
            anchor: selection
              ? model.getOffsetAt({
                  lineNumber: selection.selectionStartLineNumber,
                  column: selection.selectionStartColumn,
                })
              : 0,
            active: selection ? model.getOffsetAt(selection.getPosition()) : 0,
            top: model.getOffsetAt({ lineNumber: top, column: 1 }),
            pixelOffset: codeEditor.getScrollTop() - codeEditor.getTopForLineNumber(top),
          },
        );
        decorate(after.blocks);
        if (patches.patches.length) {
          const anchor = model.getPositionAt(restored.anchor),
            active = model.getPositionAt(restored.active);
          if (selection)
            codeEditor.setSelection(
              new monaco.Selection(
                anchor.lineNumber,
                anchor.column,
                active.lineNumber,
                active.column,
              ),
            );
          codeEditor.setScrollPosition(
            {
              scrollTop:
                codeEditor.getTopForLineNumber(model.getPositionAt(restored.top).lineNumber) +
                restored.pixelOffset,
              scrollLeft,
            },
            monaco.editor.ScrollType.Immediate,
          );
        }
        probeProjectionPatchApplied(receivedAt, snapshot.revision, restored.relocatedTargets);
        if (batch.commitIds?.length) {
          probeCounter('code-block-echo-patch', 1, Math.max(0, performance.now() - receivedAt));
          probeCodeBlockCommitPhase('echo', '', receivedAt);
        }
      } finally {
        applying = false;
      }
      previous = visible();
      previousFresh = true;
      localBlocks.clear();
      refresh();
    };
    /** 복구·버리기 직후 로컬 블록만 표시하고 삭제된 엔티티 원문도 읽을 수 있게 남긴다. */
    const showRecovered = (count: number, refreshModel = true) => {
      setRecoveredCount(count);
      if (!refreshModel) return;
      applying = true;
      try {
        const items = [...controller.blocks.values()].map((block) => {
          const bound = bindBlockIds(block.base, block.state.text);
          return {
            ...block.base,
            text: block.state.text,
            tableRange: { ...block.base.tableRange, start: 0, end: block.state.text.length },
            columnRanges: bound.status === 'bound' ? bound.parsed.columnRanges : [],
          };
        });
        const layout = layoutEditableProjection(items, ++revision);
        collections.forEach((collection) => collection.clear());
        collections.clear();
        initializeLiveProjectionModel(model, layout.text);
        decorate(layout.blocks);
        previous = visible();
        previousFresh = true;
        localBlocks.clear();
      } finally {
        applying = false;
      }
      refresh();
    };
    if (journal && accountId) {
      recovery = new CodeBlockRecoverySession({
        controller,
        journal,
        ready: () =>
          pageActive.current &&
          latest.current.ready &&
          latest.current.isReady() &&
          current.status === 'ready',
        active: () => latest.current.accountId === accountId && recoveryAccountActive(accountId),
        authoritative: () => current.blocks,
        schedule: (run, delay) => {
          const timer = setTimeout(run, delay);
          return () => clearTimeout(timer);
        },
        restored: showRecovered,
        now: () => Date.now(),
      });
      recoveryRef.current = recovery;
      recovery.restore();
      let cancelHeartbeat: (() => void) | undefined;
      /** crash 이후 만료된 소유권도 다음 heartbeat에서 다시 확인한다. */
      const heartbeat = () => {
        recovery?.heartbeat();
        const timer = setTimeout(heartbeat, RECOVERY_LIMITS.heartbeatMs);
        cancelHeartbeat = () => clearTimeout(timer);
      };
      const timer = setTimeout(heartbeat, RECOVERY_LIMITS.heartbeatMs);
      cancelHeartbeat = () => clearTimeout(timer);
      disposables.push({ dispose: () => cancelHeartbeat?.() });
    }
    const unsubscribe = input.projection.subscribePatches((event) => {
      acceptPatch(event);
      recovery?.restore();
    });
    cleanupRef.current = () => {
      unsubscribe();
      recovery?.dispose();
      recoveryRef.current = null;
      controller.dispose();
      disposables.forEach((item) => item.dispose());
      collections.forEach((collection) => collection.clear());
      monaco.editor.setModelMarkers(model, CODE_BLOCK_MARKER_OWNER, []);
      controllerRef.current = null;
      refreshRef.current = null;
    };
  };
  return {
    onMount,
    recoveredCount,
    discardRecovered: () => recoveryRef.current?.discard(),
    blocks: blocks.current,
    resolve: (id: string, choice: 'mine' | 'remote') => controllerRef.current?.resolve(id, choice),
  };
}
