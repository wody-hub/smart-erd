import type { CreateWbsItemPayload, UpdateWbsItemPayload, WbsItem } from '@/types/wbs';
import type { WbsDependency } from '@/types/wbs-dependency';

export type WbsVisibleColumn =
  | 'name'
  | 'assignee'
  | 'period'
  | 'actualPeriod'
  | 'progressRate'
  | 'plannedProgressRate'
  | 'progressVarianceRate'
  | 'estimatedMm'
  | 'milestone';

export type WbsViewPreset = 'structure' | 'schedule' | 'resourcing';

export const WBS_VIEW_PRESET_COLUMNS: Record<WbsViewPreset, WbsVisibleColumn[]> = {
  structure: ['milestone'],
  schedule: [
    'assignee',
    'period',
    'actualPeriod',
    'progressRate',
    'plannedProgressRate',
    'progressVarianceRate',
    'milestone',
  ],
  resourcing: ['assignee', 'estimatedMm', 'progressRate'],
};

export interface ParsedBulkCreateLine {
  lineNumber: number;
  raw: string;
  name: string;
  depth: number;
}

export interface BulkCreateValidationError {
  lineNumber: number;
  messageKey: 'emptyName' | 'indentJump' | 'depthLimitExceeded';
}

export interface ParsedBulkCreateResult {
  items: ParsedBulkCreateLine[];
  errors: BulkCreateValidationError[];
}

export interface WbsTemplateNode {
  name: string;
  assigneeUserId: number | null;
  progressRate: number;
  estimatedMm: number | null;
  milestoneId: number | null;
  startOffsetDays: number | null;
  endOffsetDays: number | null;
  children: WbsTemplateNode[];
}

export interface WbsTemplate {
  id: string;
  name: string;
  createdAt: string;
  sourceItemName: string;
  nodes: WbsTemplateNode[];
}

export interface WbsShiftPreviewEntry {
  item: WbsItem;
  nextStartDate: string | null;
  nextEndDate: string | null;
  shiftDays: number;
  reason: 'anchor' | 'downstream';
}

const BULK_DEPTH_SPACES = 2;
const MAX_PREVIEW_DEPTH = 8;

function normalizeLineName(raw: string): string {
  return raw
    .trimStart()
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

function countIndentDepth(raw: string): number {
  const expanded = raw.replace(/\t/g, ' '.repeat(BULK_DEPTH_SPACES));
  const leadingSpaces = expanded.match(/^ */)?.[0].length ?? 0;
  return Math.floor(leadingSpaces / BULK_DEPTH_SPACES);
}

export function parseBulkCreateOutline(input: string): ParsedBulkCreateResult {
  const lines = input.split(/\r?\n/);
  const items: ParsedBulkCreateLine[] = [];
  const errors: BulkCreateValidationError[] = [];

  lines.forEach((raw, index) => {
    if (raw.trim().length === 0) {
      return;
    }

    const depth = countIndentDepth(raw);
    const name = normalizeLineName(raw);
    const lineNumber = index + 1;

    if (!name) {
      errors.push({ lineNumber, messageKey: 'emptyName' });
      return;
    }

    if (depth > MAX_PREVIEW_DEPTH) {
      errors.push({ lineNumber, messageKey: 'depthLimitExceeded' });
      return;
    }

    const previousItem = items.length > 0 ? items[items.length - 1] : undefined;
    if (previousItem && depth > previousItem.depth + 1) {
      errors.push({ lineNumber, messageKey: 'indentJump' });
      return;
    }

    items.push({
      lineNumber,
      raw,
      name,
      depth,
    });
  });

  return { items, errors };
}

function daysBetween(start: string, end: string): number | null {
  const startDate = Date.parse(start);
  const endDate = Date.parse(end);
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) {
    return null;
  }
  return Math.round((endDate - startDate) / 86_400_000);
}

export function shiftDateByDays(value: string | null, shiftDays: number): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  date.setUTCDate(date.getUTCDate() + shiftDays);
  return date.toISOString().slice(0, 10);
}

function appendTemplateNode(
  item: WbsItem,
  itemById: Map<number, WbsItem>,
  childrenByParent: Map<number | null, WbsItem[]>,
  anchorDate: string | null,
): WbsTemplateNode {
  const durationDays =
    item.startDate && item.endDate ? daysBetween(item.startDate, item.endDate) : null;
  const startOffsetDays =
    anchorDate && item.startDate ? daysBetween(anchorDate, item.startDate) : null;

  return {
    name: item.name,
    assigneeUserId: item.assigneeUserId,
    progressRate: item.progressRate,
    estimatedMm: item.estimatedMm,
    milestoneId: item.milestoneId,
    startOffsetDays,
    endOffsetDays:
      startOffsetDays != null && durationDays != null ? startOffsetDays + durationDays : null,
    children: (childrenByParent.get(item.id) ?? []).map((child) =>
      appendTemplateNode(child, itemById, childrenByParent, anchorDate),
    ),
  };
}

export function buildTemplateFromItem(rootItem: WbsItem, allItems: WbsItem[]): WbsTemplate {
  const itemById = new Map(allItems.map((item) => [item.id, item]));
  const childrenByParent = new Map<number | null, WbsItem[]>();

  allItems.forEach((item) => {
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  });

  return {
    id: `wbs-template-${rootItem.id}-${Date.now()}`,
    name: rootItem.name,
    createdAt: new Date().toISOString(),
    sourceItemName: rootItem.name,
    nodes: [appendTemplateNode(rootItem, itemById, childrenByParent, rootItem.startDate)],
  };
}

export function buildBulkCreatePayload(
  item: ParsedBulkCreateLine,
  parentId: number | null,
): CreateWbsItemPayload {
  return {
    name: item.name,
    parentId,
    assigneeUserId: null,
    startDate: null,
    endDate: null,
    actualStartDate: null,
    actualEndDate: null,
    progressRate: 0,
    estimatedMm: null,
    milestoneId: null,
  };
}

export function flattenTemplateNodes(
  nodes: WbsTemplateNode[],
  baseDepth = 0,
): Array<{ node: WbsTemplateNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth: baseDepth },
    ...flattenTemplateNodes(node.children, baseDepth + 1),
  ]);
}

export function buildTemplateCreatePayload(
  node: WbsTemplateNode,
  parentId: number | null,
  anchorDate: string | null,
): CreateWbsItemPayload {
  return {
    name: node.name,
    parentId,
    assigneeUserId: node.assigneeUserId,
    startDate: shiftDateByDays(anchorDate, node.startOffsetDays ?? 0),
    endDate:
      anchorDate && node.endOffsetDays != null
        ? shiftDateByDays(anchorDate, node.endOffsetDays)
        : null,
    actualStartDate: null,
    actualEndDate: null,
    progressRate: node.progressRate,
    estimatedMm: node.estimatedMm,
    milestoneId: node.milestoneId,
  };
}

export function buildDuplicatePayload(
  item: WbsItem,
  parentId: number | null,
): CreateWbsItemPayload {
  return {
    name: `${item.name} Copy`,
    parentId,
    assigneeUserId: item.assigneeUserId,
    startDate: item.startDate,
    endDate: item.endDate,
    actualStartDate: item.actualStartDate ?? null,
    actualEndDate: item.actualEndDate ?? null,
    progressRate: item.progressRate,
    estimatedMm: item.estimatedMm,
    milestoneId: item.milestoneId,
  };
}

export function getTemplateStorageKey(teamId: string, projectId: string): string {
  return `smart-erd:wbs-templates:${teamId}:${projectId}`;
}

export function readStoredTemplates(teamId: string, projectId: string): WbsTemplate[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(getTemplateStorageKey(teamId, projectId));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as WbsTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoredTemplates(
  teamId: string,
  projectId: string,
  templates: WbsTemplate[],
): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(getTemplateStorageKey(teamId, projectId), JSON.stringify(templates));
}

export function buildDependencyShiftPreview(params: {
  anchorItemId: number;
  allItems: WbsItem[];
  dependencies: WbsDependency[];
  shiftDays: number;
}): WbsShiftPreviewEntry[] {
  const { anchorItemId, allItems, dependencies, shiftDays } = params;
  const itemById = new Map(allItems.map((item) => [item.id, item]));
  const queue: Array<{ id: number; reason: 'anchor' | 'downstream' }> = [
    { id: anchorItemId, reason: 'anchor' },
  ];
  const visited = new Set<number>();
  const result: WbsShiftPreviewEntry[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) {
      continue;
    }
    visited.add(current.id);
    const item = itemById.get(current.id);
    if (!item) {
      continue;
    }

    result.push({
      item,
      nextStartDate: shiftDateByDays(item.startDate, shiftDays),
      nextEndDate: shiftDateByDays(item.endDate, shiftDays),
      shiftDays,
      reason: current.reason,
    });

    dependencies
      .filter((dependency) => dependency.predecessorWbsItemId === current.id)
      .forEach((dependency) => {
        queue.push({ id: dependency.successorWbsItemId, reason: 'downstream' });
      });
  }

  return result;
}

export function buildShiftUpdatePayload(
  item: WbsItem,
  nextStartDate: string | null,
  nextEndDate: string | null,
): UpdateWbsItemPayload {
  return {
    name: item.name,
    assigneeUserId: item.assigneeUserId,
    startDate: nextStartDate,
    endDate: nextEndDate,
    actualStartDate: item.actualStartDate ?? null,
    actualEndDate: item.actualEndDate ?? null,
    progressRate: item.progressRate,
    estimatedMm: item.estimatedMm,
    milestoneId: item.milestoneId,
  };
}
