import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchWbsLinkedDocuments, linkWbsDocument, unlinkWbsDocument } from '@/api/wbsApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import DocumentHubRow from '@/components/workspace/DocumentHubRow';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import type { DiagramSummary } from '@/types/diagram';
import type { WorkspaceDocumentType } from '@/types/workspace';
import type { WbsItem } from '@/types/wbs';
import WbsDocumentLinkDialog from './WbsDocumentLinkDialog';

interface WbsDetailPanelProps {
  teamId: string;
  projectId: string;
  canEdit: boolean;
  locale: string;
  item: WbsItem | null;
  allDocuments: DiagramSummary[];
}

function toDocumentType(pluginId: string): WorkspaceDocumentType {
  if (pluginId === 'erd' || pluginId === 'screen-spec') {
    return pluginId;
  }
  return 'markdown';
}

/**
 * 선택된 WBS 항목의 문서 연결 상세 패널.
 *
 * @param props panel props
 * @returns detail panel JSX
 */
export default function WbsDetailPanel({
  teamId,
  projectId,
  canEdit,
  locale,
  item,
  allDocuments,
}: WbsDetailPanelProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const linkedDocumentsQuery = useQuery({
    queryKey: queryKeys.wbs.linkedDocuments(teamId, projectId, item?.id ?? null),
    queryFn: () => fetchWbsLinkedDocuments(teamId, projectId, item!.id),
    enabled: item != null,
  });

  const linkedDocumentIds = useMemo(
    () => new Set((linkedDocumentsQuery.data ?? []).map((document) => document.id)),
    [linkedDocumentsQuery.data],
  );

  const linkableDocuments = useMemo(
    () => allDocuments.filter((document) => !linkedDocumentIds.has(document.id)),
    [allDocuments, linkedDocumentIds],
  );

  const linkMutation = useMutation({
    mutationFn: async (documentId: number) => {
      if (!item) {
        return;
      }
      await linkWbsDocument(teamId, projectId, item.id, documentId);
    },
    onSuccess: () => {
      setLinkDialogOpen(false);
      void linkedDocumentsQuery.refetch();
      toast.success(t('wbs.details.toast.linked'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('wbs.details.toast.linkFailed'))),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (documentId: number) => {
      if (!item) {
        return;
      }
      await unlinkWbsDocument(teamId, projectId, item.id, documentId);
    },
    onSuccess: () => {
      void linkedDocumentsQuery.refetch();
      toast.success(t('wbs.details.toast.unlinked'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('wbs.details.toast.unlinkFailed'))),
  });

  if (!item) {
    return (
      <Card className="min-h-[420px]">
        <CardHeader>
          <CardTitle>{t('wbs.details.title')}</CardTitle>
          <CardDescription>{t('wbs.details.empty.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState
            icon={<Link2 className="h-10 w-10" />}
            title={t('wbs.details.empty.title')}
            description={t('wbs.details.empty.description')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="min-h-[420px]">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-xl">{item.name}</CardTitle>
              <CardDescription>{t('wbs.details.description')}</CardDescription>
            </div>
            <Badge variant="outline">{t('wbs.details.level', { level: item.depth + 1 })}</Badge>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {t('wbs.field.progressRate')}: {item.progressRate}%
            </span>
            <span>
              {t('wbs.field.estimatedMm')}: {item.estimatedMm ?? '-'}
            </span>
            <span>
              {t('wbs.field.milestone')}: {item.milestoneName ?? t('wbs.field.noMilestone')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('wbs.details.linkedDocuments')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('wbs.details.linkedDocumentsHint')}
              </p>
            </div>
            {canEdit ? (
              <Button
                variant="outline"
                onClick={() => setLinkDialogOpen(true)}
                disabled={linkMutation.isPending || linkableDocuments.length === 0}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {t('wbs.details.linkAction')}
              </Button>
            ) : null}
          </div>

          {linkedDocumentsQuery.isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : linkedDocumentsQuery.isError ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('wbs.details.status.loadFailedTitle')}
              description={t('wbs.details.status.loadFailedDescription')}
              tone="error"
              action={
                <Button variant="outline" onClick={() => void linkedDocumentsQuery.refetch()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          ) : (linkedDocumentsQuery.data?.length ?? 0) === 0 ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('wbs.details.noLinkedDocuments.title')}
              description={t('wbs.details.noLinkedDocuments.description')}
              action={
                canEdit && linkableDocuments.length > 0 ? (
                  <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
                    {t('wbs.details.linkAction')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {linkedDocumentsQuery.data!.map((document) => (
                <DocumentHubRow
                  key={document.id}
                  locale={locale}
                  item={{
                    id: document.id,
                    name: document.name,
                    type: toDocumentType(document.pluginId),
                    updatedAt: document.updatedAt,
                    templateLabel: document.templateLabel,
                    summaryText: document.summaryText,
                  }}
                  onOpen={() => navigate(ROUTES.DIAGRAM(teamId, projectId, document.id))}
                  canEdit={canEdit}
                  contextControl={
                    <div className="flex flex-wrap gap-1">
                      {document.linkedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {t('wbs.details.linkedAt', {
                            date: new Date(document.linkedAt).toLocaleDateString(locale),
                          })}
                        </span>
                      ) : null}
                      {document.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  }
                  onDelete={
                    canEdit
                      ? () => {
                          unlinkMutation.mutate(document.id);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(ROUTES.PROJECT_WBS(teamId, projectId))}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('wbs.workspace.open')}
            </Button>
            {canEdit ? (
              <Button variant="ghost" onClick={() => navigate(ROUTES.DIAGRAMS(teamId, projectId))}>
                {t('wbs.details.openDocumentsHub')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <WbsDocumentLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        documents={linkableDocuments}
        loading={linkMutation.isPending}
        onConfirm={async (documentId) => {
          await linkMutation.mutateAsync(documentId);
        }}
      />
    </>
  );
}
