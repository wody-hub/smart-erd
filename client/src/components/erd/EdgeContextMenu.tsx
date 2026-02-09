import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { KEYBINDINGS } from '@/constants/keybindings';

/** EdgeContextMenu 컴포넌트의 props. */
interface EdgeContextMenuProps {
  /** 메뉴 표시 위치 (화면 좌표) */
  position: { x: number; y: number };
  /** 삭제 클릭 핸들러 */
  onDelete: () => void;
  /** 메뉴 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 엣지 우클릭 컨텍스트 메뉴.
 *
 * 마우스 위치에 "Delete connection" 메뉴를 표시한다.
 * 외부 클릭 또는 Escape 키로 닫힌다.
 *
 * @param props.position 메뉴 표시 위치 (화면 좌표)
 * @param props.onDelete 삭제 클릭 핸들러
 * @param props.onClose  메뉴 닫기 핸들러
 */
export default function EdgeContextMenu({ position, onDelete, onClose }: EdgeContextMenuProps) {
  const { t } = useTranslation();

  useHotkeys(KEYBINDINGS.ESCAPE, onClose);

  useEffect(() => {
    document.addEventListener('click', onClose);
    return () => {
      document.removeEventListener('click', onClose);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-md py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        className="w-full px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-4 w-4" />
        {t('erd.edge.contextDelete')}
      </button>
    </div>
  );
}
