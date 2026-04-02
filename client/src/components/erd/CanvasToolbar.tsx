import {
  Link2,
  LayoutGrid,
  Download,
  ClipboardCheck,
  Database,
  Upload,
  Code2,
  Undo2,
  Redo2,
  BookText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Panel } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  /** 테이블 정의서 내보내기 핸들러 */
  onExportTableDefinition?: () => void;
  /** 컬럼 정의서 내보내기 핸들러 */
  onExportColumnDefinition?: () => void;
  /** 인덱스 정의서 내보내기 핸들러 */
  onExportIndexDefinition?: () => void;
  /** SQL DDL 가져오기 핸들러 */
  onImportDdl?: () => void;
  /** 코드 에디터 활성 여부 */
  codeEditorActive?: boolean;
  /** 코드 에디터 토글 핸들러 */
  onToggleCodeEditor?: () => void;
  /** 유효성 검사 패널 열림 여부 */
  validationOpen?: boolean;
  /** 유효성 검사 패널 토글 핸들러 */
  onToggleValidation?: () => void;
  /** 다이어그램 사전 컨텍스트 페이지 열기 핸들러 */
  onOpenDictionaryContext?: () => void;
  /** 편집 가능 여부 (VIEWER일 때 false — FK/자동배치 숨김) */
  canEdit?: boolean;
  /** undo 가능 여부 */
  canUndo?: boolean;
  /** redo 가능 여부 */
  canRedo?: boolean;
  /** undo 핸들러 */
  onUndo?: () => void;
  /** redo 핸들러 */
  onRedo?: () => void;
  /** export 진행 여부 */
  isExporting?: boolean;
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
 * @param props.onExportTableDefinition 테이블 정의서 내보내기 핸들러
 * @param props.onExportColumnDefinition 컬럼 정의서 내보내기 핸들러
 * @param props.onExportIndexDefinition 인덱스 정의서 내보내기 핸들러
 * @param props.onImportDdl         SQL DDL 가져오기 핸들러
 * @param props.codeEditorActive    코드 에디터 활성 여부
 * @param props.onToggleCodeEditor  코드 에디터 토글 핸들러
 * @param props.validationOpen      유효성 검사 패널 열림 여부
 * @param props.onToggleValidation  유효성 검사 패널 토글 핸들러
 * @param props.onOpenDictionaryContext 다이어그램 사전 컨텍스트 페이지 열기 핸들러
 * @param props.canEdit             편집 가능 여부
 * @returns ERD 캔버스 툴바 JSX
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
  onExportTableDefinition,
  onExportColumnDefinition,
  onExportIndexDefinition,
  onImportDdl,
  codeEditorActive,
  onToggleCodeEditor,
  validationOpen,
  onToggleValidation,
  onOpenDictionaryContext,
  canEdit = true,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isExporting = false,
}: CanvasToolbarProps) {
  const { t } = useTranslation();

  return (
    <Panel position="top-center">
      <div className="surface-operational flex max-w-[calc(100vw-1rem)] gap-1 overflow-x-auto rounded-lg p-1 whitespace-nowrap md:max-w-none md:overflow-visible [&>*]:shrink-0">
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            className="gap-1.5"
            aria-label={t('erd.toolbar.undo')}
            disabled={!canUndo}
          >
            <Undo2 className="h-4 w-4" />
            {t('erd.toolbar.undo')}
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            className="gap-1.5"
            aria-label={t('erd.toolbar.redo')}
            disabled={!canRedo}
          >
            <Redo2 className="h-4 w-4" />
            {t('erd.toolbar.redo')}
          </Button>
        )}
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
        {canEdit && onToggleCodeEditor && (
          <Button
            variant={codeEditorActive ? 'default' : 'ghost'}
            size="sm"
            onClick={onToggleCodeEditor}
            className={cn('gap-1.5', codeEditorActive && 'bg-primary text-primary-foreground')}
            aria-label={
              codeEditorActive ? t('erd.toolbar.codeEditorActive') : t('erd.toolbar.codeEditor')
            }
          >
            <Code2 className="h-4 w-4" />
            {t('erd.toolbar.codeEditor')}
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
              aria-label={isExporting ? t('erd.toolbar.exporting') : t('erd.toolbar.export')}
              disabled={isExporting}
            >
              <Download className="h-4 w-4" />
              {isExporting ? t('erd.toolbar.exporting') : t('erd.toolbar.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPng} disabled={isExporting}>
              PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJpg} disabled={isExporting}>
              JPG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportSvg} disabled={isExporting}>
              SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPdf} disabled={isExporting}>
              PDF
            </DropdownMenuItem>
            {(onExportTableDefinition || onExportColumnDefinition || onExportIndexDefinition) && (
              <>
                <DropdownMenuSeparator />
                {onExportTableDefinition && (
                  <DropdownMenuItem onClick={onExportTableDefinition} disabled={isExporting}>
                    {t('erd.toolbar.tableDefinitionExport')}
                  </DropdownMenuItem>
                )}
                {onExportColumnDefinition && (
                  <DropdownMenuItem onClick={onExportColumnDefinition} disabled={isExporting}>
                    {t('erd.toolbar.columnDefinitionExport')}
                  </DropdownMenuItem>
                )}
                {onExportIndexDefinition && (
                  <DropdownMenuItem onClick={onExportIndexDefinition} disabled={isExporting}>
                    {t('erd.toolbar.indexDefinitionExport')}
                  </DropdownMenuItem>
                )}
              </>
            )}
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
        {onOpenDictionaryContext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDictionaryContext}
            className="gap-1.5"
            aria-label={t('erd.toolbar.dictionaryContext')}
          >
            <BookText className="h-4 w-4" />
            {t('erd.toolbar.dictionaryContext')}
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
