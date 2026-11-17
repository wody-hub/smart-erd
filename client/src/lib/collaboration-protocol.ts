import { PROTOCOL_TOO_OLD, PROTOCOL_UPGRADE_REQUIRED } from '@/constants/collaboration-protocol';

/** 앱 새로고침까지 유지되는 편집 프로토콜 차단 상태. */
export class ClientProtocolGate {
  private blocked = false;
  private readonly listeners = new Set<() => void>();

  /**
   * 편집과 저장이 차단되었는지 반환한다.
   * @returns 현재 탭의 프로토콜 차단 여부
   */
  isBlocked(): boolean {
    return this.blocked;
  }

  /** 최초 정책 거부를 구독자에게 한 번만 알린다. */
  block(): void {
    if (this.blocked) return;
    this.blocked = true;
    this.listeners.forEach((listener) => listener());
  }

  /**
   * 프로토콜 차단을 구독한다.
   * @param listener 차단 시 실행할 콜백
   * @returns 구독 해제 함수
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** 현재 탭의 모든 저장 경로와 협업 세션이 공유하는 차단 상태. */
export const collaborationProtocolGate = new ClientProtocolGate();

/**
 * Axios 응답 또는 로컬 차단 예외에서 업그레이드 필요 여부를 판별한다.
 * @param error 요청 오류
 * @returns 앱 업데이트 필요 여부
 */
export function isProtocolTooOldError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; response?: { status?: number; data?: unknown } };
  const data = value.response?.data;
  return (
    value.code === PROTOCOL_TOO_OLD ||
    (value.response?.status === PROTOCOL_UPGRADE_REQUIRED &&
      data !== null &&
      typeof data === 'object' &&
      'code' in data &&
      data.code === PROTOCOL_TOO_OLD)
  );
}

/** 새로고침 전 저장 재시도를 네트워크 요청 없이 거부하는 예외. */
export class ProtocolTooOldError extends Error {
  readonly code = PROTOCOL_TOO_OLD;
  constructor() {
    super(PROTOCOL_TOO_OLD);
  }
}
