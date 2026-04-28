import axiosInstance from './axiosInstance';
import { normalizeDocumentPluginId } from '@/types/document';
import type {
  CreateProjectTodoPayload,
  ProjectTodo,
  ProjectTodoPriority,
  ProjectTodoStatus,
  SharedTodoSummary,
  TodoDocument,
  TodoDocumentVisibility,
  UpdateProjectTodoPayload,
  UpdateTodoDocumentVisibilityPayload,
} from '@/types/project-todo';

function normalizeProjectTodoStatus(value: unknown): ProjectTodoStatus {
  const next = String(value ?? 'TODO');
  if (next === 'IN_PROGRESS' || next === 'DONE') {
    return next;
  }
  return 'TODO';
}

function normalizeProjectTodoPriority(value: unknown): ProjectTodoPriority {
  const next = String(value ?? 'MEDIUM');
  if (next === 'LOW' || next === 'HIGH' || next === 'CRITICAL') {
    return next;
  }
  return 'MEDIUM';
}

function normalizeTodoDocumentVisibility(value: unknown): TodoDocumentVisibility {
  return String(value ?? 'PRIVATE') === 'PROJECT_SHARED' ? 'PROJECT_SHARED' : 'PRIVATE';
}

function normalizeProjectTodo(raw: Record<string, unknown>): ProjectTodo {
  return {
    id: Number(raw.id ?? 0),
    title: String(raw.title ?? ''),
    description: raw.description == null ? null : String(raw.description),
    status: normalizeProjectTodoStatus(raw.status),
    priority: normalizeProjectTodoPriority(raw.priority),
    targetDate: raw.targetDate == null ? null : String(raw.targetDate),
    progressRate: Number(raw.progressRate ?? 0),
    linkedWbsItemId: raw.linkedWbsItemId == null ? null : Number(raw.linkedWbsItemId),
    linkedWbsItemName: raw.linkedWbsItemName == null ? null : String(raw.linkedWbsItemName),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ''),
  };
}

function normalizeTodoDocument(raw: Record<string, unknown>): TodoDocument {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ''),
    pluginId: normalizeDocumentPluginId(String(raw.pluginId ?? 'markdown')),
    templateKey: raw.templateKey == null ? null : String(raw.templateKey),
    templateLabel: raw.templateLabel == null ? null : String(raw.templateLabel),
    summaryText: raw.summaryText == null ? null : String(raw.summaryText),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [],
    visibility: normalizeTodoDocumentVisibility(raw.visibility),
    linkedAt: raw.linkedAt == null ? null : String(raw.linkedAt),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ''),
  };
}

function normalizeSharedTodoSummary(raw: Record<string, unknown>): SharedTodoSummary {
  return {
    id: Number(raw.id ?? 0),
    title: String(raw.title ?? ''),
    status: normalizeProjectTodoStatus(raw.status),
    priority: normalizeProjectTodoPriority(raw.priority),
    targetDate: raw.targetDate == null ? null : String(raw.targetDate),
    progressRate: Number(raw.progressRate ?? 0),
    ownerUserId: Number(raw.ownerUserId ?? 0),
    ownerName: String(raw.ownerName ?? ''),
    sharedDocuments: Array.isArray(raw.sharedDocuments)
      ? raw.sharedDocuments.map((document) =>
          normalizeTodoDocument(document as Record<string, unknown>),
        )
      : [],
  };
}

export async function fetchProjectTodos(teamId: string, projectId: string): Promise<ProjectTodo[]> {
  const res = await axiosInstance.get(`/teams/${teamId}/projects/${projectId}/todos`);
  return (res.data as Record<string, unknown>[]).map(normalizeProjectTodo);
}

export async function createProjectTodo(
  teamId: string,
  projectId: string,
  payload: CreateProjectTodoPayload,
): Promise<ProjectTodo> {
  const res = await axiosInstance.post(`/teams/${teamId}/projects/${projectId}/todos`, payload);
  return normalizeProjectTodo(res.data as Record<string, unknown>);
}

export async function updateProjectTodo(
  teamId: string,
  projectId: string,
  todoId: number,
  payload: UpdateProjectTodoPayload,
): Promise<ProjectTodo> {
  const res = await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}`,
    payload,
  );
  return normalizeProjectTodo(res.data as Record<string, unknown>);
}

export async function deleteProjectTodo(
  teamId: string,
  projectId: string,
  todoId: number,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/todos/${todoId}`);
}

export async function fetchTodoDocuments(
  teamId: string,
  projectId: string,
  todoId: number,
): Promise<TodoDocument[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}/documents`,
  );
  return (res.data as Record<string, unknown>[]).map(normalizeTodoDocument);
}

export async function linkTodoDocument(
  teamId: string,
  projectId: string,
  todoId: number,
  documentId: number,
  payload: UpdateTodoDocumentVisibilityPayload,
): Promise<TodoDocument> {
  const res = await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}/documents/${documentId}`,
    payload,
  );
  return normalizeTodoDocument(res.data as Record<string, unknown>);
}

export async function unlinkTodoDocument(
  teamId: string,
  projectId: string,
  todoId: number,
  documentId: number,
): Promise<void> {
  await axiosInstance.delete(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}/documents/${documentId}`,
  );
}

export async function linkTodoToWbs(
  teamId: string,
  projectId: string,
  todoId: number,
  wbsItemId: number,
): Promise<ProjectTodo> {
  const res = await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}/wbs/${wbsItemId}`,
  );
  return normalizeProjectTodo(res.data as Record<string, unknown>);
}

export async function unlinkTodoFromWbs(
  teamId: string,
  projectId: string,
  todoId: number,
): Promise<ProjectTodo> {
  const res = await axiosInstance.delete(
    `/teams/${teamId}/projects/${projectId}/todos/${todoId}/wbs`,
  );
  return normalizeProjectTodo(res.data as Record<string, unknown>);
}

export async function fetchSharedTodoSummaries(
  teamId: string,
  projectId: string,
  wbsItemId: number,
): Promise<SharedTodoSummary[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsItemId}/todos`,
  );
  return (res.data as Record<string, unknown>[]).map(normalizeSharedTodoSummary);
}
