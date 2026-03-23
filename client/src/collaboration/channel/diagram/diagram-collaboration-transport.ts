import { requestWsTicket } from '@/api/diagramApi';
import type { WsTicketIssueResponse } from '@/types/collaboration';

/**
 * 다이어그램 채널의 transport 규칙을 제공한다.
 */
export class DiagramCollaborationTransport {
  /**
   * 다이어그램 채널의 WebSocket 경로를 생성한다.
   */
  websocketPath(diagramId: string): string {
    return `/ws/diagram/${diagramId}`;
  }

  /**
   * 다이어그램 채널 ticket을 발급받는다.
   */
  issueTicket(diagramId: string): Promise<WsTicketIssueResponse> {
    return requestWsTicket(diagramId);
  }
}
