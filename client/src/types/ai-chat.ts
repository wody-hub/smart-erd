export type AiChatRole = 'user' | 'assistant';

export type AiChatContextKind = 'weak' | 'team' | 'project' | 'multi-project';

export type AiChatContextSource = 'route' | 'manual' | 'required';

export type AiChatContextConfidence = 'strong' | 'team' | 'weak';

export type AiChatResponseStatus = 'ANSWER' | 'NEEDS_CONFIRMATION' | 'ERROR';

export type AiChatToolLabel =
  | 'overview'
  | 'WBS'
  | 'milestones'
  | 'issues'
  | 'TODO'
  | 'history'
  | 'projects';

export interface AiChatContext {
  kind: AiChatContextKind;
  teamId: string | number | null;
  teamName: string | null;
  projectId: string | number | null;
  projectName: string | null;
  source: AiChatContextSource;
  capturedAt: string;
  confidence?: AiChatContextConfidence;
  scopeRequired?: boolean;
}

export type AiChatContextSnapshot = AiChatContext;

export interface AiChatRequest {
  message: string;
  teamId?: string | number | null;
  projectId?: string | number | null;
  projectName?: string | null;
  scopeMode?: string | null;
  locale?: string | null;
  context: AiChatContext | null;
  selectedContext?: AiChatContext | null;
}

export interface AiChatSourceChip {
  projectName: string;
  tool: AiChatToolLabel;
  count: number;
  teamName?: string | null;
  projectId?: string | number | null;
}

export interface AiChatAnswerSections {
  conclusion: string;
  confirmedFacts: string[];
  interpretation: string;
  needsConfirmation: string[];
}

export type AiProposalStatus =
  | 'PENDING'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'FAILED';

export type AiProposalRiskLevel = 'LOW' | 'MEDIUM';

export interface AiProposalTarget {
  type: string | null;
  id: string | null;
  label: string | null;
  teamId: string | number | null;
  projectId: string | number | null;
}

export interface AiProposalPreviewField {
  label: string;
  beforeValue: string | null;
  afterValue: string | null;
  changeType: string | null;
}

export interface AiProposalResult {
  actionType: string | null;
  resourceType: string | null;
  resourceId: string | null;
  targetLabel: string | null;
  status: string | null;
  summary: string | null;
}

export interface AiActionProposalCard {
  proposalId: string;
  status: AiProposalStatus;
  executable: boolean;
  actionType: string;
  riskLevel: AiProposalRiskLevel | null;
  target: AiProposalTarget | null;
  title: string;
  summary: string;
  fields: AiProposalPreviewField[];
  content: string;
  warnings: string[];
  expiresAt: string | null;
  result: AiProposalResult | null;
  redactedErrorTitle: string | null;
  redactedErrorDetail: string | null;
}

export type AiProposalDecision = 'APPROVE' | 'CANCEL' | 'REFRESH' | 'IDEMPOTENT';

export interface AiActionProposalDecisionResponse {
  proposal: AiActionProposalCard;
  decision: AiProposalDecision;
  terminal: boolean;
  message: string;
}

export interface AiChatConfirmationCandidate {
  id: string;
  label: string;
  kind: Extract<AiChatContextKind, 'team' | 'project' | 'multi-project'>;
  teamId: string | number | null;
  teamName?: string | null;
  projectId?: string | number | null;
  projectName?: string | null;
  reason?: string | null;
}

export interface AiChatErrorState {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AiChatResponseContext {
  kind: string;
  teamId: string | number | null;
  projectIds: Array<string | number>;
  label: string;
  toolsUsed: string[];
  caps: Record<string, unknown>;
}

export interface AiChatResponse extends AiChatAnswerSections {
  status: AiChatResponseStatus;
  requiresConfirmation?: boolean;
  confirmationReason?: string | null;
  sourceChips: AiChatSourceChip[];
  confirmationCandidates?: AiChatConfirmationCandidate[];
  context?: AiChatResponseContext | null;
  executionId?: string | null;
  proposals: AiActionProposalCard[];
  error?: string | null;
  errorState?: AiChatErrorState | null;
}

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  context: AiChatContextSnapshot | null;
  pending?: boolean;
  response?: AiChatResponse | null;
  executionId?: string | null;
}

export interface AiChatConversationSnapshot {
  isOpen: boolean;
  messages: AiChatMessage[];
  selectedContext: AiChatContextSnapshot | null;
  confirmationCandidates: AiChatConfirmationCandidate[];
  savedAt: string;
}
