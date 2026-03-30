import type { ScopeRef } from '@/collaboration/core/contracts/document-read-executor';
import type { ProjectionRefreshRequest } from '@/collaboration/core/contracts/document-plugin';
import { parseErdColumnEntityId } from './erd-column-entity-id';

export type ErdProjectionTarget = 'nodes' | 'edges' | 'groups';

interface BuildErdProjectionRefreshRequestOptions {
  allowedTargets?: ErdProjectionTarget[];
  fallbackTarget?: ErdProjectionTarget;
}

export function buildErdProjectionRefreshRequest(
  request?: ProjectionRefreshRequest,
  options: BuildErdProjectionRefreshRequestOptions = {},
): ProjectionRefreshRequest | null {
  if (request?.forceFull) {
    return { forceFull: true };
  }

  const allowedTargets = new Set<ErdProjectionTarget>(
    options.allowedTargets ?? ['nodes', 'edges', 'groups'],
  );
  const targets = new Set<ErdProjectionTarget>(
    (request?.targets ?? []).filter(
      (target): target is ErdProjectionTarget =>
        isProjectionTarget(target) && allowedTargets.has(target),
    ),
  );
  const nodeIds = new Set<string>(request?.nodeIds ?? []);
  const edgeIds = new Set<string>(request?.edgeIds ?? []);
  const groupIds = new Set<string>(request?.groupIds ?? []);

  for (const scope of request?.scopeHints ?? []) {
    const mapped = mapScopeToProjection(scope);
    if (mapped === 'fallback') {
      return options.fallbackTarget ? { targets: [options.fallbackTarget] } : { forceFull: true };
    }
    if (!mapped || !allowedTargets.has(mapped.target)) {
      continue;
    }
    targets.add(mapped.target);
    if (mapped.target === 'nodes') {
      nodeIds.add(mapped.id);
      continue;
    }
    if (mapped.target === 'edges') {
      edgeIds.add(mapped.id);
      continue;
    }
    groupIds.add(mapped.id);
  }

  if (targets.size === 0) {
    return options.fallbackTarget ? { targets: [options.fallbackTarget] } : null;
  }

  return {
    targets: [...targets],
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    groupIds: [...groupIds],
  };
}

function mapScopeToProjection(
  scope: ScopeRef,
): { target: ErdProjectionTarget; id: string } | 'fallback' | null {
  if (scope.kind === 'table') {
    return { target: 'nodes', id: scope.id };
  }
  if (scope.kind === 'column') {
    const columnRef = parseErdColumnEntityId(scope.id);
    return columnRef ? { target: 'nodes', id: columnRef.tableId } : 'fallback';
  }
  if (scope.kind === 'edge') {
    return { target: 'edges', id: scope.id };
  }
  if (scope.kind === 'group') {
    return { target: 'groups', id: scope.id };
  }
  return 'fallback';
}

function isProjectionTarget(value: unknown): value is ErdProjectionTarget {
  return value === 'nodes' || value === 'edges' || value === 'groups';
}
