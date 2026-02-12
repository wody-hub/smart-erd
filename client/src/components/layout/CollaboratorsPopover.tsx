import { useTranslation } from 'react-i18next';
import type { PresenceParticipant } from '@/types/collaboration';

/**
 * 사용자 ID를 기반으로 고정 커서 색상을 생성한다.
 *
 * @param userId 사용자 ID
 * @returns CSS 색상 문자열
 */
function getPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const idx = (hash % 6) + 1;
  return `hsl(var(--cursor-color-${idx}))`;
}

/**
 * 이름에서 아바타 이니셜(첫 글자)을 추출한다.
 *
 * @param name 표시 이름
 * @returns 이니셜 1글자
 */
function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

interface CollaboratorsPopoverProps {
  /** 정렬된 참여자 목록 */
  participants: PresenceParticipant[];
  /** 현재 사용자 ID */
  selfUserId: string | null;
  /** 현재 사용자 loginId (fallback 식별용) */
  selfLoginId: string | null;
}

/**
 * 접속자 목록 팝업 콘텐츠.
 */
export default function CollaboratorsPopover({
  participants,
  selfUserId,
  selfLoginId,
}: CollaboratorsPopoverProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">
        {t('collaboration.participants.title', { count: participants.length })}
      </div>
      <div className="max-h-72 overflow-y-auto pr-1">
        <div className="space-y-2">
          {participants.map((participant) => {
            const bgColor = getPresenceColor(participant.userId);
            const isSelf =
              (selfUserId && participant.userId === selfUserId) ||
              (!selfUserId && selfLoginId && participant.userId === selfLoginId);
            const displayLabel = isSelf
              ? `${participant.displayName} (${t('collaboration.participants.me')})`
              : participant.displayName;
            return (
              <div key={participant.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-erd-cursor-foreground shrink-0"
                  style={{ backgroundColor: bgColor }}
                  aria-label={displayLabel}
                >
                  {getInitial(participant.displayName)}
                </div>
                <span className="text-sm text-popover-foreground flex-1 truncate">{displayLabel}</span>
                <span
                  className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                  aria-label={t('collaboration.participants.online')}
                  title={t('collaboration.participants.online')}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { getPresenceColor, getInitial };
