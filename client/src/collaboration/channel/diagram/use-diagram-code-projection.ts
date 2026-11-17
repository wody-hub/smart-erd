import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ProjectionDictionaryVersion } from '@/collaboration/plugins/erd/erd-code-projection-port';
import {
  DiagramCodeProjectionState,
  type DiagramCodeProjectionSource,
} from './diagram-code-projection-state';

/** 읽기 연결과 연결 세대의 렌더 신호. */
export interface DiagramCodeProjectionRuntime {
  /** 기존 런타임의 읽기 연결. */
  source: DiagramCodeProjectionSource | null;
  /** authoritative 수화가 끝난 현재 연결 세대인지 여부. */
  ready: boolean;
  /** 재접속·수화 세대. */
  generation: string | number;
}

/**
 * authoritative 수화 이후에만 읽고 모든 패치를 동기 스트림으로 제공한다.
 * @param enabled 내부 rollout 활성 여부
 * @param runtime 기존 문서 런타임의 읽기 연결과 준비 신호
 * @param dictionary 공유 사전 스냅샷
 * @returns 전체 텍스트·버전·안내·상태 및 누락 없는 패치 구독
 */
export function useDiagramCodeProjection(
  enabled: boolean,
  runtime: DiagramCodeProjectionRuntime,
  dictionary: ProjectionDictionaryVersion,
) {
  /** 마운트 수명 동안 소비자 버전과 스냅샷을 보존하는 읽기 상태. */
  const [state] = useState(() => new DiagramCodeProjectionState());
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
  useEffect(() => {
    state.connect(enabled, runtime.source, dictionary);
    return () => state.disconnect();
    // 사전은 아래 효과에서 기존 포트에 전달하여 포트/버전을 보존한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, runtime.source, state]);
  useEffect(() => {
    state.setDictionary(dictionary);
  }, [dictionary, state]);
  useEffect(() => {
    state.refreshReadiness();
  }, [runtime.ready, runtime.generation, state]);
  return { ...snapshot, getSnapshot: state.getSnapshot, subscribePatches: state.subscribePatches };
}
