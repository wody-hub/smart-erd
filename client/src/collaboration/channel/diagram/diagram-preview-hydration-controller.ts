import * as Y from 'yjs';
import { getTablesMap } from '@/collaboration/yjsBridge';
import type { ConnectionStatus } from '@/types/collaboration';
import type { CollaborationRuntimeEvent } from '@/collaboration/core/collaboration-runtime-types';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';
import { probeBegin, probeEnd, probeMark, probePreviewReleased } from '@/lib/erd-performance-probe';

const REMOTE_SNAPSHOT_CONNECTED_GRACE_MS = 1_000;

interface DiagramPreviewHydrationControllerOptions {
  ydoc: Y.Doc;
  bootstrap: DiagramCollaborationBootstrap;
  previewEnabled: boolean;
  fallbackTimeoutMs: number;
  handoffStartedAt: number;
  handoffLogPrefix: string;
  dispatchRuntimeEvent: (event: CollaborationRuntimeEvent) => void;
  updatePreviewMode: (next: boolean) => void;
  loadPreview: (content: string) => void;
  refreshPersistedCanvasFromYDoc: () => void;
  getConnectionStatus: () => ConnectionStatus;
}

/**
 * 다이어그램 preview 표시/해제와 원격 snapshot 대기 시간을 관리한다.
 */
export class DiagramPreviewHydrationController {
  private previewTimeoutReported = false;

  private previewRemoteReadyPending = false;

  private previewShownAt: number | null = null;

  private previewUnlockedAt: number | null = null;

  private previewExitObserver: ((events: Y.YEvent<Y.AbstractType<unknown>>[]) => void) | null =
    null;

  private snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  private connectedGraceFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: DiagramPreviewHydrationControllerOptions) {}

  private clearFallbackTimers(): void {
    if (this.snapshotFallbackTimer) {
      clearTimeout(this.snapshotFallbackTimer);
      this.snapshotFallbackTimer = null;
    }
    if (this.connectedGraceFallbackTimer) {
      clearTimeout(this.connectedGraceFallbackTimer);
      this.connectedGraceFallbackTimer = null;
    }
  }

  private finishPreviewUnlock(source: 'remote', updatesApplied: number): void {
    if (this.previewUnlockedAt != null) {
      return;
    }

    if (this.previewExitObserver) {
      getTablesMap(this.options.ydoc).unobserveDeep(this.previewExitObserver);
      this.previewExitObserver = null;
    }
    this.clearFallbackTimers();

    this.options.refreshPersistedCanvasFromYDoc();
    this.options.updatePreviewMode(false);
    this.previewUnlockedAt = performance.now();
    probeMark('preview-unlock', { reason: source, updatesApplied });
    probePreviewReleased(source);
    console.info(
      '%s preview-unlocked source=%s totalMs=%d afterPreviewMs=%d updatesApplied=%d',
      this.options.handoffLogPrefix,
      source,
      Math.round(this.previewUnlockedAt - this.options.handoffStartedAt),
      Math.round(this.previewUnlockedAt - (this.previewShownAt ?? this.options.handoffStartedAt)),
      updatesApplied,
    );

    this.options.dispatchRuntimeEvent('remote-snapshot-applied');
    if (this.options.getConnectionStatus() !== 'connected') {
      this.previewRemoteReadyPending = true;
    }
  }

  private reportSnapshotTimeout(reason: 'timeout' | 'connected-grace', waitMs: number): void {
    if (this.previewUnlockedAt != null || this.previewTimeoutReported) {
      return;
    }

    const tablesMap = getTablesMap(this.options.ydoc);
    if (tablesMap.size > 0) {
      this.finishPreviewUnlock('remote', tablesMap.size);
      return;
    }

    this.previewTimeoutReported = true;
    this.clearFallbackTimers();
    console.warn(
      '%s snapshot-wait-timeout reason=%s waitMs=%d totalMs=%d',
      this.options.handoffLogPrefix,
      reason,
      waitMs,
      Math.round(performance.now() - this.options.handoffStartedAt),
    );
    // bootstrap content로 live Y.Doc을 시딩하지 않고 늦은 원격 snapshot을 계속 기다린다.
    this.options.dispatchRuntimeEvent('fallback-timeout');
  }

  /**
   * preview가 필요한 다이어그램이면 preview를 표시하고 원격 unlock/timeout 감시를 시작한다.
   */
  start(): void {
    const { bootstrap, previewEnabled, dispatchRuntimeEvent, loadPreview, updatePreviewMode } =
      this.options;
    if (!previewEnabled || !bootstrap.content) {
      probePreviewReleased('not-needed');
      return;
    }

    dispatchRuntimeEvent('bootstrap-loaded');
    const previewLoadStartedAt = probeBegin('preview-load');
    loadPreview(bootstrap.content);
    probeEnd('preview-load', previewLoadStartedAt);
    probeMark('preview-store-ready');
    this.previewShownAt = performance.now();
    updatePreviewMode(true);
    probeMark('preview-visible');
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
      this.finishPreviewUnlock('remote', tablesMap.size);
    };
    tablesMap.observeDeep(this.previewExitObserver);

    if (tablesMap.size > 0) {
      this.finishPreviewUnlock('remote', tablesMap.size);
      return;
    }

    this.snapshotFallbackTimer = setTimeout(() => {
      this.snapshotFallbackTimer = null;
      this.reportSnapshotTimeout('timeout', this.options.fallbackTimeoutMs);
    }, this.options.fallbackTimeoutMs);
  }

  /**
   * 원격 sync 완료 시 빈 문서도 확정된 snapshot으로 보고 preview를 해제한다.
   * @param synced 원격 snapshot 적용 완료 여부
   */
  onSyncStateChange(synced: boolean): void {
    if (synced && this.previewShownAt !== null) {
      this.finishPreviewUnlock('remote', getTablesMap(this.options.ydoc).size);
    }
  }

  /**
   * WS 연결 직후, preview가 remote snapshot unlock을 기다리던 상태면 live-ready 로그를 마무리한다.
   */
  onConnected(wsConnectedAt: number): void {
    const tablesMap = getTablesMap(this.options.ydoc);
    if (tablesMap.size > 0) {
      this.finishPreviewUnlock('remote', tablesMap.size);
    }

    if (!this.previewRemoteReadyPending) {
      if (
        this.previewUnlockedAt != null ||
        this.previewTimeoutReported ||
        this.connectedGraceFallbackTimer
      ) {
        return;
      }

      const elapsedMs = performance.now() - this.options.handoffStartedAt;
      const remainingMs = Math.max(0, this.options.fallbackTimeoutMs - elapsedMs);
      const graceMs = Math.min(REMOTE_SNAPSHOT_CONNECTED_GRACE_MS, remainingMs);
      if (graceMs === 0) {
        return;
      }

      this.connectedGraceFallbackTimer = setTimeout(() => {
        this.connectedGraceFallbackTimer = null;
        this.reportSnapshotTimeout('connected-grace', graceMs);
      }, graceMs);
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
      this.previewExitObserver = null;
    }
    this.clearFallbackTimers();
    this.options.updatePreviewMode(false);
  }
}
