/**
 * markdown 협업 handoff/bootstrap 단계에서 필요한 최소 정보.
 */
export interface MarkdownCollaborationBootstrap {
  /** REST fallback content artifact */
  content: string | null;
  /** persisted Y.Doc snapshot 존재 여부 */
  hasYdocSnapshot: boolean;
  /** 현재 content revision */
  contentRevision: string;
}
