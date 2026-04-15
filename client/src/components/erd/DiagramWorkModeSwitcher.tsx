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
    <div className="header-utility-group">
      <span className="header-utility-label hidden lg:inline">{t('diagram.workMode.label')}</span>
      <Select value={mode} onValueChange={(value) => onModeChange(value as DiagramWorkMode)}>
        <SelectTrigger
          className="header-control-trigger h-8 w-[154px] rounded-full px-3 text-xs font-semibold"
          aria-label={t('diagram.workMode.label')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="code">{t('diagram.workMode.code')}</SelectItem>
          <SelectItem value="erd">{t('diagram.workMode.erd')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
