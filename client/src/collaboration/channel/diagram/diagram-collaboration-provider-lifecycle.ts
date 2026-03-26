import * as Y from 'yjs';
import type { DocumentSnapshotCodec } from '@/collaboration/core/contracts/document-snapshot-codec';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { DiagramPreviewHydrationController } from './diagram-preview-hydration-controller.js';
import { DiagramContentOnlySnapshotSeeder } from './diagram-content-only-snapshot-seeder.js';
import type { DiagramCollaborationBootstrap } from './diagram-collaboration-bootstrap.js';

interface DiagramCollaborationProviderConnectionLike {
  connect(): void;
  dispose(): void;
}

export class AuthoritativeBootstrapRequiredError extends Error {
  readonly cause: unknown;

  constructor(cause?: unknown) {
    super('Authoritative bootstrap is required before collaboration can connect.');
    this.name = 'AuthoritativeBootstrapRequiredError';
    this.cause = cause;
  }
}

export interface DiagramCollaborationProviderLifecycleOptions {
  ydoc: Y.Doc;
  sharedDocumentEngine: YjsSharedDocumentEngine;
  snapshotCodec: DocumentSnapshotCodec;
  bootstrap: DiagramCollaborationBootstrap;
  diagramId: string;
  teamId: string | undefined;
  projectId: string | undefined;
  handoffStartedAt: number;
  handoffLogPrefix: string;
}

export interface DiagramCollaborationProviderLifecycleDependencies {
  contentOnlySnapshotSeeder: DiagramContentOnlySnapshotSeeder;
  previewHydrationController: DiagramPreviewHydrationController;
  providerConnection: DiagramCollaborationProviderConnectionLike;
}

/**
 * 다이어그램 채널의 YjsProvider 생성/연결/정리 수명주기를 캡슐화한다.
 */
export class DiagramCollaborationProviderLifecycle {
  private isDisposed = false;

  constructor(
    private readonly options: DiagramCollaborationProviderLifecycleOptions,
    private readonly dependencies: DiagramCollaborationProviderLifecycleDependencies,
  ) {}

  /**
   * content-only seed, preview hydration, provider 연결을 순서대로 수행한다.
   */
  async setup(): Promise<void> {
    const { contentOnlySnapshotSeeder, previewHydrationController, providerConnection } =
      this.dependencies;
    const requiresAuthoritativeBootstrap =
      !!this.options.bootstrap.content && !this.options.bootstrap.hasYdocSnapshot;

    let seedResult: Awaited<ReturnType<typeof contentOnlySnapshotSeeder.seed>> = 'skipped';
    try {
      seedResult = await contentOnlySnapshotSeeder.seed({
        bootstrap: this.options.bootstrap,
        sharedDocumentEngine: this.options.sharedDocumentEngine,
        diagramId: this.options.diagramId,
        teamId: this.options.teamId,
        projectId: this.options.projectId,
        doc: this.options.ydoc,
      });
      if (seedResult === 'persisted') {
        console.info(
          '%s content-only snapshot-seeded totalMs=%d',
          this.options.handoffLogPrefix,
          Math.round(performance.now() - this.options.handoffStartedAt),
        );
      } else if (seedResult === 'not-persisted') {
        console.warn(
          '%s content-only snapshot seed returned persisted=false',
          this.options.handoffLogPrefix,
        );
      }
    } catch (error) {
      if (this.options.bootstrap.content && !this.options.bootstrap.hasYdocSnapshot) {
        console.warn('%s content-only snapshot seed failed', this.options.handoffLogPrefix, error);
        previewHydrationController.start();
        throw new AuthoritativeBootstrapRequiredError(error);
      }
    }

    if (this.isDisposed) {
      return;
    }

    previewHydrationController.start();

    if (requiresAuthoritativeBootstrap && seedResult !== 'persisted') {
      throw new AuthoritativeBootstrapRequiredError();
    }

    providerConnection.connect();
  }

  /**
   * preview observer, provider binding, provider를 정리한다.
   */
  dispose(): void {
    this.isDisposed = true;
    this.dependencies.previewHydrationController.dispose();
    this.dependencies.providerConnection.dispose();
  }
}
