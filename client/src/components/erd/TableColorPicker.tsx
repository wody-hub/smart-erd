import { useTranslation } from 'react-i18next';
import type { TableHeaderColor } from '@/types/erd';
import { TABLE_COLOR_ENTRIES } from '@/lib/table-colors';

/** TableColorPicker 컴포넌트 props */
interface TableColorPickerProps {
  /** 현재 선택된 색상 */
  currentColor: TableHeaderColor;
  /** 색상 선택 핸들러 */
  onSelect: (color: TableHeaderColor) => void;
}

/**
 * 테이블 헤더 색상 선택 컴포넌트.
 *
 * 10개 색상 프리셋(기본 + 9가지 커스텀)을 원형 버튼으로 나열한다.
 * 현재 선택된 색상에는 ring 강조 표시가 적용된다.
 *
 * @param props.currentColor 현재 선택된 색상
 * @param props.onSelect     색상 선택 핸들러
 */
export default function TableColorPicker({ currentColor, onSelect }: TableColorPickerProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1.5"
      role="radiogroup"
      aria-label={t('erd.colorPicker.title')}
    >
      {TABLE_COLOR_ENTRIES.map(([key, config]) => (
        <button
          key={key}
          className="nodrag h-5 w-5 rounded-full border border-border/50 transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          style={{
            backgroundColor: `hsl(${config.bg})`,
            boxShadow:
              currentColor === key
                ? '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))'
                : undefined,
          }}
          onClick={() => onSelect(key)}
          aria-label={t('erd.colorPicker.aria.selectColor', { color: t(config.label) })}
          role="radio"
          aria-checked={currentColor === key}
        />
      ))}
    </div>
  );
}
