import useAuthStore from '@/stores/useAuthStore';
import { duplicateColumnNames } from '@/lib/code-block-names';
import '@/lib/monaco-setup';
import { useId, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import {
  useDiagramCodeProjection,
  type DiagramCodeProjectionRuntime,
} from '@/collaboration/channel/diagram/use-diagram-code-projection';
import { useDiagramCodeBlockEditing } from '@/collaboration/channel/diagram/use-diagram-code-block-editing';
import { useDiagramUnappliedSharedDraft } from '@/collaboration/channel/diagram/use-diagram-unapplied-shared-draft';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';
import Spinner from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { useDarkMode } from '@/hooks/useDarkMode';
import { DSL_LANGUAGE_ID, registerDslLanguage } from '@/lib/monaco-dsl-language';

/** 내부 플래그의 편집 전용 패널 입력. */
interface DslEditableProjectionPanelProps {
  /** 다이어그램 ID. */
  diagramId: string;
  /** authoritative 투영 런타임. */
  runtime: DiagramCodeProjectionRuntime;
  /** 세션과 권한을 합친 편집 가능 여부. */
  ready: boolean;
  /** dispatch 직전에도 검사할 준비 함수. */
  isReady: () => boolean;
}

/**
 * 읽기 모델과 독립된 마운트별 모델에서 기존 필드만 편집한다.
 * @param props 다이어그램·읽기 런타임·쓰기 준비 신호
 * @returns 편집 전용 통합 DSL 패널
 */
export default function DslEditableProjectionPanel({
  diagramId,
  runtime,
  ready: commandReady,
  isReady,
}: DslEditableProjectionPanelProps) {
  const { t } = useTranslation();
  const accountId = useAuthStore((state) => state.loginId);
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
  const ready = commandReady && runtime.ready && projection.status === 'ready';
  const editing = useDiagramCodeBlockEditing({
    accountId,
    diagramId,
    projection,
    dictionary,
    ready,
    isReady: () => ready && isReady() && (runtime.source?.isReady() ?? false),
    t,
  });
  const duplicates = useMemo(
    () =>
      projection.blocks.flatMap((block) =>
        duplicateColumnNames(block.metadata.columns).map((issue) => ({
          ...issue,
          table: block.metadata.tableLogicalName || block.metadata.tablePhysicalName,
        })),
      ),
    [projection.blocks],
  );
  const instanceId = useId();
  const isDark = useDarkMode();
  const uri = `erd-unified-edit://${encodeURIComponent(diagramId)}/${encodeURIComponent(instanceId)}.dsl`;
  const changedBlocks = editing.blocks.filter(
    (block) => block.state.status !== 'CLEAN' || block.remotePending,
  );
  return (
    <section
      aria-label={t('erd.liveProjection.title')}
      data-testid="dsl-live-projection"
      data-editable={ready}
      data-status={projection.status}
      data-revision={projection.revision}
      className="flex h-full min-h-0 min-w-0 flex-col border-l bg-card text-foreground"
    >
      <div className="editor-meta-strip" role="status" aria-live="polite">
        <span>{t('erd.liveProjection.title')}</span>
        <span className="text-muted-foreground">
          {t(ready ? 'erd.unifiedEditing.editable' : 'erd.unifiedEditing.BLOCKED')}
        </span>
        {!changedBlocks.length && <span>{t('erd.unifiedEditing.CLEAN')}</span>}
      </div>
      {editing.recoveredCount > 0 && (
        <div
          role="status"
          data-testid="dsl-recovery-banner"
          className="banner-warm-surface flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-ink-secondary"
        >
          <span>{t('erd.unifiedEditing.recovered', { count: editing.recoveredCount })}</span>
          <Button size="sm" variant="outline" onClick={editing.discardRecovered}>
            {t('erd.unifiedEditing.discardRecovered')}
          </Button>
        </div>
      )}
      {duplicates.length > 0 && (
        <div
          role="note"
          className="banner-warm-surface border-b px-4 py-2 text-xs text-ink-secondary"
        >
          {t('erd.unifiedEditing.duplicateColumnNames', {
            count: duplicates.reduce((count, issue) => count + issue.columnIds.length, 0),
            names: duplicates.map((issue) => `${issue.table}: ${issue.name}`).join(', '),
          })}
        </div>
      )}
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
      <div className="max-h-40 shrink-0 overflow-y-auto" aria-live="polite">
        {changedBlocks.map((block) => (
          <div
            key={block.base.tableId}
            data-testid="dsl-block-status"
            data-table-id={block.base.tableId}
            data-state={block.state.status}
            className="border-b px-4 py-2 text-xs text-muted-foreground"
          >
            <div className="flex flex-wrap items-center gap-2" role="status">
              <span>
                {block.base.metadata.tableLogicalName || block.base.metadata.tablePhysicalName}
              </span>
              <span>{t(`erd.unifiedEditing.${block.state.status}`)}</span>
              {block.remotePending && <span>{t('erd.unifiedEditing.remotePending')}</span>}
            </div>
            {block.state.blockedReason === 'entity-removed' && (
              <p role="note">{t('erd.unifiedEditing.entityRemoved')}</p>
            )}
            {block.failure &&
              block.state.status !== 'CONFLICT' &&
              block.state.blockedReason !== 'entity-removed' && (
                <p role="note">
                  {t(
                    block.failure.reasons.includes('not-ready')
                      ? 'erd.unifiedEditing.notReady'
                      : block.failure.reasons.includes('dictionary-linked')
                        ? 'erd.unifiedEditing.dictionaryLinked'
                        : block.failure.reasons.includes('dictionary-changed')
                          ? 'erd.unifiedEditing.dictionaryChanged'
                          : block.failure.status === 'invalid'
                            ? 'erd.unifiedEditing.invalid'
                            : 'erd.unifiedEditing.unsupported',
                  )}
                </p>
              )}
            {block.state.status === 'CONFLICT' && (
              <div
                role="group"
                aria-label={t('erd.unifiedEditing.conflictTitle')}
                data-testid="dsl-block-conflict"
                className="mt-2 flex flex-col gap-2 text-foreground"
              >
                <span>{t('erd.unifiedEditing.conflictTitle')}</span>
                <ul className="list-inside list-disc">
                  {block.conflicts.map((conflict, index) => (
                    <li key={`${conflict.field}-${index}`}>
                      {t(`erd.unifiedEditing.fields.${conflict.field}`)}:{' '}
                      {String(conflict.localValue ?? '')} / {String(conflict.currentValue ?? '')}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!ready}
                    aria-label={t('erd.unifiedEditing.applyMineFor', {
                      table: block.base.metadata.tablePhysicalName,
                    })}
                    onClick={() => editing.resolve(block.base.tableId, 'mine')}
                  >
                    {t('erd.unifiedEditing.applyMine')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!ready}
                    aria-label={t('erd.unifiedEditing.keepRemoteFor', {
                      table: block.base.metadata.tablePhysicalName,
                    })}
                    onClick={() => editing.resolve(block.base.tableId, 'remote')}
                  >
                    {t('erd.unifiedEditing.keepRemote')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          path={uri}
          defaultLanguage={DSL_LANGUAGE_ID}
          beforeMount={registerDslLanguage}
          onMount={editing.onMount}
          theme={isDark ? 'vs-dark' : 'vs'}
          loading={<Spinner text={t('erd.liveProjection.hydrating')} />}
          options={{
            readOnly: !ready,
            domReadOnly: !ready,
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
