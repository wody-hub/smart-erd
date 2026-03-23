/**
 * keepalive snapshot 저장 발사 여부를 계산한다.
 *
 * pagehide/hidden 경로는 응답을 확인할 수 없으므로, 마지막 발사 시각만 갱신하고
 * "성공 확정" 대신 pending 상태를 남겨 다시 visible 되었을 때 일반 저장으로 확정한다.
 *
 * @param now 현재 시각(epoch ms)
 * @param lastKeepaliveAt 마지막 keepalive 발사 시각
 * @param minIntervalMs 중복 전송 방지 최소 간격
 * @returns keepalive 발사 여부와 다음 상태
 */
export function beginCodeModeSnapshotKeepalive(
  now: number,
  lastKeepaliveAt: number,
  minIntervalMs: number,
): {
  shouldSend: boolean;
  nextLastKeepaliveAt: number;
  keepalivePending: boolean;
} {
  if (now - lastKeepaliveAt < minIntervalMs) {
    return {
      shouldSend: false,
      nextLastKeepaliveAt: lastKeepaliveAt,
      keepalivePending: false,
    };
  }

  return {
    shouldSend: true,
    nextLastKeepaliveAt: now,
    keepalivePending: true,
  };
}

/**
 * keepalive 이후 visible 복귀 시 일반 저장 재시도가 필요한지 계산한다.
 *
 * @param visibilityState 현재 문서 visibility 상태
 * @param keepalivePending keepalive 응답 미확정 여부
 * @returns 일반 저장 재시도 필요 여부
 */
export function shouldRetryCodeModeSnapshotAfterKeepalive(
  visibilityState: 'visible' | 'hidden' | 'prerender',
  keepalivePending: boolean,
): boolean {
  return keepalivePending && visibilityState === 'visible';
}
