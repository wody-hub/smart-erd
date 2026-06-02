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
  teamId: string | null;
  teamName: string | null;
  projectId: string | null;
  projectName: string | null;
  source: AiChatContextSource;
  capturedAt: string;
  confidence?: AiChatContextConfidence;
  scopeRequired?: boolean;
}

export type AiChatContextSnapshot = AiChatContext;

export interface AiChatRequest {
  message: string;
  locale?: string | null;
  context: AiChatContext | null;
  selectedContext?: AiChatContext | null;
}

export interface AiChatSourceChip {
  projectName: string;
  tool: AiChatToolLabel;
  count: number;
  teamName?: string | null;
  projectId?: string | null;
}

export interface AiChatAnswerSections {
  conclusion: string;
  confirmedFacts: string[];
  interpretation: string;
  needsConfirmation: string[];
}

export interface AiChatConfirmationCandidate {
  id: string;
  label: string;
  kind: Extract<AiChatContextKind, 'team' | 'project' | 'multi-project'>;
  teamId: string | null;
  teamName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  reason?: string | null;
}

export interface AiChatErrorState {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AiChatResponse extends AiChatAnswerSections {
  status: AiChatResponseStatus;
  sourceChips: AiChatSourceChip[];
  confirmationCandidates?: AiChatConfirmationCandidate[];
  executionId?: string | null;
  error?: string | null;
  errorState?: AiChatErrorState | null;
}

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  context: AiChatContextSnapshot | null;
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
