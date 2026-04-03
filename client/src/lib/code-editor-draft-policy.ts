import type { DraftState } from '@/collaboration/core/draft/draft-state';
import { isDraftInvalid, isDraftRemotePending } from '@/collaboration/core/draft/draft-state';

interface CodeEditorUnsavedChangesOptions {
  draftState: DraftState;
  hasPendingFinalizeChanges?: boolean;
  isPersistedDraftStale?: boolean;
}

export type CodeEditorApplyBlockReason = 'remote-pending' | 'stale-draft';
export type CodeEditorFinalizeBlockReason = 'remote-pending' | 'invalid-draft' | 'stale-draft';

interface CodeEditorBlockOptions {
  draftState: DraftState;
  isPersistedDraftStale?: boolean;
}

export function getCodeEditorApplyBlockReason({
  draftState,
  isPersistedDraftStale = false,
}: CodeEditorBlockOptions): CodeEditorApplyBlockReason | null {
  if (isPersistedDraftStale) {
    return 'stale-draft';
  }
  if (isDraftRemotePending(draftState)) {
    return 'remote-pending';
  }
  return null;
}

export function isCodeEditorApplyBlocked(
  draftState: DraftState,
  isPersistedDraftStale = false,
): boolean {
  return getCodeEditorApplyBlockReason({ draftState, isPersistedDraftStale }) != null;
}

export function getCodeEditorFinalizeBlockReason({
  draftState,
  isPersistedDraftStale = false,
}: CodeEditorBlockOptions): CodeEditorFinalizeBlockReason | null {
  if (isPersistedDraftStale) {
    return 'stale-draft';
  }
  if (isDraftRemotePending(draftState)) {
    return 'remote-pending';
  }
  if (isDraftInvalid(draftState)) {
    return 'invalid-draft';
  }
  return null;
}

export function isCodeEditorFinalizeBlocked(
  draftState: DraftState,
  isPersistedDraftStale = false,
): boolean {
  return getCodeEditorFinalizeBlockReason({ draftState, isPersistedDraftStale }) != null;
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
