import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import useCanvasStore from '@/stores/useCanvasStore';
import { parseDdl, type DdlParseResult } from '@/lib/ddl-parser';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { DbmsType } from '@/types/erd';

/** DdlImportDialog 컴포넌트의 props */
interface DdlImportDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
}

/**
 * SQL DDL 가져오기 다이얼로그.
 *
 * Monaco Editor에 DDL을 붙여넣기/직접 입력하면 실시간으로 파싱 결과를 미리보기한다.
 * Import 버튼을 클릭하면 파싱된 테이블/FK 관계가 ERD에 추가된다.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 */
export default function DdlImportDialog({ open, onOpenChange }: DdlImportDialogProps) {
  const { t } = useTranslation();
  const importDdl = useCanvasStore((s) => s.importDdl);

  /** 선택된 DBMS 타입 */
  const [dbms, setDbms] = useState<DbmsType>('postgresql');
  /** DDL 텍스트 */
  const [ddlText, setDdlText] = useState('');
  /** 파싱 결과 */
  const [parseResult, setParseResult] = useState<DdlParseResult | null>(null);
  /** 파싱 중 여부 */
  const [parsing, setParsing] = useState(false);

  /** 디바운스 타이머 ref (C-1 해결: 기존 useRef+setTimeout 패턴 사용) */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 최신 파싱 요청 시퀀스. 닫기/재파싱 시 이전 응답 무효화에 사용 */
  const parseSeqRef = useRef(0);

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      parseSeqRef.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * DDL 텍스트 변경 시 디바운스 파싱을 수행한다.
   *
   * @param text 새 DDL 텍스트
   * @param targetDbms 대상 DBMS
   */
  const debouncedParse = (text: string, targetDbms: DbmsType) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const seq = ++parseSeqRef.current;

    if (!text.trim()) {
      setParseResult(null);
      setParsing(false);
      return;
    }

    setParsing(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await parseDdl(text, targetDbms);
        if (seq !== parseSeqRef.current) return;
        setParseResult(result);
      } catch (err) {
        if (seq !== parseSeqRef.current) return;
        const msg = err instanceof Error ? err.message : 'Failed to parse DDL';
        setParseResult({ tables: [], relations: [], errors: [msg] });
      } finally {
        if (seq !== parseSeqRef.current) return;
        setParsing(false);
      }
    }, 500);
  };

  /** DDL 텍스트 변경 핸들러. @param value 새 DDL 텍스트 */
  const handleDdlChange = (value: string | undefined) => {
    const text = value ?? '';
    setDdlText(text);
    debouncedParse(text, dbms);
  };

  /**
   * DBMS 변경 핸들러.
   *
   * @param newDbms 새 DBMS 타입
   */
  const handleDbmsChange = (newDbms: DbmsType) => {
    setDbms(newDbms);
    if (ddlText.trim()) {
      debouncedParse(ddlText, newDbms);
    }
  };

  /** Import 실행 핸들러 */
  const handleImport = () => {
    if (!parseResult || parseResult.tables.length === 0) return;

    try {
      importDdl(parseResult);
      toast.success(t('erd.ddlImport.success', { count: parseResult.tables.length }));
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('erd.ddlImport.failed');
      toast.error(msg);
    }
  };

  /** 다이얼로그 닫기 + 상태 초기화 */
  const handleClose = () => {
    parseSeqRef.current += 1;
    onOpenChange(false);
    setDdlText('');
    setParseResult(null);
    setParsing(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  /** Import 버튼 활성화 여부 */
  const canImport = parseResult != null && parseResult.tables.length > 0 && !parsing;

  /** 다크 모드 감지 (반응형) */
  const isDark = useDarkMode();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('erd.ddlImport.title')}</DialogTitle>
          <DialogDescription>{t('erd.ddlImport.description')}</DialogDescription>
        </DialogHeader>

        {/* DBMS 선택 */}
        <div className="space-y-1">
          <Label>{t('erd.ddlImport.dbmsLabel')}</Label>
          <Select value={dbms} onValueChange={(v) => handleDbmsChange(v as DbmsType)}>
            <SelectTrigger className="w-[200px]" aria-label={t('erd.ddlImport.dbmsLabel')}>
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
        <div className="flex-1 min-h-[300px] border border-border rounded-md overflow-hidden">
          <Editor
            height="300px"
            language="sql"
            value={ddlText}
            onChange={handleDdlChange}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
            }}
            theme={isDark ? 'vs-dark' : 'vs'}
          />
        </div>

        {/* 파싱 결과 프리뷰 */}
        <div className="flex items-center gap-3 text-sm min-h-[24px]">
          {parsing && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('erd.ddlImport.parsing')}
            </span>
          )}

          {!parsing && parseResult && (
            <>
              {parseResult.tables.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('erd.ddlImport.preview', {
                    tables: parseResult.tables.length,
                    relations: parseResult.relations.length,
                  })}
                </span>
              )}

              {parseResult.errors.length > 0 && parseResult.tables.length > 0 && (
                <span className="flex items-center gap-1 text-erd-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('erd.ddlImport.warnings', { count: parseResult.errors.length })}
                </span>
              )}

              {parseResult.tables.length === 0 && parseResult.errors.length > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  {t('erd.ddlImport.parseError')}
                </span>
              )}
            </>
          )}
        </div>

        {!parsing && parseResult && parseResult.errors.length > 0 && (
          <div className="border border-border rounded-md bg-muted/30 px-3 py-2 text-xs space-y-1 max-h-28 overflow-auto">
            <div className="font-medium">{t('erd.ddlImport.errorDetails')}</div>
            {parseResult.errors.slice(0, 5).map((error, i) => (
              <div key={i} className="font-mono text-muted-foreground break-words">
                {i + 1}. {error}
              </div>
            ))}
            {parseResult.errors.length > 5 && (
              <div className="text-muted-foreground">
                {t('erd.ddlImport.moreErrors', { count: parseResult.errors.length - 5 })}
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={handleClose}>
            {t('common.button.cancel')}
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            <Upload className="h-4 w-4 mr-2" />
            {t('erd.ddlImport.import')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
