import { useReactFlow } from '@xyflow/react';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import useAuthStore from '@/stores/useAuthStore';

/**
 * 원격 사용자의 커서를 캔버스 위에 오버레이로 표시하는 컴포넌트.
 *
 * React Flow 뷰포트 좌표를 화면 좌표로 변환하여 커서를 렌더링한다.
 * pointer-events-none으로 클릭 이벤트를 차단한다.
 */
export default function RemoteCursors() {
  /** 원격 사용자 커서 상태 맵 */
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);
  const selfUserId = useCollaborationStore((s) => s.selfUserId);
  const selfLoginId = useAuthStore((s) => s.loginId);
  /** React Flow 뷰포트 → 화면 좌표 변환 함수 */
  const { flowToScreenPosition } = useReactFlow();

  /** 원격 커서 엔트리 배열 */
  const entries = Array.from(remoteCursors.entries()).filter(([, state]) => {
    const user = state.user;
    if (!user) {
      return true;
    }
    if (selfUserId && user.userId === selfUserId) {
      return false;
    }
    if (selfLoginId && user.loginId === selfLoginId) {
      return false;
    }
    return true;
  });

  if (entries.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {entries.map(([clientId, state]) => {
        if (!state.cursor) return null;

        const screenPos = flowToScreenPosition(state.cursor);

        return (
          <div
            key={clientId}
            className="absolute transition-transform duration-75"
            style={{
              transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
            }}
          >
            {/* 커서 아이콘 (SVG 포인터) */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-sm"
            >
              <path
                d="M3 3L10 17L12.5 10.5L19 8L3 3Z"
                fill={state.user.color}
                stroke="hsl(var(--background))"
                strokeWidth="1"
              />
            </svg>
            {/* 사용자 이름 라벨 */}
            <span
              className="ml-4 -mt-1 text-xs text-erd-cursor-foreground px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ backgroundColor: state.user.color }}
            >
              {state.user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
