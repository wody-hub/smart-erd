import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Frame,
  Move,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SCREEN_DESIGN_FRAME_PRESETS,
  type ScreenDesignFramePreset,
  type ScreenDesignFramePresetId,
} from './screen-design-frame-presets';
import type { ScreenDesignViewportState } from './use-screen-design-viewport';

interface ScreenDesignEditorShellProps {
  /** 현재 문서 이름 */
  documentName: string;
  /** 협업 연결 준비 여부 */
  collaborationReady: boolean;
  /** 현재 선택된 프레임 preset 식별자 */
  framePresetId: ScreenDesignFramePresetId;
  /** 현재 선택된 프레임 preset 정보 */
  framePreset: ScreenDesignFramePreset;
  /** 현재 viewport 좌표와 배율 */
  viewport: ScreenDesignViewportState;
  /** 문서에 포함된 화면 목록 */
  screens: Array<{
    id: string;
    name: string;
  }>;
  /** 현재 선택된 화면 식별자 */
  selectedScreenId: string | null;
  /** 현재 선택된 화면의 이전 이동 가능 여부 */
  canNavigatePreviousScreen: boolean;
  /** 현재 선택된 화면의 다음 이동 가능 여부 */
  canNavigateNextScreen: boolean;
  /** 현재 export 동작 진행 여부 */
  exportBusy: boolean;
  /** 문서 허브로 돌아가기 */
  onBack: () => void;
  /** 선택 화면 변경 */
  onScreenChange: (screenId: string) => void;
  /** 이전 화면으로 이동 */
  onNavigatePreviousScreen: () => void;
  /** 다음 화면으로 이동 */
  onNavigateNextScreen: () => void;
  /** 프레임 preset 변경 */
  onFramePresetChange: (nextPresetId: string) => void;
  /** 프레임을 viewport에 맞춤 */
  onFitToFrame: () => void;
  /** 100% 배율로 되돌림 */
  onResetToActualSize: () => void;
  /** 확대 */
  onZoomIn: () => void;
  /** 축소 */
  onZoomOut: () => void;
  /** 현재 화면 PNG export */
  onExportPng: () => void;
  /** 전체 화면 PDF export */
  onExportPdf: () => void;
  /** 좌측 라이브러리 pane */
  libraryPane: ReactNode;
  /** 우측 인스펙터 pane */
  inspectorPane: ReactNode;
  /** Konva viewport pane */
  viewportPane: ReactNode;
}

/**
 * 화면기획 에디터 셸 레이아웃을 렌더링한다.
 *
 * @returns 화면기획 에디터 셸 JSX
 */
export default function ScreenDesignEditorShell({
  documentName,
  collaborationReady,
  framePresetId,
  framePreset,
  viewport,
  screens,
  selectedScreenId,
  canNavigatePreviousScreen,
  canNavigateNextScreen,
  exportBusy,
  onBack,
  onScreenChange,
  onNavigatePreviousScreen,
  onNavigateNextScreen,
  onFramePresetChange,
  onFitToFrame,
  onResetToActualSize,
  onZoomIn,
  onZoomOut,
  onExportPng,
  onExportPdf,
  viewportPane,
  libraryPane,
  inspectorPane,
}: ScreenDesignEditorShellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="surface-operational flex flex-col gap-3 rounded-lg px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('workspace.action.backToDocuments')}
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('screenSpec.canvas.workspaceTitle')}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{documentName}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[240px]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('screenSpec.toolbar.screenLabel')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t('screenSpec.toolbar.previousScreen')}
                  onClick={onNavigatePreviousScreen}
                  disabled={!canNavigatePreviousScreen}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={selectedScreenId ?? undefined}
                  onValueChange={onScreenChange}
                  disabled={screens.length === 0}
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1">
                    <SelectValue placeholder={t('screenSpec.toolbar.screenLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {screens.map((screen) => (
                      <SelectItem key={screen.id} value={screen.id}>
                        {screen.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t('screenSpec.toolbar.nextScreen')}
                  onClick={onNavigateNextScreen}
                  disabled={!canNavigateNextScreen}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-w-[220px]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('screenSpec.toolbar.frameLabel')}
              </p>
              <Select value={framePresetId} onValueChange={onFramePresetChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('screenSpec.toolbar.frameLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {SCREEN_DESIGN_FRAME_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {t(`screenSpec.framePreset.${preset.id}.label`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={onFitToFrame}>
              {t('screenSpec.toolbar.fitToFrame')}
            </Button>
            <Button variant="outline" size="sm" onClick={onResetToActualSize}>
              {t('screenSpec.toolbar.actualSize')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label={t('screenSpec.toolbar.zoomOut')}
              onClick={onZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label={t('screenSpec.toolbar.zoomIn')}
              onClick={onZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exportBusy || screens.length === 0}>
                  <Download className="mr-1 h-4 w-4" />
                  {exportBusy ? t('screenSpec.toolbar.exporting') : t('screenSpec.toolbar.export')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportPng} disabled={exportBusy || !selectedScreenId}>
                  PNG
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onExportPdf}
                  disabled={exportBusy || screens.length === 0}
                >
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="rounded-md border border-border/70 bg-secondary/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {collaborationReady
                ? t('screenSpec.status.ready')
                : t('screenSpec.status.connecting')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="surface-operational order-2 flex min-h-[220px] flex-col rounded-lg px-4 py-4 lg:order-1">
          {libraryPane}
        </aside>

        <section className="surface-operational order-1 flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('screenSpec.canvas.workspaceTitle')}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Frame className="h-4 w-4 text-muted-foreground" />
                  {t(`screenSpec.framePreset.${framePreset.id}.label`)}
                </span>
                <span className="text-muted-foreground">
                  {framePreset.width} x {framePreset.height}
                </span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Move className="h-4 w-4" />
              <span>{t('screenSpec.canvas.gestureHint')}</span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-secondary/42">{viewportPane}</div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {t('screenSpec.inspector.size')}: {framePreset.width} x {framePreset.height}
            </span>
            <span>
              {t('screenSpec.inspector.zoom')}: {Math.round(viewport.zoom * 100)}%
            </span>
            <span>
              {t('screenSpec.inspector.offsetX')}: {Math.round(viewport.x)}
            </span>
            <span>
              {t('screenSpec.inspector.offsetY')}: {Math.round(viewport.y)}
            </span>
          </div>
        </section>

        <aside className="surface-operational order-3 flex min-h-[220px] flex-col rounded-lg px-4 py-4 lg:col-span-2 xl:col-span-1">
          {inspectorPane}
        </aside>
      </div>
    </div>
  );
}
