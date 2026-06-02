export type AiChatRole = 'user' | 'assistant';

export type AiChatContextKind = 'weak' | 'team' | 'project' | 'multi-project';

export type AiChatResponseStatus = 'ANSWER' | 'NEEDS_CONFIRMATION' | 'ERROR';

export interface AiChatContextSnapshot {
  kind: AiChatContextKind;
  teamId: string | null;
  teamName: string | null;
  projectId: string | null;
  projectName: string | null;
  source: 'route' | 'manual' | 'required';
  capturedAt: string;
}

export interface AiChatSourceChip {
  projectName: string;
  tool: 'overview' | 'WBS' | 'milestones' | 'issues' | 'TODO' | 'history' | 'projects';
  count: number;
}

export interface AiChatResponse {
  status: AiChatResponseStatus;
  conclusion: string;
  interpretation: string;
  confirmedFacts: string[];
  needsConfirmation: string[];
  sourceChips: AiChatSourceChip[];
  error?: string | null;
}

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  context: AiChatContextSnapshot | null;
  response?: AiChatResponse | null;
}

export interface AiChatConversationSnapshot {
  messages: AiChatMessage[];
  savedAt: string;
}
