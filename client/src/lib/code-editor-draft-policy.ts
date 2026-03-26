import type { DraftState } from '@/collaboration/core/draft/draft-state';
import { isDraftInvalid, isDraftRemotePending } from '@/collaboration/core/draft/draft-state';

export function isCodeEditorApplyBlocked(draftState: DraftState): boolean {
  return isDraftRemotePending(draftState);
}

export function isCodeEditorFinalizeBlocked(draftState: DraftState): boolean {
  return isDraftRemotePending(draftState) || isDraftInvalid(draftState);
}
