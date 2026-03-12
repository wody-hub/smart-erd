import { useEffect, useMemo, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import useAuthStore from '@/stores/useAuthStore';
import useCanvasStore from '@/stores/erd/useCanvasStore';
import { CURSOR_COLORS } from '@/constants/ws';
import { LOCK_HEARTBEAT_MS } from '@/constants/collab-lock';
import { buildTableLockKeyFromNodeData } from '@/lib/table-lock-key';
import type { YjsProvider } from '@/collaboration/YjsProvider';
import type { AwarenessState } from '@/types/collaboration';

/** 커서 위치 발행 throttle 간격 (ms) */
const CURSOR_THROTTLE_MS = 100;

/** buildAwarenessState 파라미터 */
interface BuildAwarenessStateParams {
  /** Provider의 사용자 ID */
  userId: string | null;
  /** 사용자 이름 */
  name: string;
  /** 로그인 ID */
  loginId: string;
  /** 커서 색상 */
  color: string;
  /** Provider의 클라이언트 ID */
  clientId: number;
  /** 커서 위치 (null이면 캔버스 밖) */
  cursor: { x: number; y: number } | null;
  /** 선택된 노드 ID */
  selectedNodeId: string | null;
  /** ERD 편집 중 노드 ID */
  activeEditNodeId: string | null;
  /** 코드 에디터 편집 테이블 키 */
  codeEditingTableKey: string | null;
  /** ERD 편집 테이블 키 */
  activeErdTableKey: string | null;
}

/**
 * Awareness 상태 객체를 순수하게 생성한다.
 *
 * Provider/Ref 의존성 없이 상태 객체를 구성할 수 있도록 분리하여
 * useEffect 내부의 가독성을 높인다.
 *
 * @param params 상태 구성 파라미터
 * @returns Awareness 상태 객체
 */
function buildAwarenessState(params: BuildAwarenessStateParams): AwarenessState {
  const editingTableKey = params.codeEditingTableKey ?? params.activeErdTableKey;
  const editingSource = params.codeEditingTableKey ? 'code' : editingTableKey ? 'erd' : null;
  return {
    user: {
      userId: params.userId,
      name: params.name,
      loginId: params.loginId,
      color: params.color,
    },
    cursor: params.cursor,
    selectedNodeId: params.selectedNodeId,
    editingNodeId: editingSource === 'erd' ? params.activeEditNodeId : null,
    editingTableKey,
    editingSource,
    editingClientId: editingTableKey ? params.clientId : null,
    lockHeartbeatAt: editingTableKey ? Date.now() : null,
  };
}

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
  const loginId = useAuthStore((s) => s.loginId);
  const name = useAuthStore((s) => s.name);
  const activeEditNodeId = useCanvasStore((s) => s.activeEditNodeId);
  const codeEditingTableKey = useCanvasStore((s) => s.codeEditingTableKey);
  const nodes = useCanvasStore((s) => s.nodes);
  const { screenToFlowPosition } = useReactFlow();
  const screenToFlowPositionRef = useRef(screenToFlowPosition);
  const activeEditNodeIdRef = useRef(activeEditNodeId);
  const activeErdTableKeyRef = useRef<string | null>(null);
  const codeEditingTableKeyRef = useRef<string | null>(codeEditingTableKey);
  const emitAwarenessRef = useRef<
    ((cursor: { x: number; y: number } | null, selectedNodeId?: string | null) => void) | null
  >(null);

  /** 마지막 발행 시각 */
  const lastEmitRef = useRef(0);
  /** 마지막 커서 위치 */
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);
  /** ERD 편집 중 락 키 스냅샷 */
  const activeErdLockSnapshotRef = useRef<{ nodeId: string; tableKey: string } | null>(null);

  const activeErdTableKey = useMemo(() => {
    if (!activeEditNodeId) {
      return null;
    }
    const snapshot = activeErdLockSnapshotRef.current;
    if (snapshot && snapshot.nodeId === activeEditNodeId) {
      return snapshot.tableKey;
    }

    const node = nodes.find((candidate) => candidate.id === activeEditNodeId);
    if (!node) {
      return null;
    }

    const tableKey = buildTableLockKeyFromNodeData(node.data);
    activeErdLockSnapshotRef.current = { nodeId: activeEditNodeId, tableKey };
    return tableKey;
  }, [activeEditNodeId, nodes]);

  useEffect(() => {
    if (!activeEditNodeId) {
      activeErdLockSnapshotRef.current = null;
    }
  }, [activeEditNodeId]);

  useEffect(() => {
    screenToFlowPositionRef.current = screenToFlowPosition;
  }, [screenToFlowPosition]);

  useEffect(() => {
    activeEditNodeIdRef.current = activeEditNodeId;
  }, [activeEditNodeId]);

  useEffect(() => {
    activeErdTableKeyRef.current = activeErdTableKey;
  }, [activeErdTableKey]);

  useEffect(() => {
    codeEditingTableKeyRef.current = codeEditingTableKey;
  }, [codeEditingTableKey]);

  // --- Awareness 발행 + 마우스 이벤트 + heartbeat 통합 Effect ---
  useEffect(() => {
    if (!provider || !canvasRef.current || !loginId || !name) {
      return;
    }

    const colorIndex = provider.clientId % CURSOR_COLORS.length;
    const color = CURSOR_COLORS[colorIndex];

    /**
     * 로컬 Awareness 상태를 구성하여 Provider에 전달한다.
     *
     * @param cursor         커서 위치 (null이면 캔버스 밖)
     * @param selectedNodeId 선택된 노드 ID
     */
    const emitAwareness = (
      cursor: { x: number; y: number } | null,
      selectedNodeId: string | null = activeEditNodeIdRef.current,
    ) => {
      lastCursorRef.current = cursor;
      const state = buildAwarenessState({
        userId: provider.userId,
        name,
        loginId,
        color,
        clientId: provider.clientId,
        cursor,
        selectedNodeId,
        activeEditNodeId: activeEditNodeIdRef.current,
        codeEditingTableKey: codeEditingTableKeyRef.current,
        activeErdTableKey: activeErdTableKeyRef.current,
      });
      provider.setLocalAwareness(state);
    };
    emitAwarenessRef.current = emitAwareness;

    // 입장 직후에도 사용자 목록이 즉시 동기화되도록 초기 Awareness를 즉시 전송한다.
    emitAwareness(null);

    // --- 마우스 이벤트 리스너 ---

    /** 마우스 이동 핸들러 (throttle 적용) */
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastEmitRef.current < CURSOR_THROTTLE_MS) {
        return;
      }
      lastEmitRef.current = now;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const flowPos = screenToFlowPositionRef.current({ x: e.clientX, y: e.clientY });
      emitAwareness(flowPos);
    };

    /** 마우스가 캔버스를 떠날 때 */
    const handleMouseLeave = () => {
      emitAwareness(null);
    };

    const el = canvasRef.current;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    // --- 편집 락 heartbeat 타이머 ---

    const heartbeatTimer = setInterval(() => {
      if (!codeEditingTableKeyRef.current && !activeErdTableKeyRef.current) {
        return;
      }
      emitAwareness(lastCursorRef.current);
    }, LOCK_HEARTBEAT_MS);

    // --- 정리 ---

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      clearInterval(heartbeatTimer);
      emitAwarenessRef.current = null;
      activeEditNodeIdRef.current = null;
      activeErdTableKeyRef.current = null;
      codeEditingTableKeyRef.current = null;
      lastCursorRef.current = null;
      emitAwareness(null, null);
    };
  }, [provider, canvasRef, loginId, name]);

  // 편집 상태 변경 시 awareness를 즉시 갱신한다.
  useEffect(() => {
    emitAwarenessRef.current?.(lastCursorRef.current, activeEditNodeId);
  }, [activeEditNodeId, activeErdTableKey, codeEditingTableKey]);
}
