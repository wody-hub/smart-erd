import { Link2, LayoutGrid, Download, ClipboardCheck, Database, Upload } from 'lucide-react';
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
  /** SQL DDL 내보내기 핸들러 */
  onExportDdl?: () => void;
  /** SQL DDL 가져오기 핸들러 */
  onImportDdl?: () => void;
  /** 유효성 검사 패널 열림 여부 */
  validationOpen?: boolean;
  /** 유효성 검사 패널 토글 핸들러 */
  onToggleValidation?: () => void;
  /** 편집 가능 여부 (VIEWER일 때 false — FK/자동배치 숨김) */
  canEdit?: boolean;
}

/**
 * ERD 캔버스 플로팅 툴바.
 *
 * 캔버스 상단 중앙에 FK Connect, Auto Layout, Export, Validate 버튼을 표시한다.
 *
 * @param props.fkMode              FK 연결 모드 활성 여부
 * @param props.onToggleFkMode      FK 연결 모드 토글 핸들러
 * @param props.onAutoLayout        자동 배치 실행 핸들러
 * @param props.onExportPng         PNG 내보내기 핸들러
 * @param props.onExportJpg         JPG 내보내기 핸들러
 * @param props.onExportSvg         SVG 내보내기 핸들러
 * @param props.onExportPdf         PDF 내보내기 핸들러
 * @param props.onExportDdl         SQL DDL 내보내기 핸들러
 * @param props.onImportDdl         SQL DDL 가져오기 핸들러
 * @param props.validationOpen      유효성 검사 패널 열림 여부
 * @param props.onToggleValidation  유효성 검사 패널 토글 핸들러
 * @param props.canEdit             편집 가능 여부
 */
export default function CanvasToolbar({
  fkMode,
  onToggleFkMode,
  onAutoLayout,
  onExportPng,
  onExportJpg,
  onExportSvg,
  onExportPdf,
  onExportDdl,
  onImportDdl,
  validationOpen,
  onToggleValidation,
  canEdit = true,
}: CanvasToolbarProps) {
  const { t } = useTranslation();

  return (
    <Panel position="top-center">
      <div className="bg-card border border-border rounded-lg shadow-md p-1 gap-1 flex">
        {canEdit && (
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
        )}
        {canEdit && (
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
        )}
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
        {onExportDdl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportDdl}
            className="gap-1.5"
            aria-label={t('erd.toolbar.ddlExport')}
          >
            <Database className="h-4 w-4" />
            {t('erd.toolbar.ddlExport')}
          </Button>
        )}
        {canEdit && onImportDdl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onImportDdl}
            className="gap-1.5"
            aria-label={t('erd.toolbar.ddlImport')}
          >
            <Upload className="h-4 w-4" />
            {t('erd.toolbar.ddlImport')}
          </Button>
        )}
        {onToggleValidation && (
          <Button
            variant={validationOpen ? 'default' : 'ghost'}
            size="sm"
            onClick={onToggleValidation}
            className={cn('gap-1.5', validationOpen && 'bg-primary text-primary-foreground')}
            aria-label={
              validationOpen ? t('erd.toolbar.validateActive') : t('erd.toolbar.validate')
            }
          >
            <ClipboardCheck className="h-4 w-4" />
            {t('erd.toolbar.validate')}
          </Button>
        )}
      </div>
    </Panel>
  );
}
