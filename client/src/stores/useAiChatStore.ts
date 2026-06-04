import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/storage';
import type {
  AiActionProposalCard,
  AiChatConfirmationCandidate,
  AiChatContextSnapshot,
  AiChatConversationSnapshot,
  AiChatMessage,
  AiChatResponse,
  AiChatResponseStatus,
  AiChatSourceChip,
  AiChatToolLabel,
  AiProposalRiskLevel,
  AiProposalStatus,
} from '@/types/ai-chat';

const MAX_RENDERED_MESSAGES = 50;
const RESPONSE_STATUSES = new Set<AiChatResponseStatus>(['ANSWER', 'NEEDS_CONFIRMATION', 'ERROR']);
const PROPOSAL_STATUSES = new Set<AiProposalStatus>([
  'PENDING',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
  'EXECUTED',
  'FAILED',
]);
const PROPOSAL_RISK_LEVELS = new Set<AiProposalRiskLevel>(['LOW', 'MEDIUM']);
const TOOL_LABELS = new Set<AiChatToolLabel>([
  'overview',
  'WBS',
  'milestones',
  'issues',
  'TODO',
  'history',
  'projects',
]);

export interface LocalStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface AiChatStoreState {
  isOpen: boolean;
  messages: AiChatMessage[];
  selectedContext: AiChatContextSnapshot | null;
  confirmationCandidates: AiChatConfirmationCandidate[];
  runningExecutionId: string | null;
}

export interface AiChatZustandState extends AiChatStoreState {
  openDrawer: () => void;
  closeDrawer: () => void;
  appendMessage: (message: AiChatMessage) => void;
  updateProposalInMessage: (messageId: string, proposal: AiActionProposalCard) => void;
  setSelectedContext: (context: AiChatContextSnapshot | null) => void;
  setConfirmationCandidates: (candidates: AiChatConfirmationCandidate[]) => void;
  setRunningExecutionId: (executionId: string | null) => void;
  newConversation: () => void;
  hydrateForLogin: (loginId: string | null | undefined) => void;
  clearForLogout: (loginId: string | null | undefined) => void;
}

type ConversationInput = AiChatMessage[] | Partial<AiChatStoreState>;

let activeLoginId: string | null = getStoredLoginId();

function getBrowserStorage(): LocalStorageLike | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage;
}

function getStoredLoginId(): string | null {
  return getBrowserStorage()?.getItem(STORAGE_KEYS.LOGIN_ID) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readOptionalId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
}

function readBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function sanitizeProposalTarget(value: unknown): AiActionProposalCard['target'] {
  if (!isRecord(value)) {
    return null;
  }
  return {
    type: readOptionalString(value.type),
    id: readOptionalString(value.id),
    label: readOptionalString(value.label),
    teamId: readOptionalId(value.teamId),
    projectId: readOptionalId(value.projectId),
  };
}

function sanitizeProposalField(value: unknown): AiActionProposalCard['fields'][number] | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    label: readString(value.label),
    beforeValue: readOptionalString(value.beforeValue),
    afterValue: readOptionalString(value.afterValue),
    changeType: readOptionalString(value.changeType),
  };
}

export function sanitizeAiActionProposalCard(value: unknown): AiActionProposalCard | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = readString(value.status);
  if (!PROPOSAL_STATUSES.has(status as AiProposalStatus)) {
    return null;
  }
  const riskLevel = readOptionalString(value.riskLevel);
  return {
    proposalId: readString(value.proposalId),
    status: status as AiProposalStatus,
    executable: readBoolean(value.executable),
    actionType: readString(value.actionType),
    riskLevel: PROPOSAL_RISK_LEVELS.has(riskLevel as AiProposalRiskLevel)
      ? (riskLevel as AiProposalRiskLevel)
      : null,
    target: sanitizeProposalTarget(value.target),
    title: readString(value.title),
    summary: readString(value.summary),
    fields: Array.isArray(value.fields)
      ? value.fields
          .map(sanitizeProposalField)
          .filter((field): field is AiActionProposalCard['fields'][number] => field !== null)
      : [],
    content: readString(value.content),
    warnings: readStringList(value.warnings),
    expiresAt: readOptionalString(value.expiresAt),
    redactedErrorTitle: readOptionalString(value.redactedErrorTitle),
    redactedErrorDetail: readOptionalString(value.redactedErrorDetail),
  };
}

function sanitizeProposalCards(value: unknown): AiActionProposalCard[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(sanitizeAiActionProposalCard)
    .filter((proposal): proposal is AiActionProposalCard => proposal !== null);
}

function capMessages(messages: AiChatMessage[]): AiChatMessage[] {
  return messages.slice(-MAX_RENDERED_MESSAGES);
}

function sanitizeContext(value: unknown): AiChatContextSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = readString(value.kind);
  if (!['weak', 'team', 'project', 'multi-project'].includes(kind)) {
    return null;
  }
  const source = readString(value.source);
  const confidence = readOptionalString(value.confidence);
  return {
    kind: kind as AiChatContextSnapshot['kind'],
    teamId: readOptionalId(value.teamId),
    teamName: readOptionalString(value.teamName),
    projectId: readOptionalId(value.projectId),
    projectName: readOptionalString(value.projectName),
    source: ['route', 'manual', 'required'].includes(source)
      ? (source as AiChatContextSnapshot['source'])
      : 'required',
    capturedAt: readString(value.capturedAt) || new Date().toISOString(),
    confidence: ['strong', 'team', 'weak'].includes(confidence ?? '')
      ? (confidence as AiChatContextSnapshot['confidence'])
      : undefined,
    scopeRequired: typeof value.scopeRequired === 'boolean' ? value.scopeRequired : undefined,
  };
}

function sanitizeSourceChip(value: unknown): AiChatSourceChip | null {
  if (!isRecord(value)) {
    return null;
  }
  const tool = readString(value.tool);
  if (!TOOL_LABELS.has(tool as AiChatToolLabel)) {
    return null;
  }
  const count = typeof value.count === 'number' && Number.isFinite(value.count) ? value.count : 0;
  return {
    projectName: readString(value.projectName),
    tool: tool as AiChatToolLabel,
    count,
    teamName: readOptionalString(value.teamName),
    projectId: readOptionalId(value.projectId),
  };
}

function sanitizeConfirmationCandidate(value: unknown): AiChatConfirmationCandidate | null {
  if (!isRecord(value)) {
    return null;
  }
  const kind = readString(value.kind);
  if (!['team', 'project', 'multi-project'].includes(kind)) {
    return null;
  }
  return {
    id: readString(value.id),
    label: readString(value.label),
    kind: kind as AiChatConfirmationCandidate['kind'],
    teamId: readOptionalId(value.teamId),
    teamName: readOptionalString(value.teamName),
    projectId: readOptionalId(value.projectId),
    projectName: readOptionalString(value.projectName),
    reason: readOptionalString(value.reason),
  };
}

function sanitizeResponse(value: unknown): AiChatResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = readString(value.status);
  const safeStatus = RESPONSE_STATUSES.has(status as AiChatResponseStatus)
    ? (status as AiChatResponseStatus)
    : 'ANSWER';
  const sourceChips = Array.isArray(value.sourceChips)
    ? value.sourceChips
        .map(sanitizeSourceChip)
        .filter((chip): chip is AiChatSourceChip => chip !== null)
    : [];
  const confirmationCandidates = Array.isArray(value.confirmationCandidates)
    ? value.confirmationCandidates
        .map(sanitizeConfirmationCandidate)
        .filter((candidate): candidate is AiChatConfirmationCandidate => candidate !== null)
    : [];
  const safeError = typeof value.error === 'string' ? value.error : null;
  const errorState = (() => {
    const candidate = isRecord(value.errorState) ? value.errorState : value.error;
    if (!isRecord(candidate)) {
      return null;
    }
    return {
      code: readString(candidate.code),
      message: readString(candidate.message),
      retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : false,
    };
  })();
  return {
    status: safeStatus,
    conclusion: readString(value.conclusion),
    interpretation: readString(value.interpretation),
    confirmedFacts: readStringList(value.confirmedFacts),
    needsConfirmation: readStringList(value.needsConfirmation),
    sourceChips,
    proposals: sanitizeProposalCards(value.proposals),
    confirmationCandidates,
    executionId: readOptionalString(value.executionId),
    error: safeError,
    errorState,
  };
}

function sanitizeMessage(value: unknown): AiChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  const role = readString(value.role);
  if (!['user', 'assistant'].includes(role)) {
    return null;
  }
  const message: AiChatMessage = {
    id: readString(value.id),
    role: role as AiChatMessage['role'],
    content: readString(value.content),
    createdAt: readString(value.createdAt) || new Date().toISOString(),
    context: sanitizeContext(value.context),
  };
  const response = sanitizeResponse(value.response);
  const executionId = readOptionalString(value.executionId);
  if (response) {
    message.response = response;
  }
  if (executionId) {
    message.executionId = executionId;
  }
  return message;
}

function sanitizeCandidates(values: unknown): AiChatConfirmationCandidate[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map(sanitizeConfirmationCandidate)
    .filter((candidate): candidate is AiChatConfirmationCandidate => candidate !== null);
}

function sanitizeMessages(values: unknown): AiChatMessage[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return capMessages(
    values.map(sanitizeMessage).filter((message): message is AiChatMessage => message !== null),
  );
}

function toConversationState(input: ConversationInput): AiChatStoreState {
  if (Array.isArray(input)) {
    return {
      ...createInitialAiChatState(),
      messages: sanitizeMessages(input),
    };
  }
  return {
    isOpen: typeof input.isOpen === 'boolean' ? input.isOpen : false,
    messages: sanitizeMessages(input.messages),
    selectedContext: sanitizeContext(input.selectedContext),
    confirmationCandidates: sanitizeCandidates(input.confirmationCandidates),
    runningExecutionId: null,
  };
}

function persistActiveConversation(state: AiChatStoreState): void {
  if (!activeLoginId) {
    return;
  }
  saveAiChatConversation(activeLoginId, state);
}

export function createAiChatStorageKey(loginId?: string | null): string | null {
  if (!loginId) {
    return null;
  }
  return `${STORAGE_KEYS.AI_CHAT_CONVERSATION_PREFIX}:${loginId}`;
}

export const buildAiChatConversationStorageKey = createAiChatStorageKey;

export function createInitialAiChatState(): AiChatStoreState {
  return {
    isOpen: false,
    messages: [],
    selectedContext: null,
    confirmationCandidates: [],
    runningExecutionId: null,
  };
}

export function openAiChatDrawer(state: AiChatStoreState): AiChatStoreState {
  return {
    ...state,
    isOpen: true,
  };
}

export function closeAiChatDrawer(state: AiChatStoreState): AiChatStoreState {
  return {
    ...state,
    isOpen: false,
  };
}

export function appendAiChatMessage(
  state: AiChatStoreState,
  message: AiChatMessage,
): AiChatStoreState {
  return {
    ...state,
    messages: capMessages(
      [...state.messages, sanitizeMessage(message)].filter(
        (item): item is AiChatMessage => item !== null,
      ),
    ),
  };
}

export function updateProposalInAiChatMessage(
  state: AiChatStoreState,
  messageId: string,
  proposal: AiActionProposalCard,
): AiChatStoreState {
  const safeProposal = sanitizeAiActionProposalCard(proposal);
  if (!safeProposal) {
    return state;
  }
  return {
    ...state,
    messages: state.messages.map((message) => {
      if (message.id !== messageId || !message.response) {
        return message;
      }
      const proposals = message.response.proposals.map((item) =>
        item.proposalId === safeProposal.proposalId ? safeProposal : item,
      );
      return {
        ...message,
        response: {
          ...message.response,
          proposals,
        },
      };
    }),
  };
}

export function startNewAiChatConversation(state: AiChatStoreState): AiChatStoreState {
  return {
    ...state,
    messages: [],
    confirmationCandidates: [],
    runningExecutionId: null,
  };
}

export function serializeAiChatConversation(input: ConversationInput): string {
  const state = toConversationState(input);
  const snapshot: AiChatConversationSnapshot = {
    isOpen: state.isOpen,
    messages: state.messages,
    selectedContext: state.selectedContext,
    confirmationCandidates: state.confirmationCandidates,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(snapshot);
}

export function deserializeAiChatConversation(raw: string | null | undefined): AiChatStoreState {
  if (!raw) {
    return createInitialAiChatState();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return createInitialAiChatState();
    }
    return toConversationState(parsed);
  } catch {
    return createInitialAiChatState();
  }
}

export function saveAiChatConversation(
  loginId: string | null | undefined,
  input: ConversationInput,
  storage: LocalStorageLike | null = getBrowserStorage(),
): void {
  const key = createAiChatStorageKey(loginId);
  if (!key || !storage) {
    return;
  }
  storage.setItem(key, serializeAiChatConversation(input));
}

export function loadAiChatConversation(
  loginId: string | null | undefined,
  storage: LocalStorageLike | null = getBrowserStorage(),
): AiChatMessage[] {
  const key = createAiChatStorageKey(loginId);
  if (!key || !storage) {
    return [];
  }
  return deserializeAiChatConversation(storage.getItem(key)).messages;
}

export function clearAiChatConversation(
  loginId: string | null | undefined,
  storage: LocalStorageLike | null = getBrowserStorage(),
): void {
  const key = createAiChatStorageKey(loginId);
  if (key && storage) {
    storage.removeItem(key);
  }
}

export function hydrateAiChatConversationForLogin(
  _currentState: AiChatStoreState,
  loginId: string | null | undefined,
  storage: LocalStorageLike | null = getBrowserStorage(),
): AiChatStoreState {
  const key = createAiChatStorageKey(loginId);
  if (!key || !storage) {
    return createInitialAiChatState();
  }
  return deserializeAiChatConversation(storage.getItem(key));
}

export function hydrateActiveAiChatConversation(loginId: string | null | undefined): void {
  activeLoginId = loginId ?? null;
  useAiChatStore.setState((state) => hydrateAiChatConversationForLogin(state, activeLoginId));
}

export function clearActiveAiChatConversation(loginId: string | null | undefined): void {
  clearAiChatConversation(loginId);
  if (activeLoginId === loginId || !loginId) {
    activeLoginId = null;
    useAiChatStore.setState(createInitialAiChatState());
  }
}

function createBrowserInitialState(): AiChatStoreState {
  const initialLoginId = activeLoginId;
  if (!initialLoginId) {
    return createInitialAiChatState();
  }
  return hydrateAiChatConversationForLogin(createInitialAiChatState(), initialLoginId);
}

const useAiChatStore = create<AiChatZustandState>((set) => ({
  ...createBrowserInitialState(),
  openDrawer: () =>
    set((state) => {
      const next = openAiChatDrawer(state);
      persistActiveConversation(next);
      return next;
    }),
  closeDrawer: () =>
    set((state) => {
      const next = closeAiChatDrawer(state);
      persistActiveConversation(next);
      return next;
    }),
  appendMessage: (message) =>
    set((state) => {
      const next = appendAiChatMessage(state, message);
      persistActiveConversation(next);
      return next;
    }),
  updateProposalInMessage: (messageId, proposal) =>
    set((state) => {
      const next = updateProposalInAiChatMessage(state, messageId, proposal);
      persistActiveConversation(next);
      return next;
    }),
  setSelectedContext: (context) =>
    set((state) => {
      const next = {
        ...state,
        selectedContext: sanitizeContext(context),
      };
      persistActiveConversation(next);
      return next;
    }),
  setConfirmationCandidates: (candidates) =>
    set((state) => {
      const next = {
        ...state,
        confirmationCandidates: sanitizeCandidates(candidates),
      };
      persistActiveConversation(next);
      return next;
    }),
  setRunningExecutionId: (executionId) =>
    set((state) => ({
      ...state,
      runningExecutionId: executionId,
    })),
  newConversation: () =>
    set((state) => {
      const next = startNewAiChatConversation(state);
      persistActiveConversation(next);
      return next;
    }),
  hydrateForLogin: (loginId) =>
    set((state) => {
      activeLoginId = loginId ?? null;
      return hydrateAiChatConversationForLogin(state, activeLoginId);
    }),
  clearForLogout: (loginId) =>
    set(() => {
      clearAiChatConversation(loginId);
      if (activeLoginId === loginId || !loginId) {
        activeLoginId = null;
      }
      return createInitialAiChatState();
    }),
}));

export default useAiChatStore;
