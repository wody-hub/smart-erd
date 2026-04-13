import type {
  DocumentChangeEvent,
  DocumentReadContext,
  DocumentReadQuery,
  DocumentReadExecutor,
  ScopeRef,
} from '@/collaboration/core/contracts/document-read-executor';
import type {
  ProjectionBridge,
  ProjectionRefreshRequest,
  Projector,
} from '@/collaboration/core/contracts/document-plugin';

/**
 * 원격/system 변경을 캔버스 projection refresh 요청으로 변환한다.
 */
export class ScreenSpecProjector implements Projector {
  constructor(private readonly projectionBridge?: ProjectionBridge) {}

  /**
   * 원격/system 문서 변경을 projection refresh 요청으로 전달한다.
   *
   * @param read 문서 read executor
   * @param event 선택적 문서 변경 이벤트
   * @returns 없음
   */
  project(read: DocumentReadExecutor, event?: DocumentChangeEvent): void {
    if (!event || !this.projectionBridge) {
      return;
    }
    if (event.engineOrigin.source !== 'remote' && event.engineOrigin.source !== 'system') {
      return;
    }
    this.projectionBridge.refreshPersistedView(
      read.execute(new ScreenSpecProjectionRefreshQuery(event.affectedScopes)),
    );
  }
}

class ScreenSpecProjectionRefreshQuery implements DocumentReadQuery<ProjectionRefreshRequest> {
  constructor(private readonly affectedScopes: ScopeRef[]) {}

  /**
   * 실제 projection refresh 요청 payload를 계산한다.
   *
   * @param context 문서 read context
   * @returns scope hint 또는 full refresh 요청
   */
  run(context: DocumentReadContext): ProjectionRefreshRequest {
    if (this.affectedScopes.length === 0) {
      return { forceFull: true };
    }

    const scopeHints = this.affectedScopes.filter((scope) => {
      if (scope.kind === 'layer') {
        return context.getEntity({ kind: 'layer', id: scope.id }) !== null;
      }
      return context.getEntity({ kind: scope.kind, id: scope.id }) !== null;
    });

    return scopeHints.length > 0 ? { scopeHints } : { forceFull: true };
  }
}
