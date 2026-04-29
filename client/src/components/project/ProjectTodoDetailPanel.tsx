import { Link2, Lock, Milestone, Save, Share2, Trash2, Unlink2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import DocumentTypeBadge from '@/components/workspace/DocumentTypeBadge';
import type {
  ProjectTodo,
  ProjectTodoPriority,
  ProjectTodoStatus,
  SharedTodoSummary,
  TodoDocument,
} from '@/types/project-todo';
import type { WbsItem } from '@/types/wbs';
import WbsHierarchySelect from './WbsHierarchySelect';
import type { TodoEditorValues } from './project-todo-editor';

function toDocumentType(pluginId: string): 'erd' | 'markdown' | 'screen-spec' {
  if (pluginId === 'erd' || pluginId === 'screen-spec') {
    return pluginId;
  }
  return 'markdown';
}

interface ProjectTodoDetailPanelProps {
  canManagePersonalTodos: boolean;
  isMutating: boolean;
  locale: string;
  selectedTodo: ProjectTodo | null;
  editorValues: TodoEditorValues;
  allWbsItems: WbsItem[];
  todoDocuments: TodoDocument[];
  linkableDocumentsCount: number;
  sharedTodos: SharedTodoSummary[];
  todoDocumentsLoading: boolean;
  todoDocumentsError: boolean;
  sharedTodosLoading: boolean;
  sharedTodosError: boolean;
  onEditorChange: (updater: (current: TodoEditorValues) => TodoEditorValues) => void;
  onDelete: (todo: ProjectTodo) => void;
  onSave: () => void;
  onLinkedWbsChange: (value: string) => void;
  onOpenDocumentDialog: () => void;
  onRetryDocuments: () => void;
  onDocumentVisibilityChange: (document: TodoDocument, visibility: string) => void;
  onDocumentUnlink: (documentId: number) => void;
}

export default function ProjectTodoDetailPanel({
  canManagePersonalTodos,
  isMutating,
  locale,
  selectedTodo,
  editorValues,
  allWbsItems,
  todoDocuments,
  linkableDocumentsCount,
  sharedTodos,
  todoDocumentsLoading,
  todoDocumentsError,
  sharedTodosLoading,
  sharedTodosError,
  onEditorChange,
  onDelete,
  onSave,
  onLinkedWbsChange,
  onOpenDocumentDialog,
  onRetryDocuments,
  onDocumentVisibilityChange,
  onDocumentUnlink,
}: ProjectTodoDetailPanelProps) {
  const { t } = useTranslation();
  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );

  if (!selectedTodo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('myTasks.detail.emptyTitle')}</CardTitle>
          <CardDescription>{t('myTasks.detail.emptyDescription')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>{selectedTodo.title}</CardTitle>
              <CardDescription>{t('myTasks.detail.description')}</CardDescription>
            </div>
            {canManagePersonalTodos ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(selectedTodo)}
                disabled={isMutating}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.button.delete')}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {t('myTasks.meta.updatedAt', { date: formatDateTime(selectedTodo.updatedAt) })}
            </span>
            <span>
              {selectedTodo.linkedWbsItemName
                ? t('myTasks.meta.linkedWbs', { name: selectedTodo.linkedWbsItemName })
                : t('myTasks.meta.privateOnly')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="todo-title">{t('myTasks.field.title')}</Label>
              <Input
                id="todo-title"
                value={editorValues.title}
                onChange={(event) =>
                  onEditorChange((current) => ({ ...current, title: event.target.value }))
                }
                disabled={!canManagePersonalTodos || isMutating}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="todo-description">{t('myTasks.field.description')}</Label>
              <Textarea
                id="todo-description"
                value={editorValues.description}
                onChange={(event) =>
                  onEditorChange((current) => ({ ...current, description: event.target.value }))
                }
                disabled={!canManagePersonalTodos || isMutating}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('myTasks.field.status')}</Label>
              <Select
                value={editorValues.status}
                onValueChange={(value) =>
                  onEditorChange((current) => ({ ...current, status: value as ProjectTodoStatus }))
                }
                disabled={!canManagePersonalTodos || isMutating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">{t('myTasks.statusValue.TODO')}</SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    {t('myTasks.statusValue.IN_PROGRESS')}
                  </SelectItem>
                  <SelectItem value="DONE">{t('myTasks.statusValue.DONE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('myTasks.field.priority')}</Label>
              <Select
                value={editorValues.priority}
                onValueChange={(value) =>
                  onEditorChange((current) => ({
                    ...current,
                    priority: value as ProjectTodoPriority,
                  }))
                }
                disabled={!canManagePersonalTodos || isMutating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{t('myTasks.priorityValue.LOW')}</SelectItem>
                  <SelectItem value="MEDIUM">{t('myTasks.priorityValue.MEDIUM')}</SelectItem>
                  <SelectItem value="HIGH">{t('myTasks.priorityValue.HIGH')}</SelectItem>
                  <SelectItem value="CRITICAL">{t('myTasks.priorityValue.CRITICAL')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-target-date">{t('myTasks.field.targetDate')}</Label>
              <Input
                id="todo-target-date"
                type="date"
                value={editorValues.targetDate}
                onChange={(event) =>
                  onEditorChange((current) => ({ ...current, targetDate: event.target.value }))
                }
                disabled={!canManagePersonalTodos || isMutating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-progress">{t('myTasks.field.progressRate')}</Label>
              <Input
                id="todo-progress"
                type="number"
                min={0}
                max={100}
                value={editorValues.progressRate}
                onChange={(event) =>
                  onEditorChange((current) => ({ ...current, progressRate: event.target.value }))
                }
                disabled={!canManagePersonalTodos || isMutating}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('myTasks.field.linkedWbs')}</Label>
            <WbsHierarchySelect
              items={allWbsItems}
              value={editorValues.linkedWbsItemId}
              onValueChange={onLinkedWbsChange}
              placeholder={t('myTasks.wbs.placeholder')}
              unlinkedLabel={t('myTasks.wbs.unlinked')}
              searchPlaceholder={t('myTasks.wbs.searchPlaceholder')}
              noResultsText={t('myTasks.wbs.noResults')}
              disabled={!canManagePersonalTodos || isMutating}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              {selectedTodo.linkedWbsItemId == null
                ? t('myTasks.wbs.privateHint')
                : t('myTasks.wbs.sharedHint')}
            </p>
          </div>

          {canManagePersonalTodos ? (
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={isMutating}>
                <Save className="mr-2 h-4 w-4" />
                {t('myTasks.action.save')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('myTasks.documents.title')}</CardTitle>
          <CardDescription>{t('myTasks.documents.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-secondary/30 px-3 py-3 text-sm text-muted-foreground">
            {selectedTodo.linkedWbsItemId == null ? (
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('myTasks.documents.privatePolicy')}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t('myTasks.documents.sharedPolicy')}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            {canManagePersonalTodos ? (
              <Button
                variant="outline"
                onClick={onOpenDocumentDialog}
                disabled={isMutating || linkableDocumentsCount === 0}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {t('myTasks.documents.linkAction')}
              </Button>
            ) : null}
          </div>

          {todoDocumentsLoading ? (
            <Spinner text={t('common.loading')} />
          ) : todoDocumentsError ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('myTasks.documents.status.loadFailedTitle')}
              description={t('myTasks.documents.status.loadFailedDescription')}
              tone="error"
              action={
                <Button variant="outline" onClick={onRetryDocuments}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          ) : todoDocuments.length === 0 ? (
            <WorkspaceEmptyState
              icon={<Link2 className="h-10 w-10" />}
              title={t('myTasks.documents.empty.title')}
              description={t('myTasks.documents.empty.description')}
            />
          ) : (
            <div className="space-y-3">
              {todoDocuments.map((document) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-border/70 bg-card px-4 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <DocumentTypeBadge documentType={toDocumentType(document.pluginId)} />
                        <span className="truncate text-sm font-semibold text-foreground">
                          {document.name}
                        </span>
                        <Badge variant="outline">
                          {t(
                            `myTasks.documents.visibility.${
                              document.visibility === 'PROJECT_SHARED' ? 'projectShared' : 'private'
                            }`,
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {document.summaryText ?? t('myTasks.documents.noSummary')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {document.linkedAt
                          ? t('myTasks.documents.linkedAt', {
                              date: formatDateTime(document.linkedAt),
                            })
                          : t('myTasks.documents.linkedAtUnknown')}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {canManagePersonalTodos ? (
                        <>
                          <Select
                            value={document.visibility}
                            onValueChange={(value) => onDocumentVisibilityChange(document, value)}
                            disabled={isMutating}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PRIVATE">
                                {t('myTasks.documents.visibility.private')}
                              </SelectItem>
                              <SelectItem value="PROJECT_SHARED">
                                {t('myTasks.documents.visibility.projectShared')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            onClick={() => onDocumentUnlink(document.id)}
                            disabled={isMutating}
                          >
                            <Unlink2 className="mr-2 h-4 w-4" />
                            {t('myTasks.documents.unlinkAction')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTodo.linkedWbsItemId != null ? (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>{t('myTasks.wbsProjection.title')}</CardTitle>
            <CardDescription>{t('myTasks.wbsProjection.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {sharedTodosLoading ? (
              <Spinner text={t('common.loading')} />
            ) : sharedTodosError ? (
              <WorkspaceEmptyState
                icon={<Milestone className="h-10 w-10" />}
                title={t('myTasks.wbsProjection.status.loadFailedTitle')}
                description={t('myTasks.wbsProjection.status.loadFailedDescription')}
                tone="error"
              />
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t('myTasks.wbsProjection.currentTaskShared')}</p>
                <p>{t('myTasks.wbsProjection.totalLinkedTasks', { count: sharedTodos.length })}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
