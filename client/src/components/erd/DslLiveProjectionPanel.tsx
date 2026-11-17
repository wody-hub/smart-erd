import { useDiagramUnappliedSharedDraft } from '@/collaboration/channel/diagram/use-diagram-unapplied-shared-draft';
import '@/lib/monaco-setup';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import {
  useDiagramCodeProjection,
  type DiagramCodeProjectionRuntime,
} from '@/collaboration/channel/diagram/use-diagram-code-projection';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';
import Spinner from '@/components/ui/spinner';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  applyLiveProjectionBatch,
  createLiveProjectionDecorationUpdater,
  liveProjectionRangesChanged,
  initializeLiveProjectionModel,
} from '@/lib/dsl-live-projection-model';
import { DSL_LANGUAGE_ID, registerDslLanguage } from '@/lib/monaco-dsl-language';
import {
  probeExposeProjectionEditor,
  probeProjectionPatchApplied,
} from '@/lib/erd-performance-probe';

/** 읽기 전용 라이브 DSL 패널 입력. */
interface DslLiveProjectionPanelProps {
  /** persisted 문서를 구분하는 ID. */
  diagramId: string;
  /** 편집 권한과 독립적인 authoritative 읽기 런타임. */
  runtime: DiagramCodeProjectionRuntime;
}

/**
 * persisted 문서만 투영하는 전용 Monaco 패널. draft·잠금·사용자 변경 핸들러가 없다.
 * @param props 다이어그램 ID와 읽기 런타임
 * @returns 읽기 전용 라이브 투영 패널
 */
export default function DslLiveProjectionPanel({
  diagramId,
  runtime,
}: DslLiveProjectionPanelProps) {
  const { t } = useTranslation();
  const { terms, domains, dictionaryRevision } = useErdDictionary();
  const dictionary = useMemo(
    () => ({
      version: dictionaryRevision,
      fingerprint: JSON.stringify({ terms, domains }),
      dictionary: { terms, domains },
    }),
    [dictionaryRevision, terms, domains],
  );
  const projection = useDiagramCodeProjection(true, runtime, dictionary);
  const hasUnappliedSharedDraft = useDiagramUnappliedSharedDraft(runtime);
  const isDark = useDarkMode();
  const instanceId = useId();
  const uri = `erd-live-projection://${encodeURIComponent(diagramId)}/${encodeURIComponent(instanceId)}.dsl`;
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const decorationsRef = useRef<ReturnType<typeof createLiveProjectionDecorationUpdater> | null>(
    null,
  );
  /** 삭제된 대상의 커서·선택·viewport 이동 누계. */
  const [relocatedTargets, setRelocatedTargets] = useState(0);

  useEffect(
    () => () => {
      unsubscribeRef.current?.();
      decorationsRef.current?.clear();
    },
    [],
  );

  /**
   * 새 전용 모델을 한 번 초기화하고 이후 배치를 직접 적용한다.
   * @param codeEditor 읽기 전용 Monaco 인스턴스
   * @param monaco Monaco API
   * @returns 없음
   */
  const handleMount: OnMount = (codeEditor, monaco) => {
    const model = codeEditor.getModel();
    if (!model) return;
    let current = projection.getSnapshot();
    initializeLiveProjectionModel(model, current.text);
    probeExposeProjectionEditor(codeEditor);
    decorationsRef.current?.clear();
    decorationsRef.current = createLiveProjectionDecorationUpdater((items) =>
      codeEditor.createDecorationsCollection(items),
    );
    decorationsRef.current.update(current.blocks);
    unsubscribeRef.current?.();
    unsubscribeRef.current = projection.subscribePatches(({ batch, snapshot, receivedAt }) => {
      if (!batch.patches.length && !liveProjectionRangesChanged(current.blocks, snapshot.blocks)) {
        current = snapshot;
        probeProjectionPatchApplied(receivedAt, batch.nextRevision, 0);
        return;
      }
      const selection = codeEditor.getSelection();
      const topLine = codeEditor.getVisibleRanges()[0]?.startLineNumber ?? 1;
      const scrollLeft = codeEditor.getScrollLeft();
      const restored = applyLiveProjectionBatch(model, current, batch, {
        anchor: selection
          ? model.getOffsetAt({
              lineNumber: selection.selectionStartLineNumber,
              column: selection.selectionStartColumn,
            })
          : 0,
        active: selection
          ? model.getOffsetAt({
              lineNumber: selection.positionLineNumber,
              column: selection.positionColumn,
            })
          : 0,
        top: model.getOffsetAt({ lineNumber: topLine, column: 1 }),
        pixelOffset: codeEditor.getScrollTop() - codeEditor.getTopForLineNumber(topLine),
      });
      current = snapshot;
      decorationsRef.current?.update(snapshot.blocks);
      if (selection) {
        const anchor = model.getPositionAt(restored.anchor);
        const active = model.getPositionAt(restored.active);
        codeEditor.setSelection(
          new monaco.Selection(anchor.lineNumber, anchor.column, active.lineNumber, active.column),
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
      if (restored.relocatedTargets)
        setRelocatedTargets((count) => count + restored.relocatedTargets);
      probeProjectionPatchApplied(receivedAt, batch.nextRevision, restored.relocatedTargets);
    });
  };

  return (
    <section
      aria-label={t('erd.liveProjection.title')}
      data-testid="dsl-live-projection"
      data-status={projection.status}
      data-revision={projection.revision}
      data-relocated-targets={relocatedTargets}
      className="flex h-full min-h-0 min-w-0 flex-col border-l bg-card text-foreground"
    >
      <div className="editor-meta-strip" role="status" aria-live="polite">
        <span>{t('erd.liveProjection.title')}</span>
        {projection.status === 'ready' ? (
          <span className="text-muted-foreground">{t('erd.liveProjection.readOnly')}</span>
        ) : (
          <Spinner
            text={t(
              projection.status === 'resync'
                ? 'erd.liveProjection.resync'
                : 'erd.liveProjection.hydrating',
            )}
          />
        )}
      </div>
      {hasUnappliedSharedDraft && (
        <div
          role="note"
          className="banner-warm-surface border-b px-4 py-2 text-xs text-ink-secondary"
        >
          {t('erd.liveProjection.unappliedDraft')}
        </div>
      )}
      {projection.unsupportedNotices > 0 && (
        <div
          role="note"
          className="banner-warm-surface border-b px-4 py-2 text-xs text-ink-secondary"
        >
          {t('erd.liveProjection.unsupportedRelations', { count: projection.unsupportedNotices })}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Editor
          path={uri}
          defaultLanguage={DSL_LANGUAGE_ID}
          beforeMount={registerDslLanguage}
          onMount={handleMount}
          theme={isDark ? 'vs-dark' : 'vs'}
          loading={<Spinner text={t('erd.liveProjection.hydrating')} />}
          options={{
            readOnly: true,
            domReadOnly: true,
            ariaLabel: t('erd.liveProjection.title'),
            fontFamily: 'IBM Plex Mono, monospace',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            contextmenu: false,
          }}
        />
      </div>
    </section>
  );
}
