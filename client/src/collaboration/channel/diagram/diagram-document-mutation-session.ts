import type { MutationMeta } from '../../core/contracts/document-read-executor';
import type {
  DocumentCommand,
  InputAdapters,
  MutationPolicy,
} from '../../core/contracts/document-plugin';
import type {
  DocumentCommandDispatchResult,
  DocumentMutationSession,
} from '../../core/session/document-mutation-session';
import type { DocumentStore } from '../../core/store/document-store';

/** UI와 dispatch에서 동일한 준비 상태를 노출하는 ERD 세션. */
export type DiagramDocumentMutationSession = DocumentMutationSession & { readonly ready: boolean };

/** 로컬 문서는 즉시 준비되며 공유 문서는 권한·수화·동기화를 모두 확인한다. */
export function isDiagramDocumentReady(state: {
  localOnly: boolean;
  canEdit: boolean;
  hydrated: boolean;
  synced: boolean;
  connectionStatus: string;
}): boolean {
  return (
    state.canEdit &&
    (state.localOnly || (state.hydrated && state.synced && state.connectionStatus === 'connected'))
  );
}

/** 명령 실행 직전에 준비 상태를 다시 확인하여 미전송 쓰기를 차단한다. */
export function createDiagramDocumentMutationSession(
  store: DocumentStore,
  policy: MutationPolicy,
  inputAdapters: InputAdapters | null,
  isReady: () => boolean,
  refresh: () => void,
): DiagramDocumentMutationSession {
  const emitCommandWithResult = <T>(
    command: DocumentCommand,
    meta?: MutationMeta,
  ): DocumentCommandDispatchResult<T> => {
    if (!isReady()) {
      refresh();
      return { status: 'rejected' };
    }
    const resolvedMeta = meta ?? { origin: { source: 'local' as const } };
    const result = store.applyMutation<T>(policy.toMutation(command, resolvedMeta), resolvedMeta);
    if (!result.applied) {
      refresh();
      return result.value === undefined
        ? { status: 'rejected' }
        : { status: 'rejected', value: result.value };
    }
    return { status: 'applied', value: result.value };
  };
  return {
    enabled: true,
    get ready() {
      return isReady();
    },
    read: store,
    inputAdapters,
    emitCommand: (command, meta) => emitCommandWithResult(command, meta).status,
    emitCommandWithResult,
  };
}
