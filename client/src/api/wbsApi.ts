import axiosInstance from './axiosInstance';
import { normalizeDocumentPluginId } from '@/types/document';
import type {
  BulkCreateWbsItemsPayload,
  BulkCreateWbsItemsResponse,
  CreateWbsCommentPayload,
  CreateWbsItemPayload,
  ProjectDocumentTag,
  ReorderWbsPayload,
  SaveWbsTemplatePayload,
  TaggedDocument,
  WbsActivity,
  WbsActivityEventType,
  WbsActivitySubjectType,
  WbsComment,
  WbsDependencyShiftPayload,
  WbsDependencyShiftResponse,
  UpdateWbsItemPayload,
  WbsItem,
  WbsLinkedDocument,
  WbsSubtreeInstantiationPayload,
  WbsSubtreeMutationResponse,
  WbsTemplateSummary,
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
    `/teams/${teamId}/projects/${projectId}/wbs/order`,
    payload,
  );
  return res.data;
}

export async function fetchWbsTemplates(
  teamId: string,
  projectId: string,
): Promise<WbsTemplateSummary[]> {
  const res = await axiosInstance.get<WbsTemplateSummary[]>(
    `/teams/${teamId}/projects/${projectId}/wbs/templates`,
  );
  return res.data;
}

export async function saveWbsTemplate(
  teamId: string,
  projectId: string,
  payload: SaveWbsTemplatePayload,
): Promise<WbsTemplateSummary> {
  const res = await axiosInstance.post<WbsTemplateSummary>(
    `/teams/${teamId}/projects/${projectId}/wbs/templates`,
    payload,
  );
  return res.data;
}

export async function instantiateWbsTemplate(
  teamId: string,
  projectId: string,
  templateId: number,
  payload: WbsSubtreeInstantiationPayload,
): Promise<WbsSubtreeMutationResponse> {
  const res = await axiosInstance.post<WbsSubtreeMutationResponse>(
    `/teams/${teamId}/projects/${projectId}/wbs/templates/${templateId}/instantiations`,
    payload,
  );
  return res.data;
}

export async function duplicateWbsSubtree(
  teamId: string,
  projectId: string,
  wbsId: number,
  payload: WbsSubtreeInstantiationPayload,
): Promise<WbsSubtreeMutationResponse> {
  const res = await axiosInstance.post<WbsSubtreeMutationResponse>(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/subtree-copies`,
    payload,
  );
  return res.data;
}

export async function bulkCreateWbsItems(
  teamId: string,
  projectId: string,
  payload: BulkCreateWbsItemsPayload,
): Promise<BulkCreateWbsItemsResponse> {
  const res = await axiosInstance.post<BulkCreateWbsItemsResponse>(
    `/teams/${teamId}/projects/${projectId}/wbs/batches`,
    payload,
  );
  return res.data;
}

export async function previewWbsDependencyShift(
  teamId: string,
  projectId: string,
  payload: WbsDependencyShiftPayload,
): Promise<WbsDependencyShiftResponse> {
  const res = await axiosInstance.post<WbsDependencyShiftResponse>(
    `/teams/${teamId}/projects/${projectId}/wbs/dependency-shift-simulations`,
    payload,
  );
  return res.data;
}

export async function applyWbsDependencyShift(
  teamId: string,
  projectId: string,
  payload: WbsDependencyShiftPayload,
): Promise<WbsDependencyShiftResponse> {
  const res = await axiosInstance.post<WbsDependencyShiftResponse>(
    `/teams/${teamId}/projects/${projectId}/wbs/dependency-shifts`,
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

function normalizeWbsComment(raw: Record<string, unknown>): WbsComment {
  return {
    id: Number(raw.id ?? 0),
    content: String(raw.content ?? ''),
    actorLoginId: raw.actorLoginId == null ? null : String(raw.actorLoginId),
    actorName: raw.actorName == null ? null : String(raw.actorName),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ''),
  };
}

function normalizeWbsActivity(raw: Record<string, unknown>): WbsActivity {
  return {
    id: Number(raw.id ?? 0),
    eventType: String(raw.eventType ?? 'DOCUMENT_LINKED') as WbsActivityEventType,
    subjectType:
      raw.subjectType == null ? null : (String(raw.subjectType) as WbsActivitySubjectType),
    subjectId: raw.subjectId == null ? null : Number(raw.subjectId),
    subjectLabel: raw.subjectLabel == null ? null : String(raw.subjectLabel),
    previousValue: raw.previousValue == null ? null : String(raw.previousValue),
    currentValue: raw.currentValue == null ? null : String(raw.currentValue),
    detail: raw.detail == null ? null : String(raw.detail),
    actorLoginId: raw.actorLoginId == null ? null : String(raw.actorLoginId),
    actorName: raw.actorName == null ? null : String(raw.actorName),
    occurredAt: String(raw.occurredAt ?? ''),
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

export async function fetchWbsComments(
  teamId: string,
  projectId: string,
  wbsId: number,
): Promise<WbsComment[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/comments`,
  );
  return (res.data as Record<string, unknown>[]).map(normalizeWbsComment);
}

export async function createWbsComment(
  teamId: string,
  projectId: string,
  wbsId: number,
  payload: CreateWbsCommentPayload,
): Promise<WbsComment> {
  const res = await axiosInstance.post(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/comments`,
    payload,
  );
  return normalizeWbsComment(res.data as Record<string, unknown>);
}

export async function fetchWbsActivities(
  teamId: string,
  projectId: string,
  wbsId: number,
): Promise<WbsActivity[]> {
  const res = await axiosInstance.get(
    `/teams/${teamId}/projects/${projectId}/wbs/${wbsId}/activities`,
  );
  return (res.data as Record<string, unknown>[]).map(normalizeWbsActivity);
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
