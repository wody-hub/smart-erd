import { useTranslation } from 'react-i18next';
import MarkdownInfoDrawer from '@/components/markdown/MarkdownInfoDrawer';
import MarkdownOutlineRail from '@/components/markdown/MarkdownOutlineRail';
import MarkdownPreviewPane from '@/components/markdown/MarkdownPreviewPane';
import MarkdownStatusStrip from '@/components/markdown/MarkdownStatusStrip';
import MarkdownToolbar from '@/components/markdown/MarkdownToolbar';
import type { DocumentExportFormat } from '@/types/document';
import type { MarkdownHeadingItem } from '@/types/markdown';

/** markdown 에디터 쉘 props. */
interface MarkdownEditorShellProps {
  /** outline heading 목록 */
  headings: MarkdownHeadingItem[];
  /** preview용 HTML */
  previewHtml: string;
  /** frontmatter object */
  frontmatter: Record<string, unknown>;
  /** 템플릿 표시 이름 */
  templateLabel: string | null;
  /** 현재 편집 모드 */
  mode: 'write' | 'split' | 'preview';
  /** 편집 모드 변경 핸들러 */
  onModeChange: (mode: 'write' | 'split' | 'preview') => void;
  /** 저장 핸들러 */
  onSave: () => void;
  /** 정보 패널 열기 핸들러 */
  onOpenInfo: () => void;
  /** export 핸들러 */
  onExport: (format: DocumentExportFormat) => void;
  /** 미저장 변경 여부 */
  dirty: boolean;
  /** 저장 진행 여부 */
  savePending: boolean;
  /** 마지막 저장 시각 */
  lastSavedAt: string | null;
  /** 데스크톱 정보 패널 노출 여부 */
  showDesktopInfo: boolean;
  /** 실제 에디터 패널 */
  editorPane: React.ReactNode;
  /** 모바일 레이아웃 여부 */
  isMobile: boolean;
  /** 모바일 info drawer 오픈 여부 */
  infoDrawerOpen: boolean;
  /** 모바일 info drawer 오픈 상태 변경 핸들러 */
  onInfoDrawerOpenChange: (open: boolean) => void;
  /** frontmatter YAML 파싱 유효 여부 */
  frontmatterValid?: boolean;
}

/**
 * markdown 문서 편집용 adaptive shell을 렌더링한다.
 *
 * @param props 에디터 쉘 props
 * @returns markdown 에디터 쉘 JSX
 */
export default function MarkdownEditorShell({
  headings,
  previewHtml,
  frontmatter,
  templateLabel,
  mode,
  onModeChange,
  onSave,
  onOpenInfo,
  onExport,
  dirty,
  savePending,
  lastSavedAt,
  showDesktopInfo,
  editorPane,
  isMobile,
  infoDrawerOpen,
  onInfoDrawerOpenChange,
  frontmatterValid = true,
}: MarkdownEditorShellProps) {
  const { t } = useTranslation();
  const showEditorPane = isMobile ? mode === 'write' : mode !== 'preview';
  const showPreviewPane = isMobile ? mode === 'preview' : mode !== 'write';
  const showMobileOutline = isMobile && mode === 'split';

  return (
    <>
      <div className="flex flex-col gap-4">
        <MarkdownStatusStrip
          templateLabel={templateLabel}
          dirty={dirty}
          savePending={savePending}
          lastSavedAt={lastSavedAt}
          frontmatterValid={frontmatterValid}
        />
        <MarkdownToolbar
          mode={mode}
          onModeChange={onModeChange}
          onSave={onSave}
          onOpenInfo={onOpenInfo}
          onExport={onExport}
          savePending={savePending}
          isMobile={isMobile}
        />

        <div
          className={
            isMobile
              ? 'grid grid-cols-1 gap-4'
              : showDesktopInfo
                ? 'grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)_280px]'
                : 'grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]'
          }
        >
          {!isMobile && <MarkdownOutlineRail headings={headings} />}
          {showEditorPane && <div className="surface-operational rounded-2xl">{editorPane}</div>}
          {showPreviewPane && <MarkdownPreviewPane html={previewHtml} />}
          {!isMobile && showDesktopInfo && (
            <MarkdownInfoDrawer
              open={showDesktopInfo}
              onOpenChange={onInfoDrawerOpenChange}
              frontmatter={frontmatter}
              templateLabel={templateLabel}
            />
          )}
          {showMobileOutline && (
            <div className="surface-operational rounded-2xl px-4 py-4">
              <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('markdown.outline.title')}
              </div>
              <MarkdownOutlineRail headings={headings} />
            </div>
          )}
        </div>
      </div>

      {isMobile && (
        <MarkdownInfoDrawer
          open={infoDrawerOpen}
          onOpenChange={onInfoDrawerOpenChange}
          frontmatter={frontmatter}
          templateLabel={templateLabel}
          mobileOnly
        />
      )}
    </>
  );
}
