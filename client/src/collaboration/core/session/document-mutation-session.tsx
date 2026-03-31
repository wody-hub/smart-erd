import { createContext, useContext, type ReactNode } from 'react';
import type {
  DocumentCommand,
  InputAdapters,
} from '@/collaboration/core/contracts/document-plugin';
import type {
  DocumentReadExecutor,
  MutationMeta,
} from '@/collaboration/core/contracts/document-read-executor';

export type DocumentCommandDispatchStatus = 'unavailable' | 'applied' | 'rejected';

export interface DocumentCommandDispatchResult<T = unknown> {
  status: DocumentCommandDispatchStatus;
  value?: T;
}

export interface DocumentMutationSession {
  enabled: boolean;
  inputAdapters: InputAdapters | null;
  read: DocumentReadExecutor;
  emitCommand(command: DocumentCommand, meta?: MutationMeta): DocumentCommandDispatchStatus;
  emitCommandWithResult<T = unknown>(
    command: DocumentCommand,
    meta?: MutationMeta,
  ): DocumentCommandDispatchResult<T>;
}

export const DocumentMutationSessionContext = createContext<DocumentMutationSession | null>(null);

interface DocumentMutationSessionProviderProps {
  value: DocumentMutationSession | null;
  children: ReactNode;
}

export function DocumentMutationSessionProvider({
  value,
  children,
}: DocumentMutationSessionProviderProps) {
  return (
    <DocumentMutationSessionContext.Provider value={value}>
      {children}
    </DocumentMutationSessionContext.Provider>
  );
}

export function useDocumentMutationSession(): DocumentMutationSession | null {
  return useContext(DocumentMutationSessionContext);
}

export function useDocumentReadExecutor(): DocumentReadExecutor | null {
  return useDocumentMutationSession()?.read ?? null;
}
