import type { ProjectTodo, ProjectTodoPriority, ProjectTodoStatus } from '@/types/project-todo';

export interface TodoEditorValues {
  title: string;
  description: string;
  status: ProjectTodoStatus;
  priority: ProjectTodoPriority;
  targetDate: string;
  progressRate: string;
  linkedWbsItemId: string;
}

export const DEFAULT_EDITOR_VALUES: TodoEditorValues = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  targetDate: '',
  progressRate: '0',
  linkedWbsItemId: 'none',
};

export function buildEditorValues(todo: ProjectTodo | null): TodoEditorValues {
  if (!todo) {
    return DEFAULT_EDITOR_VALUES;
  }
  return {
    title: todo.title,
    description: todo.description ?? '',
    status: todo.status,
    priority: todo.priority,
    targetDate: todo.targetDate ?? '',
    progressRate: String(todo.progressRate),
    linkedWbsItemId: toLinkedWbsEditorValue(todo.linkedWbsItemId),
  };
}

export function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function toNullableDate(value: string): string | null {
  return value.trim() === '' ? null : value;
}

export function parseProgressRate(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function toLinkedWbsEditorValue(wbsItemId: number | null): string {
  return wbsItemId == null ? 'none' : String(wbsItemId);
}
