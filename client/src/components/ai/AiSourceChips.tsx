import type { AiChatSourceChip } from '@/types/ai-chat';

interface AiSourceChipsProps {
  chips: AiChatSourceChip[];
}

export default function AiSourceChips({ chips }: AiSourceChipsProps) {
  return (
    <div aria-label="사용한 자료">
      {chips.map((chip) => (
        <span key={`${chip.projectName}-${chip.tool}-${chip.count}`}>
          {chip.projectName} - {chip.tool} {chip.count}
        </span>
      ))}
    </div>
  );
}
