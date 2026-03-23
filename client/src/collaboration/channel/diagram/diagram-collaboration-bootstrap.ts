/**
 * 협업 handoff/bootstrap 단계에서 필요한 다이어그램 최소 정보.
 *
 * connection lifecycle은 이 값 집합이 바뀔 때만 다시 구성한다.
 */
export interface DiagramCollaborationBootstrap {
  content: string | null;
  hasYdocSnapshot: boolean;
  contentRevision: string;
}
