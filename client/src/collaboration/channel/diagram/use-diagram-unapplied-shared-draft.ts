import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import {
  getSharedSchemaDraftMap,
  hasSharedSchemaDraftContent,
  readSharedSchemaDraftSnapshot,
} from '@/lib/shared-schema-draft';
import {
  getCodeModeSharedDraftMap,
  getCodeModeSharedDraftText,
  readCodeModeSharedDraftSnapshot,
} from '@/lib/code-mode-shared-draft';
import type { DiagramCodeProjectionRuntime } from './use-diagram-code-projection';

/**
 * 현재·레거시 공유 초안의 존재만 읽는다. 파싱·이관·적용·삭제하지 않는다.
 * @param document authoritative 문서
 * @returns 미적용 공유 초안이 있으면 true
 */
export function hasUnappliedSharedProjectionDraft(document: Y.Doc): boolean {
  if (hasSharedSchemaDraftContent(readSharedSchemaDraftSnapshot(document))) return true;
  const legacy = readCodeModeSharedDraftSnapshot(document);
  return (
    !!legacy.text.trim() ||
    !!legacy.graph?.nodes.length ||
    !!legacy.graph?.edges.length ||
    (legacy.isIntentionalBlank && legacy.isConfirmedBlank)
  );
}

/**
 * 내부 패널의 초안 존재 안내를 읽기만 한다. 캔버스 변경마다 큰 초안을 다시 읽지 않는다.
 * @param runtime authoritative 읽기 런타임
 * @returns 공유 초안 존재 여부
 */
export function useDiagramUnappliedSharedDraft(runtime: DiagramCodeProjectionRuntime): boolean {
  /** 원본을 변경하지 않는 안내 표시 상태. */
  const [exists, setExists] = useState(false);
  useEffect(() => {
    if (!runtime.ready || !runtime.source) {
      setExists(false);
      return;
    }
    const document = runtime.source.getDocument();
    const schema = getSharedSchemaDraftMap(document);
    const legacy = getCodeModeSharedDraftMap(document);
    let previousText: Y.Text | null = null;
    /**
     * 초안 루트가 바뀐 트랜잭션에서만 안내를 갱신한다.
     * @param transaction Yjs 변경 트랜잭션 (초기 읽기에서는 생략)
     * @returns 없음
     */
    const sync = (transaction?: Y.Transaction) => {
      const text = getCodeModeSharedDraftText(document);
      // 최초 원격 루트는 AbstractType에서 Y.Text로 구체화되므로 트랜잭션의 키와 다를 수 있다.
      const rootAppeared = text !== previousText;
      previousText = text;
      const changed: ReadonlyMap<unknown, unknown> | undefined = transaction?.changedParentTypes;
      if (
        transaction &&
        !rootAppeared &&
        !changed?.has(schema) &&
        !changed?.has(legacy) &&
        !(text && changed?.has(text))
      )
        return;
      setExists(hasUnappliedSharedProjectionDraft(document));
    };
    sync();
    document.on('afterTransaction', sync);
    return () => document.off('afterTransaction', sync);
  }, [runtime.source, runtime.ready, runtime.generation]);
  return exists;
}
