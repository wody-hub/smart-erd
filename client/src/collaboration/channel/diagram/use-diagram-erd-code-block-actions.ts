import { useMemo } from 'react';
import type { CodeBlockCommit, CodeBlockCommitResult } from '@/lib/code-block-commit-contract';
import { useErdDocumentActions } from '@/collaboration/plugins/erd/use-erd-document-actions';
import { useDiagramRejectedCommandToast } from './use-diagram-command-feedback';

/** UI에서 사용하는 단일 블록 커밋 액션. */
export interface DiagramErdCodeBlockActions {
  commitCodeBlock(commit: CodeBlockCommit): CodeBlockCommitResult;
}

/** dispatch 직전 준비 검사와 기존 ID 기반 중복 방지 토스트를 재사용한다. */
export function useDiagramErdCodeBlockActions(): DiagramErdCodeBlockActions {
  const actions = useErdDocumentActions();
  const notifyRejected = useDiagramRejectedCommandToast();
  return useMemo(
    () => ({
      commitCodeBlock: (commit: CodeBlockCommit) => {
        const result = actions.commitCodeBlock(commit);
        if (result.status === 'rejected' && result.reason === 'not-ready') notifyRejected();
        return result;
      },
    }),
    [actions, notifyRejected],
  );
}
