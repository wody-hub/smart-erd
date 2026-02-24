import { lazy, Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, CircleHelp } from 'lucide-react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDdlParse } from '@/hooks/useDdlParse';
import { useApplyToErd } from '@/hooks/useApplyToErd';
import { useCodeEditorRefresh } from '@/hooks/useCodeEditorRefresh';
import { DSL_TABLE_KEYWORD, DSL_COLUMN_OPTIONS } from '@/lib/dsl-keywords';
import { cn } from '@/lib/utils';
import { generateDdl } from '@/lib/ddl-generator';
import CodeEditorFooter from './CodeEditorFooter';
import type { DbmsType, TableNode, ERDEdge } from '@/types/erd';

/** DSL 패널 lazy import (Monaco 번들 분리) */
const DslCodeEditorPanel = lazy(() => import('./DslCodeEditorPanel'));

/** 코드 에디터 모드 */
type EditorMode = 'sql' | 'dsl';
const [OPT_PK, OPT_AI, OPT_NN] = DSL_COLUMN_OPTIONS;

/** DdlCodeEditorPanel 컴포넌트의 props */
interface DdlCodeEditorPanelProps {
  /** 편집 가능 여부 (VIEWER일 때 false) */
  canEdit?: boolean;
}

/**
 * 코드 에디터 패널 (SQL DDL / 논리명 DSL 탭 전환).
 *
 * 좌측 사이드바 대체 패널로 SQL DDL 또는 논리명 DSL을 입력하면
 * 실시간 파싱 프리뷰를 표시하고, Apply 버튼으로 ERD에 반영한다.
 *
 * @param props.canEdit 편집 가능 여부
 */
export default function DdlCodeEditorPanel({ canEdit = true }: DdlCodeEditorPanelProps) {
  const { t } = useTranslation();

  /** 에디터 모드 (기본값: DSL) */
  const [mode, setMode] = useState<EditorMode>('dsl');

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* 모드 탭 */}
      <div className="flex items-center border-b border-border shrink-0">
        <div className="flex flex-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sql'}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'sql'
                ? 'bg-background text-foreground border-b-2 border-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('sql')}
          >
            SQL DDL
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'dsl'}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'dsl'
                ? 'bg-background text-foreground border-b-2 border-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('dsl')}
          >
            {t('erd.dsl.tabLabel')}
          </button>
        </div>
        {mode === 'dsl' && (
          <div className="px-2">
            <DslSyntaxGuideDialog />
          </div>
        )}
      </div>

      {/* 모드별 에디터 */}
      <div className="flex-1 min-h-0" role="tabpanel">
        {mode === 'sql' ? (
          <SqlDdlEditor canEdit={canEdit} />
        ) : (
          <Suspense fallback={<Spinner text={t('common.loading')} />}>
            <DslCodeEditorPanel canEdit={canEdit} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

/** DSL 문법 가이드 레이어 팝업 */
function DslSyntaxGuideDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t('erd.dsl.syntaxGuide.ariaOpen')}
        >
          <CircleHelp className="h-3.5 w-3.5" />
          {t('erd.dsl.syntaxGuide.openButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0">
        <div className="border-b border-border px-6 py-4 pr-10">
          <DialogTitle className="text-base">{t('erd.dsl.syntaxGuide.title')}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {t('erd.dsl.syntaxGuide.description')}
          </DialogDescription>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.structureTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {t('erd.dsl.syntaxGuide.structureRule1', {
                  tableKeyword: DSL_TABLE_KEYWORD,
                })}
              </li>
              <li>{t('erd.dsl.syntaxGuide.structureRule2')}</li>
              <li>{t('erd.dsl.syntaxGuide.structureRule3')}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.columnTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {t('erd.dsl.syntaxGuide.columnRule1', {
                  pk: OPT_PK,
                  ai: OPT_AI,
                  nn: OPT_NN,
                })}
              </li>
              <li>{t('erd.dsl.syntaxGuide.columnRule2')}</li>
              <li>{t('erd.dsl.syntaxGuide.columnRule3')}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.examplesTitle')}</h3>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('erd.dsl.syntaxGuide.exampleBasicLabel')}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-xs leading-relaxed">
                  <code>
                    {t('erd.dsl.syntaxGuide.exampleBasicCode', {
                      tableKeyword: DSL_TABLE_KEYWORD,
                      pk: OPT_PK,
                      ai: OPT_AI,
                      nn: OPT_NN,
                    })}
                  </code>
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('erd.dsl.syntaxGuide.exampleRelationLabel')}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-xs leading-relaxed">
                  <code>
                    {t('erd.dsl.syntaxGuide.exampleRelationCode', {
                      tableKeyword: DSL_TABLE_KEYWORD,
                      pk: OPT_PK,
                      ai: OPT_AI,
                      nn: OPT_NN,
                    })}
                  </code>
                </pre>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">{t('erd.dsl.syntaxGuide.invalidTitle')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t('erd.dsl.syntaxGuide.invalidRule1')}</li>
              <li>{t('erd.dsl.syntaxGuide.invalidRule2')}</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** SQL DDL 에디터 (기존 로직) */
function SqlDdlEditor({ canEdit = true }: { canEdit?: boolean }) {
  const { t } = useTranslation();

  const { dbms, ddlText, parseResult, parsing, handleDdlChange, handleDbmsChange } = useDdlParse({
    persistDbms: true,
  });

  const { handleApply, executeApply, confirmOpen, setConfirmOpen, canApply } = useApplyToErd({
    canEdit,
    parseResult,
    parsing,
  });

  /** ERD → SQL DDL 생성 함수 (useCodeEditorRefresh에 전달) */
  const generate = useCallback(
    (nodes: TableNode[], edges: ERDEdge[]) => generateDdl(nodes, edges, dbms),
    [dbms],
  );

  const { executeRefresh, handleRefresh, hasNodes, refreshConfirmOpen, setRefreshConfirmOpen } =
    useCodeEditorRefresh({
      generate,
      onGenerated: handleDdlChange,
      currentText: ddlText,
    });

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();
  /** Monaco 인스턴스 ref */
  const monacoRef = useRef<typeof Monaco | null>(null);
  /** 에디터 인스턴스 ref */
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  /** onMount — editorRef/monacoRef 저장 */
  const handleOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // diagnostics 변경 시 SQL 에러 마커 갱신 (라인 전체 마킹 정책)
  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const diagnostics = parseResult?.diagnostics ?? [];
    if (diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'sql-ddl', []);
    } else {
      const lineCount = model.getLineCount();
      const markers: Monaco.editor.IMarkerData[] = diagnostics.flatMap((diag) => {
        if (!diag.location) {
          return [];
        }

        const line = Math.min(Math.max(diag.location.line, 1), lineCount);
        const endColumn = Math.max(2, model.getLineMaxColumn(line));
        return [
          {
            severity:
              diag.severity === 'error'
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: t(diag.messageKey as any, diag.messageArgs),
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn,
          },
        ];
      });

      monaco.editor.setModelMarkers(model, 'sql-ddl', markers);
    }

    return () => {
      if (!model.isDisposed()) {
        monaco.editor.setModelMarkers(model, 'sql-ddl', []);
      }
    };
  }, [parseResult, t]);

  return (
    <div className="h-full flex flex-col">
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
          onMount={handleOnMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'gutter',
            quickSuggestions: false,
            wordBasedSuggestions: 'off',
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnCommitCharacter: false,
          }}
          theme={isDark ? 'vs-dark' : 'vs'}
        />
      </div>

      {/* 파싱 결과 프리뷰 + Apply/Refresh 버튼 */}
      <CodeEditorFooter
        onApply={handleApply}
        canApply={canApply}
        executeApply={executeApply}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        onRefresh={handleRefresh}
        executeRefresh={executeRefresh}
        hasNodes={hasNodes}
        refreshConfirmOpen={refreshConfirmOpen}
        setRefreshConfirmOpen={setRefreshConfirmOpen}
      >
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
      </CodeEditorFooter>
    </div>
  );
}
