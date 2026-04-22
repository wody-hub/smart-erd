import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchDiagrams } from '@/api/diagramApi';
import { fetchDictionarySets } from '@/api/dictionarySetApi';
import DocumentHubRow from '@/components/workspace/DocumentHubRow';
import DocumentTypeBadge from '@/components/workspace/DocumentTypeBadge';
import CreateDocumentDialog from '@/components/workspace/CreateDocumentDialog';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useDiagramDocumentHubActions } from '@/hooks/useDiagramDocumentHubActions';
import type { DocumentListItem } from '@/types/workspace';

/** 문서 허브 탭 콘텐츠 props. */
interface DocumentHubTabContentProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 권한 여부 */
  canEdit: boolean;
  /** 생성 다이얼로그 열림 상태 */
  createDialogOpen: boolean;
  /** 생성 다이얼로그 열림 상태 변경 콜백 */
  onCreateDialogOpenChange: (open: boolean) => void;
  /** 문서 개수 변경 콜백 */
  onDocumentCountChange?: (count: number) => void;
}

/**
 * DiagramsPage의 문서 허브 콘텐츠를 탭 전용 컴포넌트로 렌더링한다.
 *
 * @param props 문서 허브 탭 콘텐츠 props
 * @returns 문서 허브 탭 JSX
 */
export default function DocumentHubTabContent({
  teamId,
  projectId,
  canEdit,
  createDialogOpen,
  onCreateDialogOpenChange,
  onDocumentCountChange,
}: DocumentHubTabContentProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { data: dictionarySets = [] } = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId),
    queryFn: () => fetchDictionarySets(teamId),
    enabled: Boolean(teamId),
  });

  const diagramsQuery = useQuery({
    queryKey: queryKeys.diagrams.byProject(teamId, projectId),
    queryFn: () => fetchDiagrams(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });
  const { data: diagrams = [], isLoading, isError } = diagramsQuery;

  const {
    deleteTarget,
    setDeleteTarget,
    renamingId,
    renameValue,
    setRenameValue,
    startRename,
    confirmRename,
    cancelRename,
    createDocument,
    confirmDeleteDocument,
    updateDictionaryContext,
    deleteDocumentPending,
  } = useDiagramDocumentHubActions({
    teamId,
    projectId,
  });

  const documentItems = useMemo<DocumentListItem[]>(
    () =>
      diagrams.map((diagram) => ({
        id: diagram.id,
        name: diagram.name,
        type: diagram.pluginId,
        updatedAt: diagram.updatedAt,
        dictionaryContextName: diagram.pluginId === 'erd' ? diagram.dictionarySetName : null,
        templateLabel: diagram.templateLabel,
        summaryText: diagram.summaryText,
      })),
    [diagrams],
  );

  useEffect(() => {
    onDocumentCountChange?.(diagrams.length);
  }, [diagrams.length, onDocumentCountChange]);

  return (
    <>
      <div className="surface-operational mt-6 rounded-xl px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <DocumentTypeBadge documentType="erd" />
            <DocumentTypeBadge documentType="markdown" />
            <DocumentTypeBadge documentType="screen-spec" />
            <p className="text-sm text-ink-secondary">{t('workspace.documents.typeScopeHint')}</p>
          </div>
          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {t('workspace.documents.documentCount', { count: diagrams.length })}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Spinner text={t('common.loading')} />
      ) : isError ? (
        <div className="mt-6">
          <WorkspaceEmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title={t('workspace.status.loadFailedTitle')}
            description={t('workspace.status.documentsLoadFailed')}
            tone="error"
            role="alert"
            action={
              <Button variant="outline" onClick={() => void diagramsQuery.refetch()}>
                {t('workspace.status.retry')}
              </Button>
            }
          />
        </div>
      ) : diagrams.length === 0 ? (
        <div className="mt-6">
          <WorkspaceEmptyState
            icon={<FileText className="h-10 w-10" />}
            title={t('workspace.documents.title')}
            description={t('workspace.documents.empty')}
            action={
              canEdit ? (
                <Button onClick={() => onCreateDialogOpenChange(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('workspace.action.newDocument')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {diagrams.map((diagram, index) => (
            <DocumentHubRow
              key={diagram.id}
              item={documentItems[index]!}
              locale={i18n.resolvedLanguage ?? i18n.language}
              onOpen={() => navigate(ROUTES.DIAGRAM(teamId, projectId, diagram.id))}
              canEdit={canEdit}
              contextControl={
                canEdit && diagram.pluginId === 'erd' && dictionarySets.length > 0 ? (
                  <div onClick={(event) => event.stopPropagation()}>
                    <Select
                      value={diagram.dictionarySetId != null ? String(diagram.dictionarySetId) : ''}
                      onValueChange={(value) => updateDictionaryContext(diagram.id, Number(value))}
                    >
                      <SelectTrigger className="h-9 min-w-[220px]">
                        <SelectValue placeholder={t('diagram.list.selectDictionaryContext')} />
                      </SelectTrigger>
                      <SelectContent>
                        {dictionarySets.map((set) => (
                          <SelectItem key={set.id} value={String(set.id)}>
                            {set.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : undefined
              }
              renameState={
                renamingId === diagram.id
                  ? {
                      value: renameValue,
                      onValueChange: setRenameValue,
                      onConfirm: confirmRename,
                      onCancel: cancelRename,
                    }
                  : undefined
              }
              onStartRename={canEdit ? () => startRename(diagram) : undefined}
              onDelete={canEdit ? () => setDeleteTarget(diagram.id) : undefined}
            />
          ))}
        </div>
      )}

      <CreateDocumentDialog
        open={createDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
        dictionarySets={dictionarySets}
        onCreate={createDocument}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={t('workspace.action.deleteErdDocumentTitle')}
        description={t('workspace.action.deleteErdDocumentDescription')}
        onConfirm={confirmDeleteDocument}
        loading={deleteDocumentPending}
      />
    </>
  );
}
