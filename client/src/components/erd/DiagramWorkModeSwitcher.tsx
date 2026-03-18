import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiagramWorkMode } from '@/lib/diagram-work-mode';

/** DiagramWorkModeSwitcher 컴포넌트 props */
interface DiagramWorkModeSwitcherProps {
  /** 현재 작업 모드 */
  mode: DiagramWorkMode;
  /** 작업 모드 변경 핸들러 */
  onModeChange: (mode: DiagramWorkMode) => void;
}

/**
 * 다이어그램 작업 모드 전환기.
 *
 * @param props.mode 현재 작업 모드
 * @param props.onModeChange 작업 모드 변경 핸들러
 * @returns 작업 모드 전환기 JSX
 */
export default function DiagramWorkModeSwitcher({
  mode,
  onModeChange,
}: DiagramWorkModeSwitcherProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-header-muted">{t('diagram.workMode.label')}</span>
      <Select value={mode} onValueChange={(value) => onModeChange(value as DiagramWorkMode)}>
        <SelectTrigger
          className="h-8 w-[150px] border-header/40 bg-header/70 text-xs text-header-foreground"
          aria-label={t('diagram.workMode.label')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sync">{t('diagram.workMode.sync')}</SelectItem>
          <SelectItem value="code">{t('diagram.workMode.code')}</SelectItem>
          <SelectItem value="erd">{t('diagram.workMode.erd')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
