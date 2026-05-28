import { LayoutGrid, List, ListTodo, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import type { ProjectTodo, ProjectTodoStatus } from '@/types/project-todo';

type TodoViewMode = 'list' | 'kanban';

const TODO_STATUSES: ProjectTodoStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
const BOARD_COLUMNS: Record<ProjectTodoStatus, string> = {
  TODO: 'bg-composition-warning-bg text-composition-warning-foreground',
  IN_PROGRESS: 'bg-primary/10 text-primary',
  DONE: 'bg-success/10 text-success',
};
const CARD_ORDER: Array<keyof typeof BOARD_COLUMNS> = ['TODO', 'IN_PROGRESS', 'DONE'];

interface ProjectTodoListSectionProps {
  canManagePersonalTodos: boolean;
  selectedTodoId: number | null;
  todos: ProjectTodo[];
  onCreate: () => void;
  onSelectTodo: (todoId: number) => void;
  onStatusChange: (todo: ProjectTodo, status: ProjectTodoStatus) => void;
}

/**
 * 개인 TODO 목록을 목록/칸반 형태로 표시한다.
 *
 * @param props 개인 TODO 목록 렌더링 속성
 * @returns 개인 TODO 목록 섹션 JSX
 */
export default function ProjectTodoListSection({
  canManagePersonalTodos,
  selectedTodoId,
  todos,
  onCreate,
  onSelectTodo,
  onStatusChange,
}: ProjectTodoListSectionProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<TodoViewMode>('list');

  const todosByStatus = useMemo(() => {
    const byStatus: Record<ProjectTodoStatus, ProjectTodo[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    todos.forEach((todo) => {
      byStatus[todo.status].push(todo);
    });
    return byStatus;
  }, [todos]);

  const listModeContent = (
    <div className="space-y-3">
      {todos.map((todo) => {
        const isSelected = todo.id === selectedTodoId;
        return (
          <button
            key={todo.id}
            type="button"
            onClick={() => onSelectTodo(todo.id)}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              isSelected
                ? 'border-primary/60 bg-primary/5'
                : 'border-border/70 bg-card hover:border-primary/30'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="truncate text-base font-semibold text-foreground">{todo.title}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t(`myTasks.statusValue.${todo.status}`)}</Badge>
                  <Badge variant="secondary">{t(`myTasks.priorityValue.${todo.priority}`)}</Badge>
                  {todo.linkedWbsItemName ? (
                    <Badge variant="default">{todo.linkedWbsItemName}</Badge>
                  ) : (
                    <Badge variant="outline">{t('myTasks.wbs.unlinked')}</Badge>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{todo.progressRate}%</p>
                <p>
                  {todo.targetDate
                    ? t('myTasks.meta.targetDate', { date: todo.targetDate })
                    : t('myTasks.meta.noTargetDate')}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const boardModeContent = (
    <div className="grid gap-3 xl:grid-cols-3">
      {CARD_ORDER.map((status) => (
        <section key={status} className="space-y-2 rounded-xl border border-border/70 bg-card p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <h3 className="text-sm font-semibold text-foreground">
              {t(`myTasks.statusValue.${status}`)}
            </h3>
            <Badge variant="secondary" className="h-6 px-2">
              {todosByStatus[status].length}
            </Badge>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-auto px-1 pb-1">
            {todosByStatus[status].map((todo) => (
              <div
                key={todo.id}
                className={`w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors ${
                  todo.id === selectedTodoId ? 'ring-1 ring-primary/60' : 'hover:border-primary/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTodo(todo.id)}
                  className="w-full text-left"
                >
                  <div className={`mb-2 rounded-md px-2 py-1 ${BOARD_COLUMNS[todo.status]}`}>
                    {t(`myTasks.statusValue.${todo.status}`)}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{todo.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary">{t(`myTasks.priorityValue.${todo.priority}`)}</Badge>
                    {todo.linkedWbsItemName ? (
                      <Badge variant="outline" className="max-w-full truncate">
                        {todo.linkedWbsItemName}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t('myTasks.wbs.unlinked')}</Badge>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>{todo.progressRate}%</p>
                    <p>
                      {todo.targetDate
                        ? t('myTasks.meta.targetDate', { date: todo.targetDate })
                        : t('myTasks.meta.noTargetDate')}
                    </p>
                  </div>
                </button>
                {canManagePersonalTodos ? (
                  <div className="mt-2">
                    <Select
                      value={todo.status}
                      onValueChange={(value) => onStatusChange(todo, value as ProjectTodoStatus)}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder={t('myTasks.section.viewMode.moveTo')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TODO_STATUSES.map((statusOption) => (
                          <SelectItem key={statusOption} value={statusOption}>
                            {t(`myTasks.statusValue.${statusOption}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('myTasks.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('myTasks.section.description')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex rounded-md border bg-secondary/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              <List className="mr-1 h-4 w-4" />
              {t('myTasks.section.viewMode.list')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              {t('myTasks.section.viewMode.board')}
            </Button>
          </div>
          {canManagePersonalTodos ? (
            <Button onClick={onCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('myTasks.action.create')}
            </Button>
          ) : null}
        </div>
      </div>

      {todos.length === 0 ? (
        <WorkspaceEmptyState
          icon={<ListTodo className="h-10 w-10" />}
          title={t('myTasks.empty.title')}
          description={
            canManagePersonalTodos
              ? t('myTasks.empty.description')
              : t('myTasks.empty.readOnlyDescription')
          }
          action={
            canManagePersonalTodos ? (
              <Button onClick={onCreate}>{t('myTasks.empty.cta')}</Button>
            ) : undefined
          }
        />
      ) : viewMode === 'list' ? (
        listModeContent
      ) : (
        boardModeContent
      )}
    </section>
  );
}
