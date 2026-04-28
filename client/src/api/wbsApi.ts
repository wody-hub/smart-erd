import axiosInstance from './axiosInstance';
import { normalizeDocumentPluginId } from '@/types/document';
import type {
  CreateWbsItemPayload,
  ProjectDocumentTag,
  ReorderWbsPayload,
  TaggedDocument,
  UpdateWbsItemPayload,
  WbsItem,
  WbsLinkedDocument,
} from '@/types/wbs';

/**
 * 프로젝트 WBS 목록을 조회한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @returns WBS 항목 목록
 */
export async function fetchWbsItems(teamId: string, projectId: string): Promise<WbsItem[]> {
  const res = await axiosInstance.get<WbsItem[]>(`/teams/${teamId}/projects/${projectId}/wbs`);
  return res.data;
}

/**
 * WBS 항목을 생성한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 생성 payload
 * @returns 생성된 WBS 항목
 */
export async function createWbsItem(
  teamId: string,
  projectId: string,
  payload: CreateWbsItemPayload,
): Promise<WbsItem> {
  const res = await axiosInstance.post<WbsItem>(
    `/teams/${teamId}/projects/${projectId}/wbs`,
    payload,
  );
  return res.data;
}

/**
 * WBS 항목을 수정한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param wbsId WBS 항목 ID
 * @param payload 수정 payload
 * @returns 수정된 WBS 항목
 */
export async function updateWbsItem(
  teamId: string,
  projectId: string,
  wbsId: number,
  payload: UpdateWbsItemPayload,
): Promise<WbsItem> {
  const res = await axiosInstance.put<WbsItem>(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}`,
    payload,
  );
  return res.data;
}

/**
 * WBS 항목을 삭제한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param wbsId WBS 항목 ID
 */
export async function deleteWbsItem(
  teamId: string,
  projectId: string,
  wbsId: number,
): Promise<void> {
  await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}/wbs/${wbsId}`);
}

/**
 * WBS 항목을 재정렬한다.
 *
 * @param teamId 팀 ID
 * @param projectId 프로젝트 ID
 * @param payload 재정렬 payload
 */
export async function reorderWbsItems(
  teamId: string,
  projectId: string,
  payload: ReorderWbsPayload,
): Promise<WbsItem[]> {
  const res = await axiosInstance.patch<WbsItem[]>(
    `/teams/${teamId}/projects/${projectId}/wbs/reorder`,
    payload,
  );
  return res.data;
}

function normalizeWbsLinkedDocument(raw: Record<string, unknown>): WbsLinkedDocument {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ''),
    pluginId: normalizeDocumentPluginId(String(raw.pluginId ?? 'markdown')),
    templateKey: raw.templateKey == null ? null : String(raw.templateKey),
    summaryText: raw.summaryText == null ? null : String(raw.summaryText),
    templateLabel: raw.templateLabel == null ? null : String(raw.templateLabel),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [],
    linkedAt: raw.linkedAt == null ? null : String(raw.linkedAt),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.linkedAt ?? ''),
  };
}

function normalizeProjectDocumentTag(raw: Record<string, unknown>): ProjectDocumentTag {
  return {
    tag: String(raw.tag ?? ''),
    documentCount: Number(raw.documentCount ?? 0),
  };
}

function normalizeTaggedDocument(raw: Record<string, unknown>): TaggedDocument {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ''),
    pluginId: normalizeDocumentPluginId(String(raw.pluginId ?? 'markdown')),
    templateKey: raw.templateKey == null ? null : String(raw.templateKey),
    summaryText: raw.summaryText == null ? null : String(raw.summaryText),
    templateLabel: raw.templateLabel == null ? null : String(raw.templateLabel),
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag)) : [],
    linkedAt: raw.linkedAt == null ? null : String(raw.linkedAt),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

export async function fetchWbsLinkedDocuments(
  teamId: string,
  projectId: string,
  wbsId: number,
): Promise<WbsLinkedDocument[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/documents`,
  );
  return (res.data as Record<string, unknown>[]).map(normalizeWbsLinkedDocument);
}

export async function linkWbsDocument(
  teamId: string,
  projectId: string,
  wbsId: number,
  documentId: number,
): Promise<void> {
  await axiosInstance.put(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/documents/${documentId}`,
  );
}

export async function unlinkWbsDocument(
  teamId: string,
  projectId: string,
  wbsId: number,
  documentId: number,
): Promise<void> {
  await axiosInstance.delete(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/documents/${documentId}`,
  );
}

export async function fetchProjectDocumentTags(
  teamId: string,
  projectId: string,
): Promise<ProjectDocumentTag[]> {
  const res = await axiosInstance.get(`/teams/${teamId}/projects/${projectId}/wbs/document-tags`);
  return (res.data as Record<string, unknown>[]).map(normalizeProjectDocumentTag);
}

export async function fetchTaggedDocuments(
  teamId: string,
  projectId: string,
  tag: string,
): Promise<TaggedDocument[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/wbs/document-tags/documents`,
    {
      params: { tag },
    },
  );
  return (res.data as Record<string, unknown>[]).map(normalizeTaggedDocument);
}
