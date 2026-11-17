import type { AxiosInstance } from 'axios';
import {
  CLIENT_PROTOCOL_HEADER,
  CLIENT_PROTOCOL_VERSION,
} from '@/constants/collaboration-protocol';
import {
  ClientProtocolGate,
  collaborationProtocolGate,
  isProtocolTooOldError,
  ProtocolTooOldError,
} from '@/lib/collaboration-protocol';

/**
 * 모든 Axios 요청에 버전을 첨부하고 정책 거부 후 문서 저장과 ticket 재발급을 차단한다.
 * @param client 공통 Axios 인스턴스
 * @param gate 현재 탭의 프로토콜 차단 상태
 */
export function installProtocolInterceptors(
  client: AxiosInstance,
  gate: ClientProtocolGate = collaborationProtocolGate,
): void {
  client.interceptors.request.use((config) => {
    config.headers.set(CLIENT_PROTOCOL_HEADER, String(CLIENT_PROTOCOL_VERSION));
    const method = config.method?.toUpperCase();
    const path = (config.url ?? '').split('?')[0];
    const isContentWrite =
      (['PUT', 'PATCH', 'DELETE'].includes(method ?? '') && /\/diagrams\/[^/]+$/.test(path)) ||
      (method === 'PATCH' && /\/diagrams\/[^/]+\/dictionary-set$/.test(path)) ||
      (method === 'POST' && /\/diagrams$/.test(path)) ||
      (method === 'DELETE' && /\/(?:teams|projects|dictionary-sets)\/[^/]+$/.test(path)) ||
      (method === 'POST' && /\/diagrams\/[^/]+\/ydoc-snapshot$/.test(path)) ||
      (method === 'POST' && /\/ws-ticket$/.test(path));
    if (gate.isBlocked() && isContentWrite) throw new ProtocolTooOldError();
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (isProtocolTooOldError(error)) gate.block();
      return Promise.reject(error);
    },
  );
}
