import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import useCollaborationStore from '@/stores/erd/useCollaborationStore';
import useAuthStore from '@/stores/useAuthStore';
import type { PresenceParticipant } from '@/types/collaboration';
import DiagramCollaboratorsPopover from './DiagramCollaboratorsPopover';
import { getInitial, getPresenceColor } from './diagramCollaboratorsUtils';

const MAX_PREVIEW_AVATARS = 3;

/**
 * 방 내 접속자를 Slack 스타일로 표시하는 헤더 컴포넌트.
 *
 * - 최대 3개 아바타를 보여주고
 * - 총 접속자 수는 숫자 배지로 표시하며
 * - 클릭 시 전체 목록 팝오버를 연다.
 */
export default function DiagramCollaboratorsBar() {
  const { t } = useTranslation();
  const presenceMode = useCollaborationStore((s) => s.presenceMode);
  const participantsByUserId = useCollaborationStore((s) => s.participantsByUserId);
  const selfUserId = useCollaborationStore((s) => s.selfUserId);
  const remoteCursors = useCollaborationStore((s) => s.remoteCursors);
  const selfLoginId = useAuthStore((s) => s.loginId);
  const selfName = useAuthStore((s) => s.name);

  const presenceParticipants = useMemo(() => {
    return Array.from(participantsByUserId.values()).sort(
      (a: PresenceParticipant, b: PresenceParticipant) => {
        if (a.joinSeq !== b.joinSeq) {
          return a.joinSeq - b.joinSeq;
        }
        return a.displayName.localeCompare(b.displayName);
      },
    );
  }, [participantsByUserId]);

  const fallbackParticipants = useMemo(() => {
    const byKey = new Map<string, PresenceParticipant>();
    let seq = 1;
    for (const state of remoteCursors.values()) {
      const user = state.user;
      if (!user?.name) {
        continue;
      }

      const key = user.userId ?? user.loginId;
      if (!key || byKey.has(key)) {
        continue;
      }

      byKey.set(key, {
        userId: key,
        displayName: user.name,
        joinSeq: seq++,
      });
    }

    return Array.from(byKey.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [remoteCursors]);

  const participants = useMemo(() => {
    const base =
      presenceMode === 'active' && presenceParticipants.length > 0
        ? presenceParticipants
        : fallbackParticipants;

    const selfKey = selfUserId ?? selfLoginId;
    if (!selfKey || base.some((participant) => participant.userId === selfKey)) {
      return base;
    }

    const displayName = selfName ?? selfLoginId;
    if (!displayName) {
      return base;
    }

    return [{ userId: selfKey, displayName, joinSeq: 0 }, ...base];
  }, [presenceMode, presenceParticipants, fallbackParticipants, selfUserId, selfLoginId, selfName]);

  if (participants.length === 0) {
    return null;
  }

  const preview = participants.slice(0, MAX_PREVIEW_AVATARS);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-xl border border-header-muted/40 px-2.5 hover:bg-header/80 transition-colors"
          aria-label={t('collaboration.participants.title', { count: participants.length })}
          title={t('collaboration.participants.title', { count: participants.length })}
        >
          <div className="flex -space-x-1.5">
            {preview.map((participant) => {
              const isSelf =
                (selfUserId && participant.userId === selfUserId) ||
                (!selfUserId && selfLoginId && participant.userId === selfLoginId);
              const label = isSelf
                ? `${participant.displayName} (${t('collaboration.participants.me')})`
                : participant.displayName;

              return (
                <span
                  key={participant.userId}
                  className="h-6 w-6 rounded-full border border-header bg-header flex items-center justify-center text-xs font-medium text-erd-cursor-foreground shrink-0"
                  style={{ backgroundColor: getPresenceColor(participant.userId) }}
                  aria-label={label}
                  title={label}
                >
                  {getInitial(participant.displayName)}
                </span>
              );
            })}
          </div>
          <span className="min-w-4 text-base leading-none font-semibold text-header-foreground tabular-nums">
            {participants.length}
          </span>
          <ChevronDown className="h-4 w-4 text-header-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-80">
        <DiagramCollaboratorsPopover
          participants={participants}
          selfUserId={selfUserId}
          selfLoginId={selfLoginId}
        />
      </PopoverContent>
    </Popover>
  );
}
