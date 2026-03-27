import type { DraftState } from '@/collaboration/core/draft/draft-state';
import { isDraftInvalid, isDraftRemotePending } from '@/collaboration/core/draft/draft-state';

export function isCodeEditorApplyBlocked(draftState: DraftState): boolean {
  return isDraftRemotePending(draftState);
}

export function isCodeEditorFinalizeBlocked(draftState: DraftState): boolean {
  return isDraftRemotePending(draftState) || isDraftInvalid(draftState);
}

interface CodeEditorUnsavedChangesOptions {
  draftState: DraftState;
  hasPendingFinalizeChanges?: boolean;
  isPersistedDraftStale?: boolean;
}

export type CodeEditorRefreshConfirmReason =
  | 'local-dirty'
  | 'remote-pending'
  | 'invalid-draft'
  | 'stale-draft';

export function getCodeEditorRefreshConfirmReason({
  draftState,
  hasPendingFinalizeChanges = false,
  isPersistedDraftStale = false,
}: CodeEditorUnsavedChangesOptions): CodeEditorRefreshConfirmReason | null {
  if (isPersistedDraftStale) {
    return 'stale-draft';
  }
  if (isDraftRemotePending(draftState)) {
    return 'remote-pending';
  }
  if (isDraftInvalid(draftState)) {
    return 'invalid-draft';
  }
  if (draftState.dirty || hasPendingFinalizeChanges) {
    return 'local-dirty';
  }
  return null;
}

export function hasCodeEditorUnsavedChanges({
  draftState,
  hasPendingFinalizeChanges = false,
  isPersistedDraftStale = false,
}: CodeEditorUnsavedChangesOptions): boolean {
  return (
    getCodeEditorRefreshConfirmReason({
      draftState,
      hasPendingFinalizeChanges,
      isPersistedDraftStale,
    }) != null
  );
}
