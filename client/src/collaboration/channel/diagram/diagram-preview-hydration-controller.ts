import * as Y from 'yjs';
import { getTablesMap } from '@/collaboration/yjsBridge';
import type { ConnectionStatus } from '@/types/collaboration';
import type { CollaborationRuntimeEvent } from '@/collaboration/core/collaboration-runtime-types';
import type { DiagramYjsDocumentAdapter } from '@/collaboration/yjs/diagram-yjs-document-adapter';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';

interface DiagramPreviewHydrationControllerOptions {
  ydoc: Y.Doc;
  bootstrap: DiagramCollaborationBootstrap;
  previewEnabled: boolean;
  fallbackTimeoutMs: number;
  handoffStartedAt: number;
  handoffLogPrefix: string;
  documentAdapter: DiagramYjsDocumentAdapter;
  dispatchRuntimeEvent: (event: CollaborationRuntimeEvent) => void;
  updatePreviewMode: (next: boolean) => void;
  loadPreview: (content: string) => void;
  getConnectionStatus: () => ConnectionStatus;
}

/**
 * 다이어그램 preview 표시/해제와 fallback hydration 타이밍을 관리한다.
 */
export class DiagramPreviewHydrationController {
  private previewHydrationSource: 'remote' | 'fallback' | null = null;

  private previewRemoteReadyPending = false;

  private previewShownAt: number | null = null;

  private previewUnlockedAt: number | null = null;

  private previewExitObserver: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null = null;

  private snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly options: DiagramPreviewHydrationControllerOptions,
  ) {}

  /**
   * preview가 필요한 다이어그램이면 preview를 표시하고 remote unlock/fallback 감시를 시작한다.
   */
  start(): void {
    const { bootstrap, previewEnabled, dispatchRuntimeEvent, loadPreview, updatePreviewMode } = this.options;
    if (!previewEnabled || !bootstrap.content) {
      return;
    }

    dispatchRuntimeEvent('bootstrap-loaded');
    loadPreview(bootstrap.content);
    this.previewShownAt = performance.now();
    updatePreviewMode(true);
    console.info(
      '%s preview-visible totalMs=%d',
      this.options.handoffLogPrefix,
      Math.round(this.previewShownAt - this.options.handoffStartedAt),
    );

    const tablesMap = getTablesMap(this.options.ydoc);
    this.previewExitObserver = () => {
      if (tablesMap.size === 0) {
        return;
      }

      this.previewHydrationSource ??= 'remote';
      tablesMap.unobserveDeep(this.previewExitObserver!);
      this.previewExitObserver = null;
      updatePreviewMode(false);
      this.previewUnlockedAt = performance.now();
      console.info(
        '%s preview-unlocked source=%s totalMs=%d afterPreviewMs=%d updatesApplied=%d',
        this.options.handoffLogPrefix,
        this.previewHydrationSource,
        Math.round(this.previewUnlockedAt - this.options.handoffStartedAt),
        Math.round(this.previewUnlockedAt - (this.previewShownAt ?? this.options.handoffStartedAt)),
        tablesMap.size,
      );

      if (this.previewHydrationSource === 'fallback') {
        dispatchRuntimeEvent('fallback-timeout');
        return;
      }

      dispatchRuntimeEvent('remote-snapshot-applied');
      if (this.options.getConnectionStatus() !== 'connected') {
        this.previewRemoteReadyPending = true;
      }
    };
    tablesMap.observeDeep(this.previewExitObserver);

    this.snapshotFallbackTimer = setTimeout(() => {
      this.snapshotFallbackTimer = null;
      if (getTablesMap(this.options.ydoc).size > 0) {
        return;
      }

      console.warn(
        '%s snapshot-fallback timeoutMs=%d totalMs=%d',
        this.options.handoffLogPrefix,
        this.options.fallbackTimeoutMs,
        Math.round(performance.now() - this.options.handoffStartedAt),
      );
      this.previewHydrationSource = 'fallback';
      this.options.ydoc.transact(
        () => this.options.documentAdapter.applyBootstrapToDoc(this.options.ydoc, bootstrap),
        'remote',
      );
    }, this.options.fallbackTimeoutMs);
  }

  /**
   * WS 연결 직후, preview가 remote snapshot unlock을 기다리던 상태면 live-ready 로그를 마무리한다.
   */
  onConnected(wsConnectedAt: number): void {
    if (!this.previewRemoteReadyPending) {
      return;
    }

    this.previewRemoteReadyPending = false;
    console.info(
      '%s live-ready totalMs=%d afterWsMs=%d',
      this.options.handoffLogPrefix,
      Math.round(performance.now() - this.options.handoffStartedAt),
      Math.round(performance.now() - wsConnectedAt),
    );
  }

  /**
   * preview observer/timer를 정리한다.
   */
  dispose(): void {
    if (this.previewExitObserver) {
      getTablesMap(this.options.ydoc).unobserveDeep(this.previewExitObserver);
    }
    if (this.snapshotFallbackTimer) {
      clearTimeout(this.snapshotFallbackTimer);
    }
    this.options.updatePreviewMode(false);
  }
}
