import type { CollaborationPreviewPolicy } from '../collaboration-preview-policy.js';
import type {
  CollaborationRuntimeEvent,
  CollaborationRuntimeState,
} from '../../core/collaboration-runtime-types.js';
import { transitionCollaborationRuntimeState } from '../../core/collaboration-session-machine.js';
import type { DiagramCollaborationBootstrap } from '@/collaboration/channel/diagram/diagram-collaboration-bootstrap';

/**
 * 다이어그램 채널의 preview/runtime 의미를 판정하는 정책.
 */
export class DiagramCollaborationPreviewPolicy implements CollaborationPreviewPolicy<DiagramCollaborationBootstrap> {
  /**
   * {@inheritDoc}
   */
  shouldStartInPreview(bootstrap: DiagramCollaborationBootstrap): boolean {
    return Boolean(bootstrap.hasYdocSnapshot && bootstrap.content);
  }

  /**
   * {@inheritDoc}
   */
  transition(
    currentState: CollaborationRuntimeState,
    event: CollaborationRuntimeEvent,
  ): CollaborationRuntimeState {
    return transitionCollaborationRuntimeState(currentState, event);
  }
}
