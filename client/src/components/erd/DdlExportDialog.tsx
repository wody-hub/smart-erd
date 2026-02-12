import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
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
import { generateDdl } from '@/lib/ddl-generator';
import type { DbmsType, ERDEdge, TableNode } from '@/types/erd';

/** DdlExportDialog 컴포넌트의 props. */
interface DdlExportDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 열림 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 파일 다운로드 시 사용할 다이어그램 이름 */
  diagramName: string;
}

/**
 * SQL DDL 내보내기 다이얼로그.
 *
 * DBMS를 선택하면 Monaco Editor에서 DDL을 미리 볼 수 있으며,
 * 클립보드 복사 및 파일 다운로드 기능을 제공한다.
 *
 * @param props.open         다이얼로그 열림 상태
 * @param props.onOpenChange 다이얼로그 열림 상태 변경 핸들러
 * @param props.diagramName  파일 다운로드 시 사용할 다이어그램 이름
 */
export default function DdlExportDialog({ open, onOpenChange, diagramName }: DdlExportDialogProps) {
  const { t } = useTranslation();

  /** 선택된 DBMS 타입 */
  const [dbms, setDbms] = useState<DbmsType>('postgresql');
  const isDark = useDarkMode();

  const nodes = useCanvasStore((s) => s.nodes) as TableNode[];
  const edges = useCanvasStore((s) => s.edges) as ERDEdge[];

  const ddl = generateDdl(nodes, edges, dbms);

  /** 클립보드에 DDL을 복사한다. */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ddl);
      toast.success(t('erd.ddlExport.copied'));
    } catch {
      toast.error(t('erd.ddlExport.copyFailed'));
    }
  };

  /** DDL을 .sql 파일로 다운로드한다. */
  const handleDownload = () => {
    const blob = new Blob([ddl], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagramName}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasNoTables = nodes.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('erd.ddlExport.title')}</DialogTitle>
          <DialogDescription>{t('erd.ddlExport.title')}</DialogDescription>
        </DialogHeader>

        {hasNoTables ? (
          <p className="text-sm text-muted-foreground py-4">{t('erd.ddlExport.noTables')}</p>
        ) : (
          <>
            {/* DBMS selector */}
            <div className="space-y-1">
              <Label>{t('erd.ddlExport.dbmsLabel')}</Label>
              <Select value={dbms} onValueChange={(v) => setDbms(v as DbmsType)}>
                <SelectTrigger className="w-[200px]" aria-label={t('erd.ddlExport.dbmsLabel')}>
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

            {/* Preview label */}
            <Label className="mt-2">{t('erd.ddlExport.preview')}</Label>

            {/* Monaco editor */}
            <div className="flex-1 min-h-[300px] border border-border rounded-md overflow-hidden">
              <Editor
                height="300px"
                language="sql"
                value={ddl}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                }}
                theme={isDark ? 'vs-dark' : 'vs'}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                {t('erd.ddlExport.copy')}
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                {t('erd.ddlExport.download')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
