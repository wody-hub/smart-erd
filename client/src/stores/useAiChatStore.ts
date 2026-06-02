import type { AiChatConversationSnapshot, AiChatMessage } from '@/types/ai-chat';

const AI_CHAT_CONVERSATION_PREFIX = 'smart-erd-ai-chat-conversation';

export interface LocalStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface AiChatStoreState {
  isOpen: boolean;
  messages: AiChatMessage[];
}

export function buildAiChatConversationStorageKey(loginId?: string | null): string | null {
  if (!loginId) {
    return null;
  }
  return `${AI_CHAT_CONVERSATION_PREFIX}:${loginId}`;
}

export function createInitialAiChatState(): AiChatStoreState {
  return {
    isOpen: false,
    messages: [],
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

export function appendAiChatMessage(state: AiChatStoreState, message: AiChatMessage): AiChatStoreState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

export function startNewAiChatConversation(state: AiChatStoreState): AiChatStoreState {
  return {
    ...state,
    messages: [],
  };
}

export function serializeAiChatConversation(messages: AiChatMessage[]): string {
  const snapshot: AiChatConversationSnapshot = {
    messages,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(snapshot);
}

export function saveAiChatConversation(
  loginId: string | null | undefined,
  messages: AiChatMessage[],
  storage: LocalStorageLike,
): void {
  const key = buildAiChatConversationStorageKey(loginId);
  if (!key) {
    return;
  }
  storage.setItem(key, serializeAiChatConversation(messages));
}

export function loadAiChatConversation(
  loginId: string | null | undefined,
  storage: LocalStorageLike,
): AiChatMessage[] {
  const key = buildAiChatConversationStorageKey(loginId);
  if (!key) {
    return [];
  }
  const raw = storage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AiChatConversationSnapshot>;
    return Array.isArray(parsed.messages) ? (parsed.messages as AiChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function clearAiChatConversation(loginId: string | null | undefined, storage: LocalStorageLike): void {
  const key = buildAiChatConversationStorageKey(loginId);
  if (key) {
    storage.removeItem(key);
  }
}
