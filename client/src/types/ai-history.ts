export interface AiProjectHistoryItem {
  kind: string;
  executionId: string | null;
  proposalId: string | null;
  provider: string | null;
  promptVersion: string | null;
  actionType: string | null;
  riskLevel: string | null;
  status: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string | null;
  requestedBy: string | null;
  decisionBy: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  redactedErrorTitle: string | null;
  redactedErrorDetail: string | null;
  activityAt: string | null;
}

export interface AiProjectHistoryResponse {
  items: AiProjectHistoryItem[];
  limit: number;
  hasMore: boolean;
}
