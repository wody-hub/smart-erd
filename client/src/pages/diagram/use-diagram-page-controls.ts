import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
  downloadDiagramColumnDefinition,
  downloadDiagramIndexDefinition,
  downloadDiagramTableDefinition,
} from '@/api/diagramApi';

type UseDiagramPageControlsParams = {
  diagramId: string | undefined;
  projectId: string | undefined;
  t: TFunction;
  teamId: string | undefined;
};

type UseDiagramPageControlsResult = {
  columnDefinitionExporting: boolean;
  handleExportColumnDefinition: (content: string) => Promise<void>;
  handleExportIndexDefinition: (content: string) => Promise<void>;
  handleExportTableDefinition: (content: string) => Promise<void>;
  handleToggleCodeEditor: () => void;
  handleToggleValidation: () => void;
  indexDefinitionExporting: boolean;
  leftPanel: 'sidebar' | 'code';
  setLeftPanel: Dispatch<SetStateAction<'sidebar' | 'code'>>;
  setValidationOpen: Dispatch<SetStateAction<boolean>>;
  tableDefinitionExporting: boolean;
  validationOpen: boolean;
};

export function useDiagramPageControls({
  diagramId,
  projectId,
  t,
  teamId,
}: UseDiagramPageControlsParams): UseDiagramPageControlsResult {
  const [validationOpen, setValidationOpen] = useState(false);
  const [leftPanel, setLeftPanel] = useState<'sidebar' | 'code'>('sidebar');
  const [tableDefinitionExporting, setTableDefinitionExporting] = useState(false);
  const [columnDefinitionExporting, setColumnDefinitionExporting] = useState(false);
  const [indexDefinitionExporting, setIndexDefinitionExporting] = useState(false);

  const handleToggleValidation = useCallback(() => {
    setValidationOpen((prev) => !prev);
  }, []);

  const handleToggleCodeEditor = useCallback(() => {
    setLeftPanel((prev) => (prev === 'code' ? 'sidebar' : 'code'));
  }, []);

  const handleExportTableDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (tableDefinitionExporting || columnDefinitionExporting || indexDefinitionExporting) {
        return;
      }

      setTableDefinitionExporting(true);
      try {
        await downloadDiagramTableDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.tableDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.tableDefinitionExport.failed'));
      } finally {
        setTableDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  const handleExportColumnDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (columnDefinitionExporting || tableDefinitionExporting || indexDefinitionExporting) {
        return;
      }

      setColumnDefinitionExporting(true);
      try {
        await downloadDiagramColumnDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.columnDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.columnDefinitionExport.failed'));
      } finally {
        setColumnDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  const handleExportIndexDefinition = useCallback(
    async (content: string) => {
      if (!teamId || !projectId || !diagramId) {
        return;
      }
      if (indexDefinitionExporting || tableDefinitionExporting || columnDefinitionExporting) {
        return;
      }

      setIndexDefinitionExporting(true);
      try {
        await downloadDiagramIndexDefinition(teamId, projectId, diagramId, content);
        toast.success(t('erd.indexDefinitionExport.downloaded'));
      } catch {
        toast.error(t('erd.indexDefinitionExport.failed'));
      } finally {
        setIndexDefinitionExporting(false);
      }
    },
    [
      columnDefinitionExporting,
      diagramId,
      indexDefinitionExporting,
      projectId,
      t,
      tableDefinitionExporting,
      teamId,
    ],
  );

  return {
    columnDefinitionExporting,
    handleExportColumnDefinition,
    handleExportIndexDefinition,
    handleExportTableDefinition,
    handleToggleCodeEditor,
    handleToggleValidation,
    indexDefinitionExporting,
    leftPanel,
    setLeftPanel,
    setValidationOpen,
    tableDefinitionExporting,
    validationOpen,
  };
}
