import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import useCollaborationStore from '@/stores/useCollaborationStore';
import type { PresenceMode } from '@/types/collaboration';

/** 컴팩션 트리거 크기 임계치 (bytes) — YLPF 오버헤드 감안 500 updates × ~200B */
const COMPACTION_SIZE_THRESHOLD = 100_000;

/** 컴팩션 메시지 크기 상한 (bytes) — WS 제한(1MB)보다 여유 있게 설정 */
const COMPACTION_MAX_SIZE = 900_000;

/** 컴팩션 지연 시간 (ms) — sync 완료 대기 */
const COMPACTION_DELAY = 5000;

/** 세션당 최대 컴팩션 시도 횟수 — 서버 거부/실패 시 무한 재시도 방지 */
const MAX_COMPACTION_ATTEMPTS = 3;

function isLikelyAlone(
  presenceMode: PresenceMode,
  participantsSize: number,
  remoteCursorsSize: number,
): boolean {
  // Presence v2 활성 상태에서는 participants 스냅샷이 접속자 수의 기준이다.
  if (presenceMode === 'active') {
    return participantsSize <= 1;
  }

  // Degraded 모드에서는 legacy fallback(원격 커서 수) 기준으로 판단한다.
  return remoteCursorsSize === 0;
}

/**
 * 스냅샷 크기가 임계치를 초과하고 단독 접속일 때 자동 컴팩션을 실행하는 훅.
 *
 * @param providerRef YjsProvider 참조
 * @param diagramId   현재 다이어그램 ID (SPA 전환 시 effect 재실행 트리거)
 */
export function useSnapshotCompaction(
  providerRef: React.RefObject<YjsProvider | null>,
  diagramId: string | undefined,
): void {
  /** 현재 세션의 컴팩션 시도 횟수 */
  const attemptsRef = useRef(0);
  /** 컴팩션 완료 시점의 provider 참조 — 다이어그램 전환 감지용 */
  const lastProviderRef = useRef<YjsProvider | null>(null);
  const presenceMode = useCollaborationStore((s) => s.presenceMode);
  const participantsSize = useCollaborationStore((s) => s.participantsByUserId.size);
  const remoteCursorsSize = useCollaborationStore((s) => s.remoteCursors.size);

  useEffect(() => {
    const provider = providerRef.current;

    // provider가 변경되었으면(다이어그램 전환) 시도 횟수 리셋
    if (provider !== lastProviderRef.current) {
      attemptsRef.current = 0;
      lastProviderRef.current = provider;
    }

    if (!provider || attemptsRef.current >= MAX_COMPACTION_ATTEMPTS) {
      return;
    }

    // 단독 접속 확인
    if (!isLikelyAlone(presenceMode, participantsSize, remoteCursorsSize)) {
      return;
    }

    const timer = setTimeout(() => {
      const currentProvider = providerRef.current;
      if (!currentProvider || !currentProvider.isSynced()) {
        return;
      }

      // 현재 Y.Doc 크기 확인 + 컴팩션 전송을 한 번의 인코딩으로 처리
      const fullState = Y.encodeStateAsUpdate(currentProvider.doc);
      if (fullState.byteLength < COMPACTION_SIZE_THRESHOLD) {
        return;
      }

      // WS 메시지 크기 상한 초과 시 컴팩션 스킵 (전송 실패 → 연결 끊김 방지)
      if (fullState.byteLength > COMPACTION_MAX_SIZE) {
        return;
      }

      // 단독 접속 재확인 (지연 시간 동안 다른 사용자가 접속했을 수 있음)
      const currentState = useCollaborationStore.getState();
      if (
        !isLikelyAlone(
          currentState.presenceMode,
          currentState.participantsByUserId.size,
          currentState.remoteCursors.size,
        )
      ) {
        return;
      }

      // 사전 인코딩된 fullState를 직접 전달하여 이중 인코딩 방지
      currentProvider.requestCompaction(fullState);
      attemptsRef.current += 1;
    }, COMPACTION_DELAY);

    return () => clearTimeout(timer);
  }, [providerRef, presenceMode, participantsSize, remoteCursorsSize, diagramId]);
}
