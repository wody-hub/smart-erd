import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Play } from 'lucide-react';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import useCanvasStore from '@/stores/useCanvasStore';
import { applyDagreLayout } from '@/lib/auto-layout';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDdlParse } from '@/hooks/useDdlParse';
import type { DbmsType } from '@/types/erd';

/** DdlCodeEditorPanel 컴포넌트의 props */
interface DdlCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
}

/**
 * DDL 코드 에디터 패널.
 *
 * 좌측 사이드바 대체 패널로 Monaco Editor에 SQL DDL을 입력하면
 * 실시간 파싱 프리뷰를 표시하고, Apply 버튼으로 ERD에 반영한다.
 * 기존 테이블/관계를 모두 교체(REPLACE)하는 방식이다.
 *
 * @param props.canEdit 편집 가능 여부
 */
export default function DdlCodeEditorPanel({ canEdit = true }: DdlCodeEditorPanelProps) {
  const { t } = useTranslation();

  const replaceFromDdl = useCanvasStore((s) => s.replaceFromDdl);
  const applyLayout = useCanvasStore((s) => s.applyLayout);
  const nodes = useCanvasStore((s) => s.nodes);

  const { dbms, ddlText, parseResult, parsing, handleDdlChange, handleDbmsChange } = useDdlParse({
    persistDbms: true,
  });

  /** 교체 확인 다이얼로그 열림 상태 */
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Apply 버튼 클릭 — 기존 테이블이 있으면 확인 다이얼로그, 없으면 즉시 적용 */
  const handleApply = () => {
    if (!parseResult || parseResult.tables.length === 0) return;
    if (nodes.length > 0) {
      setConfirmOpen(true);
    } else {
      executeApply();
    }
  };

  /** DDL 파싱 결과를 ERD에 반영한다. */
  const executeApply = () => {
    if (!parseResult) return;
    try {
      replaceFromDdl(parseResult);
      // replaceFromDdl 후 즉시 최신 노드/엣지를 가져와 dagre 자동 배치 적용
      const freshNodes = useCanvasStore.getState().nodes;
      const freshEdges = useCanvasStore.getState().edges;
      if (freshNodes.length > 0) {
        const layoutedNodes = applyDagreLayout(freshNodes, freshEdges);
        applyLayout(layoutedNodes);
      }
      toast.success(t('erd.codeEditor.success', { count: parseResult.tables.length }));
    } catch {
      toast.error(t('erd.codeEditor.failed'));
    }
    setConfirmOpen(false);
  };

  /** Apply 버튼 활성화 여부 */
  const canApply = canEdit && parseResult != null && parseResult.tables.length > 0 && !parsing;

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* DBMS 선택 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <Label className="text-xs text-muted-foreground mb-1 block">
          {t('erd.ddlImport.dbmsLabel')}
        </Label>
        <Select value={dbms} onValueChange={(v) => handleDbmsChange(v as DbmsType)}>
          <SelectTrigger className="h-8 text-xs" aria-label={t('erd.ddlImport.dbmsLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgresql">{t('erd.ddlExport.dbms.postgresql')}</SelectItem>
            <SelectItem value="mysql">{t('erd.ddlExport.dbms.mysql')}</SelectItem>
            <SelectItem value="oracle">{t('erd.ddlExport.dbms.oracle')}</SelectItem>
            <SelectItem value="sqlserver">{t('erd.ddlExport.dbms.sqlserver')}</SelectItem>
            <SelectItem value="ansi">{t('erd.ddlExport.dbms.ansi')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="sql"
          value={ddlText}
          onChange={handleDdlChange}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            placeholder: undefined,
          }}
          theme={isDark ? 'vs-dark' : 'vs'}
        />
      </div>

      {/* 파싱 결과 프리뷰 + Apply 버튼 */}
      <div className="px-3 py-2 border-t border-border shrink-0 space-y-2">
        {/* 파싱 상태 */}
        <div className="flex items-center gap-2 text-xs min-h-[20px]">
          {parsing && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('erd.ddlImport.parsing')}
            </span>
          )}

          {!parsing && parseResult && (
            <>
              {parseResult.tables.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('erd.ddlImport.preview', {
                    tables: parseResult.tables.length,
                    relations: parseResult.relations.length,
                  })}
                </span>
              )}

              {parseResult.errors.length > 0 && parseResult.tables.length > 0 && (
                <span className="flex items-center gap-1 text-erd-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {t('erd.ddlImport.warnings', { count: parseResult.errors.length })}
                </span>
              )}

              {parseResult.tables.length === 0 && parseResult.errors.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {t('erd.ddlImport.parseError')}
                </span>
              )}
            </>
          )}
        </div>

        {/* Apply 버튼 */}
        <Button className="w-full gap-1.5" size="sm" onClick={handleApply} disabled={!canApply}>
          <Play className="h-3.5 w-3.5" />
          {t('erd.codeEditor.applyButton')}
        </Button>
      </div>

      {/* 교체 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('erd.codeEditor.confirmTitle')}
        description={t('erd.codeEditor.confirmDescription')}
        onConfirm={executeApply}
      />
    </div>
  );
}
