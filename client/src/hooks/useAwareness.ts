import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import useAuthStore from '@/stores/useAuthStore';
import { CURSOR_COLORS } from '@/constants/ws';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import type { AwarenessState } from '@/types/collaboration';

/** 커서 위치 발행 throttle 간격 (ms) */
const CURSOR_THROTTLE_MS = 100;

/**
 * Awareness 상태를 구독하고 로컬 커서 위치를 발행하는 훅.
 *
 * React Flow 뷰포트 좌표로 마우스 위치를 변환하여 서버에 전송한다.
 * 마우스가 캔버스 밖으로 나가면 cursor: null을 전송한다.
 *
 * @param provider   YjsProvider 인스턴스 (null이면 비활성)
 * @param canvasRef  ERD 캔버스 컨테이너 ref
 */
export function useAwareness(
  provider: YjsProvider | null,
  canvasRef: React.RefObject<HTMLDivElement | null>,
) {
  const { loginId, name } = useAuthStore();
  const { screenToFlowPosition } = useReactFlow();

  /** 마지막 발행 시각 */
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!provider || !canvasRef.current || !loginId || !name) return;

    const colorIndex = provider.clientId % CURSOR_COLORS.length;
    const color = CURSOR_COLORS[colorIndex];

    /**
     * 로컬 Awareness 상태를 구성하여 Provider에 전달한다.
     *
     * @param cursor 커서 위치 (null이면 캔버스 밖)
     */
    const emitAwareness = (cursor: { x: number; y: number } | null) => {
      const state: AwarenessState = {
        user: { name, loginId, color },
        cursor,
        selectedNodeId: null,
      };
      provider.setLocalAwareness(state);
    };

    /** 마우스 이동 핸들러 (throttle 적용) */
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastEmitRef.current < CURSOR_THROTTLE_MS) return;
      lastEmitRef.current = now;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      emitAwareness(flowPos);
    };

    /** 마우스가 캔버스를 떠날 때 */
    const handleMouseLeave = () => {
      emitAwareness(null);
    };

    const el = canvasRef.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      emitAwareness(null);
    };
  }, [provider, canvasRef, loginId, name, screenToFlowPosition]);
}
