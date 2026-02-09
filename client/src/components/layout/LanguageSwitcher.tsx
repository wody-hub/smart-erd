import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** 지원하는 언어 목록 */
const LANGUAGES = ['ko', 'en'] as const;

/**
 * 언어 전환 드롭다운 컴포넌트.
 *
 * i18n.changeLanguage() 호출 시 LanguageDetector가 localStorage에 자동 저장한다.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-header-muted hover:text-header-foreground hover:bg-header/80"
          aria-label={t('common.aria.language')}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className={currentLanguage === lang ? 'font-bold' : ''}
          >
            {t(`language.${lang}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
