import { ListTodo, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import type { ProjectTodo } from '@/types/project-todo';

interface ProjectTodoListSectionProps {
  canManagePersonalTodos: boolean;
  selectedTodoId: number | null;
  todos: ProjectTodo[];
  onCreate: () => void;
  onSelectTodo: (todoId: number) => void;
}

export default function ProjectTodoListSection({
  canManagePersonalTodos,
  selectedTodoId,
  todos,
  onCreate,
  onSelectTodo,
}: ProjectTodoListSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('myTasks.section.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('myTasks.section.description')}</p>
        </div>
        {canManagePersonalTodos ? (
          <Button onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('myTasks.action.create')}
          </Button>
        ) : null}
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
            canManagePersonalTodos ? <Button onClick={onCreate}>{t('myTasks.empty.cta')}</Button> : undefined
          }
        />
      ) : (
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
      )}
    </section>
  );
}
