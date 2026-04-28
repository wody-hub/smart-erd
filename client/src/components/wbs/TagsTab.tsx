import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchProjectDocumentTags, fetchTaggedDocuments } from '@/api/wbsApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import DocumentHubRow from '@/components/workspace/DocumentHubRow';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import type { WorkspaceDocumentType } from '@/types/workspace';

interface TagsTabProps {
  teamId: string;
  projectId: string;
  canEdit: boolean;
}

function toDocumentType(pluginId: string): WorkspaceDocumentType {
  if (pluginId === 'erd' || pluginId === 'screen-spec') {
    return pluginId;
  }
  return 'markdown';
}

/**
 * 프로젝트 허브의 태그 중심 문서 탐색 탭.
 *
 * @param props tags tab props
 * @returns tags tab JSX
 */
export default function TagsTab({ teamId, projectId, canEdit }: TagsTabProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const tagsQuery = useQuery({
    queryKey: queryKeys.wbs.tags(teamId, projectId),
    queryFn: () => fetchProjectDocumentTags(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  useEffect(() => {
    if (selectedTag != null) {
      return;
    }
    const firstTag = tagsQuery.data?.[0]?.tag ?? null;
    if (firstTag != null) {
      setSelectedTag(firstTag);
    }
  }, [selectedTag, tagsQuery.data]);

  const selectedTagSummary = useMemo(
    () => tagsQuery.data?.find((tag) => tag.tag === selectedTag) ?? null,
    [selectedTag, tagsQuery.data],
  );

  const taggedDocumentsQuery = useQuery({
    queryKey: queryKeys.wbs.tagDocuments(teamId, projectId, selectedTag),
    queryFn: () => fetchTaggedDocuments(teamId, projectId, selectedTag!),
    enabled: selectedTag != null,
  });

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{t('workspace.tags.title')}</CardTitle>
          <CardDescription>{t('workspace.tags.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {tagsQuery.isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : tagsQuery.isError ? (
            <WorkspaceEmptyState
              icon={<Hash className="h-10 w-10" />}
              title={t('workspace.tags.status.loadFailedTitle')}
              description={t('workspace.tags.status.loadFailedDescription')}
              tone="error"
              action={
                <Button variant="outline" onClick={() => void tagsQuery.refetch()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          ) : (tagsQuery.data?.length ?? 0) === 0 ? (
            <WorkspaceEmptyState
              icon={<Hash className="h-10 w-10" />}
              title={t('workspace.tags.empty.title')}
              description={t('workspace.tags.empty.description')}
            />
          ) : (
            <div className="space-y-2">
              {tagsQuery.data!.map((tag) => {
                const active = tag.tag === selectedTag;
                return (
                  <button
                    key={tag.tag}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-primary/30 bg-primary/5 text-foreground'
                        : 'border-border/80 bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
                    }`}
                    onClick={() => setSelectedTag(tag.tag)}
                  >
                    <span className="min-w-0 truncate font-medium">#{tag.tag}</span>
                    <Badge variant={active ? 'default' : 'outline'}>
                      {t('workspace.tags.documentCount', { count: tag.documentCount })}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedTagSummary
              ? t('workspace.tags.documentsTitle', { tag: selectedTagSummary.tag })
              : t('workspace.tags.documentsFallbackTitle')}
          </CardTitle>
          <CardDescription>{t('workspace.tags.documentsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTag == null ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('workspace.tags.selectPrompt.title')}
              description={t('workspace.tags.selectPrompt.description')}
            />
          ) : taggedDocumentsQuery.isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : taggedDocumentsQuery.isError ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('workspace.tags.status.documentsLoadFailedTitle')}
              description={t('workspace.tags.status.documentsLoadFailedDescription')}
              tone="error"
              action={
                <Button variant="outline" onClick={() => void taggedDocumentsQuery.refetch()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          ) : (taggedDocumentsQuery.data?.length ?? 0) === 0 ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('workspace.tags.noDocuments.title')}
              description={t('workspace.tags.noDocuments.description')}
            />
          ) : (
            <div className="space-y-3">
              {taggedDocumentsQuery.data!.map((document) => (
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
                    document.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {document.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
