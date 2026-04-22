import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import useThemeStore from '@/stores/useThemeStore';
import type { ThemeName } from '@/lib/theme';

/** theme 항목별 swatch CSS Variable (hsl 참조) */
const THEME_SWATCHES: Record<ThemeName, string> = {
  paper: 'hsl(var(--theme-swatch-paper))',
  graphite: 'hsl(var(--theme-swatch-graphite))',
  midnight: 'hsl(var(--theme-swatch-midnight))',
};

/** theme 선택 항목 목록 (표시 순서대로) */
const THEME_OPTIONS: ThemeName[] = ['paper', 'graphite', 'midnight'];

/**
 * 헤더에서 테마를 전환하는 드롭다운 컴포넌트.
 *
 * Palette 아이콘 버튼을 클릭하면 3개의 curated theme을 선택할 수 있다.
 * 선택 시 useThemeStore.setTheme()을 호출하여 localStorage persistence와 DOM class 적용을 동시에 트리거한다.
 *
 * @returns 테마 전환 드롭다운 JSX
 */
export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="header-icon-button h-8 w-8"
          aria-label={t('theme.aria.switchTheme')}
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('theme.current')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as ThemeName)}
        >
          {THEME_OPTIONS.map((name) => (
            <DropdownMenuRadioItem
              key={name}
              value={name}
              className={theme === name ? 'font-semibold' : ''}
            >
              <span
                className="mr-2 inline-block h-3 w-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: THEME_SWATCHES[name] }}
                aria-hidden="true"
              />
              {t(`theme.${name}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
