import type { DocumentChangeOrigin } from '@/collaboration/core/contracts/document-read-executor';

export function resolveDocumentChangeOrigin(origin: unknown): DocumentChangeOrigin {
  if (isDocumentChangeOrigin(origin)) {
    return origin;
  }
  if (origin === 'bootstrap') {
    return { source: 'bootstrap' };
  }
  if (origin === 'remote') {
    return { source: 'remote' };
  }
  if (typeof origin === 'string' && origin.startsWith('canvas-system-')) {
    return { source: 'system' };
  }
  return { source: 'local' };
}

export function isProjectorManagedDocumentOrigin(origin: unknown): boolean {
  const resolvedOrigin = resolveDocumentChangeOrigin(origin);
  return resolvedOrigin.source === 'remote' || resolvedOrigin.source === 'system';
}

function isDocumentChangeOrigin(origin: unknown): origin is DocumentChangeOrigin {
  if (!origin || typeof origin !== 'object') {
    return false;
  }
  const source = (origin as { source?: unknown }).source;
  return source === 'local' || source === 'remote' || source === 'bootstrap' || source === 'system';
}
