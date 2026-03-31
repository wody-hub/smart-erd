export type DiagramSessionActionStatus = 'applied' | 'rejected' | 'unavailable';
export type DiagramAppliedStatus = 'applied' | 'rejected';

export interface DiagramSessionActionResult<T> {
  status: DiagramSessionActionStatus;
  value?: T;
}

export function resolveDiagramAppliedStatus(
  status: DiagramSessionActionStatus,
  onUnavailable: () => void,
  onRejected: () => void,
): DiagramAppliedStatus {
  if (status === 'unavailable') {
    onUnavailable();
    return 'applied';
  }

  if (status === 'rejected') {
    onRejected();
  }

  return status;
}

export function resolveDiagramActionResult<T>(
  result: DiagramSessionActionResult<T>,
  onUnavailable: () => T | null,
  onRejected: () => void,
): T | null {
  if (result.status === 'unavailable') {
    return onUnavailable();
  }

  if (result.status === 'rejected') {
    onRejected();
    return null;
  }

  return result.value ?? null;
}
