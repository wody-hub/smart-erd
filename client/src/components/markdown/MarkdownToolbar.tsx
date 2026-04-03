import { Eye, FileText, LayoutPanelLeft, MoreHorizontal, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentExportFormat } from '@/types/document';

/** markdown toolbar props. */
interface MarkdownToolbarProps {
  /** 현재 편집 모드 */
  mode: 'write' | 'split' | 'preview';
  /** 모드 변경 핸들러 */
  onModeChange: (mode: 'write' | 'split' | 'preview') => void;
  /** 저장 핸들러 */
  onSave: () => void;
  /** 정보 패널 열기 핸들러 */
  onOpenInfo: () => void;
  /** export 핸들러 */
  onExport: (format: DocumentExportFormat) => void;
  /** 저장 진행 여부 */
  savePending: boolean;
  /** 모바일 레이아웃 여부 */
  isMobile: boolean;
}

/**
 * markdown 문서 편집 툴바를 렌더링한다.
 *
 * @param props 툴바 props
 * @returns markdown 툴바 JSX
 */
export default function MarkdownToolbar({
  mode,
  onModeChange,
  onSave,
  onOpenInfo,
  onExport,
  savePending,
  isMobile,
}: MarkdownToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="surface-operational flex flex-col gap-3 rounded-2xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as typeof mode)}>
        <TabsList>
          <TabsTrigger value="write">{t('markdown.mode.write')}</TabsTrigger>
          <TabsTrigger value="split">
            {isMobile ? t('markdown.mode.outline') : t('markdown.mode.split')}
          </TabsTrigger>
          <TabsTrigger value="preview">{t('markdown.mode.preview')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenInfo}>
          <LayoutPanelLeft className="mr-2 h-4 w-4" />
          {t('markdown.info.title')}
        </Button>
        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label={t('markdown.toolbar.export')}>
                <MoreHorizontal className="mr-2 h-4 w-4" />
                {t('markdown.toolbar.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onExport('md')}>
                <FileText className="mr-2 h-4 w-4" />
                MD
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport('html')}>
                <Eye className="mr-2 h-4 w-4" />
                HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => onExport('md')}>
              <FileText className="mr-2 h-4 w-4" />
              MD
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport('html')}>
              <Eye className="mr-2 h-4 w-4" />
              HTML
            </Button>
          </>
        )}
        <Button size="sm" onClick={onSave} disabled={savePending}>
          <Save className="mr-2 h-4 w-4" />
          {savePending ? t('common.button.saving') : t('common.button.save')}
        </Button>
      </div>
    </div>
  );
}
