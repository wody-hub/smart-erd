import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, ExternalLink, Link2, MessageSquare, Send, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createWbsComment,
  fetchWbsActivities,
  fetchWbsComments,
  fetchWbsLinkedDocuments,
  linkWbsDocument,
  unlinkWbsDocument,
} from '@/api/wbsApi';
import { fetchSharedTodoSummaries } from '@/api/projectTodoApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import DocumentHubRow from '@/components/workspace/DocumentHubRow';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import type { SharedTodoSummary } from '@/types/project-todo';
import type { WbsActivity, WbsActivityEventType } from '@/types/wbs';
import type { DiagramSummary } from '@/types/diagram';
import type { WorkspaceDocumentType } from '@/types/workspace';
import type { WbsItem } from '@/types/wbs';
import WbsDocumentLinkDialog from './WbsDocumentLinkDialog';

const WBS_COMMENT_MAX_LENGTH = 4000;

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

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getActivityTone(eventType: WbsActivityEventType): 'default' | 'secondary' | 'outline' {
  if (eventType === 'DOCUMENT_LINKED') {
    return 'default';
  }
  if (eventType === 'DOCUMENT_UNLINKED') {
    return 'secondary';
  }
  return 'outline';
}

function getActivityCategory(eventType: WbsActivityEventType): 'document' | 'status' {
  return eventType === 'ISSUE_STATUS_CHANGED' ? 'status' : 'document';
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
  const queryClient = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');
  const [commentDraft, setCommentDraft] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'document' | 'status'>('all');

  const linkedDocumentsQuery = useQuery({
    queryKey: queryKeys.wbs.linkedDocuments(teamId, projectId, item?.id ?? null),
    queryFn: () => fetchWbsLinkedDocuments(teamId, projectId, item!.id),
    enabled: item != null,
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.wbs.comments(teamId, projectId, item?.id ?? null),
    queryFn: () => fetchWbsComments(teamId, projectId, item!.id),
    enabled: item != null,
  });

  const activitiesQuery = useQuery({
    queryKey: queryKeys.wbs.activities(teamId, projectId, item?.id ?? null),
    queryFn: () => fetchWbsActivities(teamId, projectId, item!.id),
    enabled: item != null,
  });

  const sharedTodosQuery = useQuery({
    queryKey: queryKeys.wbs.sharedTodos(teamId, projectId, item?.id ?? null),
    queryFn: () => fetchSharedTodoSummaries(teamId, projectId, item!.id),
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

  const filteredActivities = useMemo(() => {
    const activities = activitiesQuery.data ?? [];
    if (activityFilter === 'all') {
      return activities;
    }
    return activities.filter(
      (activity) => getActivityCategory(activity.eventType) === activityFilter,
    );
  }, [activitiesQuery.data, activityFilter]);

  const linkMutation = useMutation({
    mutationFn: async (documentId: number) => {
      if (!item) {
        return;
      }
      await linkWbsDocument(teamId, projectId, item.id, documentId);
    },
    onSuccess: () => {
      setLinkDialogOpen(false);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.wbs.linkedDocuments(teamId, projectId, item?.id ?? null),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.wbs.activities(teamId, projectId, item?.id ?? null),
        }),
      ]);
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
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.wbs.linkedDocuments(teamId, projectId, item?.id ?? null),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.wbs.activities(teamId, projectId, item?.id ?? null),
        }),
      ]);
      toast.success(t('wbs.details.toast.unlinked'));
    },
    onError: (error) => toast.error(getErrorMessage(error, t('wbs.details.toast.unlinkFailed'))),
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!item) {
        return;
      }
      await createWbsComment(teamId, projectId, item.id, { content });
    },
    onSuccess: () => {
      setCommentDraft('');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wbs.comments(teamId, projectId, item?.id ?? null),
      });
      toast.success(t('wbs.details.toast.commentCreated'));
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, t('wbs.details.toast.commentCreateFailed'))),
  });

  const activityCounts = useMemo(() => {
    const activities = activitiesQuery.data ?? [];
    return {
      all: activities.length,
      document: activities.filter(
        (activity) => getActivityCategory(activity.eventType) === 'document',
      ).length,
      status: activities.filter((activity) => getActivityCategory(activity.eventType) === 'status')
        .length,
    };
  }, [activitiesQuery.data]);

  const commentCount = commentsQuery.data?.length ?? 0;
  const activityCount = activitiesQuery.data?.length ?? 0;
  const sharedTodoCount = sharedTodosQuery.data?.length ?? 0;
  const isCommentSubmitDisabled =
    createCommentMutation.isPending || commentDraft.trim().length === 0;

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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="documents">
                {t('wbs.details.tabs.documents', {
                  count: linkedDocumentsQuery.data?.length ?? 0,
                })}
              </TabsTrigger>
              <TabsTrigger value="comments">
                {t('wbs.details.tabs.comments', { count: commentCount })}
              </TabsTrigger>
              <TabsTrigger value="activities">
                {t('wbs.details.tabs.activities', { count: activityCount })}
              </TabsTrigger>
              <TabsTrigger value="todos">
                {t('wbs.details.tabs.todos', { count: sharedTodoCount })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4 pt-4">
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
            </TabsContent>

            <TabsContent value="comments" className="space-y-4 pt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t('wbs.details.comments.title')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('wbs.details.comments.description')}
                </p>
              </div>

              {canEdit ? (
                <form
                  className="space-y-3 rounded-xl border border-border/80 bg-secondary/15 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const content = commentDraft.trim();
                    if (!content) {
                      return;
                    }
                    createCommentMutation.mutate(content);
                  }}
                >
                  <Textarea
                    value={commentDraft}
                    maxLength={WBS_COMMENT_MAX_LENGTH}
                    placeholder={t('wbs.details.comments.placeholder')}
                    className="min-h-[108px] bg-background"
                    onChange={(event) => setCommentDraft(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t('wbs.details.comments.hint', {
                        current: commentDraft.trim().length,
                        max: WBS_COMMENT_MAX_LENGTH,
                      })}
                    </p>
                    <Button type="submit" disabled={isCommentSubmitDisabled}>
                      <Send className="mr-2 h-4 w-4" />
                      {t('wbs.details.comments.submit')}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
                  {t('wbs.details.comments.readOnly')}
                </div>
              )}

              {commentsQuery.isLoading ? (
                <Spinner text={t('common.loading')} />
              ) : commentsQuery.isError ? (
                <WorkspaceEmptyState
                  icon={<MessageSquare className="h-10 w-10" />}
                  title={t('wbs.details.comments.status.loadFailedTitle')}
                  description={t('wbs.details.comments.status.loadFailedDescription')}
                  tone="error"
                  action={
                    <Button variant="outline" onClick={() => void commentsQuery.refetch()}>
                      {t('workspace.status.retry')}
                    </Button>
                  }
                />
              ) : (commentsQuery.data?.length ?? 0) === 0 ? (
                <WorkspaceEmptyState
                  icon={<MessageSquare className="h-10 w-10" />}
                  title={t('wbs.details.comments.empty.title')}
                  description={t('wbs.details.comments.empty.description')}
                />
              ) : (
                <div className="space-y-3">
                  {commentsQuery.data!.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-xl border border-border/80 bg-card/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {comment.actorName ??
                              comment.actorLoginId ??
                              t('wbs.details.comments.unknownActor')}
                          </span>
                          {comment.actorLoginId ? (
                            <span className="text-xs text-muted-foreground">
                              @{comment.actorLoginId}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(comment.createdAt, locale)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="space-y-4 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('wbs.details.activities.title')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('wbs.details.activities.description')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'document', 'status'] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={activityFilter === filter ? 'default' : 'outline'}
                      onClick={() => setActivityFilter(filter)}
                    >
                      {t(`wbs.details.activities.filters.${filter}`, {
                        count: activityCounts[filter],
                      })}
                    </Button>
                  ))}
                </div>
              </div>

              {activitiesQuery.isLoading ? (
                <Spinner text={t('common.loading')} />
              ) : activitiesQuery.isError ? (
                <WorkspaceEmptyState
                  icon={<Workflow className="h-10 w-10" />}
                  title={t('wbs.details.activities.status.loadFailedTitle')}
                  description={t('wbs.details.activities.status.loadFailedDescription')}
                  tone="error"
                  action={
                    <Button variant="outline" onClick={() => void activitiesQuery.refetch()}>
                      {t('workspace.status.retry')}
                    </Button>
                  }
                />
              ) : (activitiesQuery.data?.length ?? 0) === 0 ? (
                <WorkspaceEmptyState
                  icon={<Workflow className="h-10 w-10" />}
                  title={t('wbs.details.activities.empty.title')}
                  description={t('wbs.details.activities.empty.description')}
                />
              ) : filteredActivities.length === 0 ? (
                <WorkspaceEmptyState
                  icon={<Clock3 className="h-10 w-10" />}
                  title={t('wbs.details.activities.empty.filteredTitle')}
                  description={t('wbs.details.activities.empty.filteredDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity: WbsActivity) => (
                    <div
                      key={activity.id}
                      className="rounded-xl border border-border/80 bg-card/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getActivityTone(activity.eventType)}>
                            {t(`wbs.details.activities.eventType.${activity.eventType}`)}
                          </Badge>
                          {activity.subjectLabel ? (
                            <span className="text-sm font-medium text-foreground">
                              {activity.subjectLabel}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(activity.occurredAt, locale)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-foreground">
                        {activity.detail ?? t('wbs.details.activities.defaultDetail')}
                      </p>

                      {activity.previousValue || activity.currentValue ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {activity.previousValue ? (
                            <Badge variant="outline">
                              {t('wbs.details.activities.previousValue', {
                                value: activity.previousValue,
                              })}
                            </Badge>
                          ) : null}
                          {activity.currentValue ? (
                            <Badge variant="outline">
                              {t('wbs.details.activities.currentValue', {
                                value: activity.currentValue,
                              })}
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 text-xs text-muted-foreground">
                        {t('wbs.details.activities.actorLine', {
                          actor:
                            activity.actorName ??
                            activity.actorLoginId ??
                            t('wbs.details.activities.unknownActor'),
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="todos" className="space-y-4 pt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t('wbs.details.todos.title')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('wbs.details.todos.description')}
                </p>
              </div>

              {sharedTodosQuery.isLoading ? (
                <Spinner text={t('common.loading')} />
              ) : sharedTodosQuery.isError ? (
                <WorkspaceEmptyState
                  icon={<Workflow className="h-10 w-10" />}
                  title={t('wbs.details.todos.status.loadFailedTitle')}
                  description={t('wbs.details.todos.status.loadFailedDescription')}
                  tone="error"
                  action={
                    <Button variant="outline" onClick={() => void sharedTodosQuery.refetch()}>
                      {t('workspace.status.retry')}
                    </Button>
                  }
                />
              ) : (sharedTodosQuery.data?.length ?? 0) === 0 ? (
                <WorkspaceEmptyState
                  icon={<Workflow className="h-10 w-10" />}
                  title={t('wbs.details.todos.empty.title')}
                  description={t('wbs.details.todos.empty.description')}
                />
              ) : (
                <div className="space-y-3">
                  {sharedTodosQuery.data!.map((todo: SharedTodoSummary) => (
                    <div
                      key={todo.id}
                      className="rounded-xl border border-border/80 bg-card/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">{todo.title}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {t(`myTasks.statusValue.${todo.status}`)}
                            </Badge>
                            <Badge variant="secondary">
                              {t(`myTasks.priorityValue.${todo.priority}`)}
                            </Badge>
                            <Badge variant="outline">
                              {t('wbs.details.todos.owner', { name: todo.ownerName })}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{todo.progressRate}%</p>
                          <p>
                            {todo.targetDate
                              ? t('wbs.details.todos.targetDate', { date: todo.targetDate })
                              : t('wbs.details.todos.noTargetDate')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {t('wbs.details.todos.sharedDocuments', {
                            count: todo.sharedDocuments.length,
                          })}
                        </p>
                        {todo.sharedDocuments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t('wbs.details.todos.noSharedDocuments')}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {todo.sharedDocuments.map((document) => (
                              <Badge key={`${todo.id}-${document.id}`} variant="outline">
                                {document.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

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
