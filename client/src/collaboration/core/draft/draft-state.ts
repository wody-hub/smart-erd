export type DraftParseStatus = 'idle' | 'parsing' | 'valid' | 'invalid';

export type DraftReconcileState = 'clean' | 'dirty-valid' | 'dirty-invalid' | 'remote-pending';

export interface DraftState {
  draftId: string;
  dirty: boolean;
  parseStatus: DraftParseStatus;
  lastAcceptedRevision?: string;
  pendingRemoteRevision?: string;
  reconcileState: DraftReconcileState;
}

export function isDraftRemotePending(draftState: DraftState): boolean {
  return draftState.reconcileState === 'remote-pending';
}

export function isDraftInvalid(draftState: DraftState): boolean {
  return draftState.reconcileState === 'dirty-invalid';
}
