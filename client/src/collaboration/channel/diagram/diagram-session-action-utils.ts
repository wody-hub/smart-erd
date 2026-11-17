export type DiagramSessionActionStatus = 'applied' | 'rejected' | 'unavailable';
export type DiagramAppliedStatus = 'applied' | 'rejected';

export interface DiagramSessionActionResult<T> {
  status: DiagramSessionActionStatus;
  value?: T;
}

/** 문서가 준비되지 않았거나 명령이 거절되면 쓰기 없이 차단 알림을 한 번 표시한다. */
export function resolveDiagramDocumentStatus(
  status: DiagramSessionActionStatus,
  onRejected: () => void,
): DiagramAppliedStatus {
  if (status !== 'applied') {
    onRejected();
    return 'rejected';
  }
  return 'applied';
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
