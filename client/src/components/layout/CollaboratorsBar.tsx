import useCollaborationStore from '@/stores/useCollaborationStore';

/**
 * 현재 다이어그램에 접속 중인 협업자 아바타 목록을 표시하는 컴포넌트.
 *
 * Header에 통합되어, 원격 사용자의 이름 이니셜과 색상을 원형 아바타로 표시한다.
 */
export default function CollaboratorsBar() {
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);
  const entries = Array.from(remoteCursors.entries());

  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {entries.map(([clientId, state]) => (
        <div
          key={clientId}
          className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-erd-cursor-foreground shrink-0"
          style={{ backgroundColor: state.user.color }}
          title={state.user.name}
          aria-label={state.user.name}
        >
          {state.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
