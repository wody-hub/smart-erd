import { Link2, LayoutGrid, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Panel } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** CanvasToolbar 컴포넌트의 props. */
interface CanvasToolbarProps {
  /** FK 연결 모드 활성 여부 */
  fkMode: boolean;
  /** FK 연결 모드 토글 핸들러 */
  onToggleFkMode: () => void;
  /** 자동 배치 실행 핸들러 */
  onAutoLayout: () => void;
  /** PNG 내보내기 핸들러 */
  onExportPng: () => void;
  /** JPG 내보내기 핸들러 */
  onExportJpg: () => void;
  /** SVG 내보내기 핸들러 */
  onExportSvg: () => void;
  /** PDF 내보내기 핸들러 */
  onExportPdf: () => void;
}

/**
 * ERD 캔버스 플로팅 툴바.
 *
 * 캔버스 상단 중앙에 FK Connect, Auto Layout, Export 버튼을 표시한다.
 *
 * @param props.fkMode          FK 연결 모드 활성 여부
 * @param props.onToggleFkMode  FK 연결 모드 토글 핸들러
 * @param props.onAutoLayout    자동 배치 실행 핸들러
 * @param props.onExportPng     PNG 내보내기 핸들러
 * @param props.onExportJpg     JPG 내보내기 핸들러
 * @param props.onExportSvg     SVG 내보내기 핸들러
 * @param props.onExportPdf     PDF 내보내기 핸들러
 */
export default function CanvasToolbar({
  fkMode,
  onToggleFkMode,
  onAutoLayout,
  onExportPng,
  onExportJpg,
  onExportSvg,
  onExportPdf,
}: CanvasToolbarProps) {
  const { t } = useTranslation();

  return (
    <Panel position="top-center">
      <div className="bg-card border border-border rounded-lg shadow-md p-1 gap-1 flex">
        <Button
          variant={fkMode ? 'default' : 'ghost'}
          size="sm"
          onClick={onToggleFkMode}
          className={cn('gap-1.5', fkMode && 'bg-primary text-primary-foreground')}
          aria-label={fkMode ? t('erd.toolbar.fkConnectActive') : t('erd.toolbar.fkConnect')}
        >
          <Link2 className="h-4 w-4" />
          {t('erd.toolbar.fkConnect')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAutoLayout}
          className="gap-1.5"
          aria-label={t('erd.toolbar.autoLayout')}
        >
          <LayoutGrid className="h-4 w-4" />
          {t('erd.toolbar.autoLayout')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              aria-label={t('erd.toolbar.export')}
            >
              <Download className="h-4 w-4" />
              {t('erd.toolbar.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPng}>PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJpg}>JPG</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportSvg}>SVG</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPdf}>PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Panel>
  );
}
