import type { DiagramCollaborationProviderBindingCallbacks } from './diagram-collaboration-provider-callbacks.js';
import { YjsProvider } from '@/collaboration/YjsProvider';

/**
 * 다이어그램 채널의 provider -> store 이벤트 배선을 캡슐화한다.
 */
export class DiagramCollaborationProviderBinding {
  constructor(private readonly callbacks: DiagramCollaborationProviderBindingCallbacks) {}

  /**
   * provider 이벤트를 store 콜백에 연결한다.
   */
  bind(provider: YjsProvider): void {
    provider.onConnectionStatusChange = this.callbacks.onConnectionStatusChange;
    provider.onConnectionIssueDetected = this.callbacks.onConnectionIssueDetected;
    provider.onIdentityResolved = this.callbacks.onIdentityResolved;
    provider.onPresenceModeChange = this.callbacks.onPresenceModeChange;
    provider.onPresenceSnapshot = this.callbacks.onPresenceSnapshot;
    provider.onPresencePeerJoined = this.callbacks.onPresencePeerJoined;
    provider.onPresencePeerLeft = this.callbacks.onPresencePeerLeft;
    provider.onAwarenessReceived = this.callbacks.onAwarenessReceived;
    provider.onPeerLeft = this.callbacks.onPeerLeft;
  }

  /**
   * provider 이벤트 배선을 해제한다.
   */
  dispose(provider: YjsProvider | null): void {
    if (!provider) {
      return;
    }
    provider.onConnectionStatusChange = null;
    provider.onConnectionIssueDetected = null;
    provider.onIdentityResolved = null;
    provider.onPresenceModeChange = null;
    provider.onPresenceSnapshot = null;
    provider.onPresencePeerJoined = null;
    provider.onPresencePeerLeft = null;
    provider.onAwarenessReceived = null;
    provider.onPeerLeft = null;
  }
}
