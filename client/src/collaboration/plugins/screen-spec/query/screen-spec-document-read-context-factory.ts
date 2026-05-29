import type {
  DocumentEntity,
  DocumentEntityRef,
  DocumentReadContext,
  DocumentReadContextFactory,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentRevisionSource } from '@/collaboration/core/store/document-revision-tracker';
import { readScreenDesignDocument } from '@/pages/screendesign/screen-design-document';

type ScreenSpecDocumentSnapshot = ReturnType<typeof readScreenDesignDocument>;
type ScreenSpecLayerSnapshot = {
  id: string;
  screenId: string;
  instanceIds: string[];
};

export class ScreenSpecDocumentReadContextFactory implements DocumentReadContextFactory {
  constructor(
    private readonly engine: YjsSharedDocumentEngine,
    private readonly revisionSource: DocumentRevisionSource,
  ) {}

  /**
   * 현재 Y.Doc 스냅샷 기준 read context를 생성한다.
   *
   * @returns 화면기획 문서 read context
   */
  create(): DocumentReadContext {
    const snapshot = readScreenDesignDocument(this.engine.getDocument());
    return new ScreenSpecDocumentReadContext(snapshot, this.revisionSource.getRevision());
  }
}

class ScreenSpecDocumentReadContext implements DocumentReadContext {
  private readonly screens: ScreenSpecDocumentSnapshot['screens'];
  private readonly masters: ScreenSpecDocumentSnapshot['libraryItems'];
  private readonly instances: ScreenSpecDocumentSnapshot['instancesByScreenId'][string];
  private readonly layers: ScreenSpecLayerSnapshot[];

  constructor(
    private readonly snapshot: ScreenSpecDocumentSnapshot,
    private readonly revision: string,
  ) {
    this.screens = snapshot.screens;
    this.masters = snapshot.libraryItems;
    this.instances = Object.values(snapshot.instancesByScreenId).flat();
    this.layers = snapshot.screens.map((screen) => ({
      id: screen.id,
      screenId: screen.id,
      instanceIds: (snapshot.instancesByScreenId[screen.id] ?? []).map((instance) => instance.id),
    }));
  }

  /**
   * ref에 해당하는 문서 엔티티를 조회한다.
   *
   * @param ref 조회할 엔티티 참조
   * @returns 엔티티가 있으면 plain props와 함께 반환한다
   */
  getEntity(ref: DocumentEntityRef): DocumentEntity | null {
    switch (ref.kind) {
      case 'screen': {
        const screen = this.screens.find((candidate) => candidate.id === ref.id);
        return screen ? { ref, props: { ...screen } } : null;
      }
      case 'master': {
        const master = this.masters.find((candidate) => candidate.id === ref.id);
        return master ? { ref, props: { ...master } } : null;
      }
      case 'instance': {
        const instance = this.instances.find((candidate) => candidate.id === ref.id);
        return instance ? { ref, props: { ...instance } } : null;
      }
      case 'layer': {
        const layer = this.layers.find((candidate) => candidate.id === ref.id);
        return layer ? { ref, props: { ...layer } } : null;
      }
      default:
        return null;
    }
  }

  /**
   * 주어진 엔티티와 relation에 연결된 ref 목록을 조회한다.
   *
   * @param ref 기준 엔티티 ref
   * @param relation 조회할 relation 이름
   * @returns relation에 해당하는 엔티티 ref 목록
   */
  listRelated(ref: DocumentEntityRef, relation: string): DocumentEntityRef[] {
    if (relation !== 'instances') {
      return [];
    }

    if (ref.kind === 'screen' || ref.kind === 'layer') {
      return (this.snapshot.instancesByScreenId[ref.id] ?? []).map((instance) => ({
        kind: 'instance',
        id: instance.id,
      }));
    }

    if (ref.kind === 'master') {
      return this.instances
        .filter((instance) => instance.masterId === ref.id)
        .map((instance) => ({
          kind: 'instance',
          id: instance.id,
        }));
    }

    return [];
  }

  /**
   * 엔티티의 특정 속성 값을 조회한다.
   *
   * @param ref 속성을 읽을 엔티티 ref
   * @param key 조회할 속성 키
   * @returns 속성 값 또는 undefined
   */
  getProperty(ref: DocumentEntityRef, key: string): unknown {
    return this.getEntity(ref)?.props[key];
  }

  /**
   * kind에 해당하는 모든 엔티티 ref를 반환한다.
   *
   * @param kind 조회할 엔티티 kind
   * @returns kind별 엔티티 ref 목록
   */
  findByKind(kind: string): DocumentEntityRef[] {
    switch (kind) {
      case 'screen':
        return this.screens.map((screen) => ({ kind: 'screen', id: screen.id }));
      case 'master':
        return this.masters.map((master) => ({ kind: 'master', id: master.id }));
      case 'instance':
        return this.instances.map((instance) => ({ kind: 'instance', id: instance.id }));
      case 'layer':
        return this.layers.map((layer) => ({ kind: 'layer', id: layer.id }));
      default:
        return [];
    }
  }

  /**
   * 현재 read context가 반영한 revision을 반환한다.
   *
   * @returns 문서 revision 문자열
   */
  getRevision(): string {
    return this.revision;
  }
}
