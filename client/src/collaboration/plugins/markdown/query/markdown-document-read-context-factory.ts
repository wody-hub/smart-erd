import * as Y from 'yjs';
import { parseMarkdownBuffer } from '@/lib/markdown';
import type {
  DocumentEntity,
  DocumentEntityRef,
  DocumentReadContext,
  DocumentReadContextFactory,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import type { DocumentRevisionSource } from '@/collaboration/core/store/document-revision-tracker';
import { MarkdownYjsDocumentAdapter } from '@/collaboration/yjs/markdown-yjs-document-adapter';

const DOCUMENT_ROOT_ID = 'root';

/**
 * markdown shared state를 read query context로 노출한다.
 */
export class MarkdownDocumentReadContextFactory implements DocumentReadContextFactory {
  constructor(
    private readonly engine: YjsSharedDocumentEngine,
    private readonly revisionSource: DocumentRevisionSource,
    private readonly documentAdapter: MarkdownYjsDocumentAdapter,
  ) {}

  create(): DocumentReadContext {
    return new MarkdownDocumentReadContext(
      this.engine.getDocument(),
      this.revisionSource,
      this.documentAdapter,
    );
  }
}

class MarkdownDocumentReadContext implements DocumentReadContext {
  constructor(
    private readonly doc: Y.Doc,
    private readonly revisionSource: DocumentRevisionSource,
    private readonly documentAdapter: MarkdownYjsDocumentAdapter,
  ) {}

  getEntity(ref: DocumentEntityRef): DocumentEntity | null {
    if (ref.kind === 'document' && ref.id === DOCUMENT_ROOT_ID) {
      return this.readDocumentRoot();
    }

    if (ref.kind === 'section') {
      return this.readSection(ref.id);
    }

    return null;
  }

  listRelated(ref: DocumentEntityRef, relation: string): DocumentEntityRef[] {
    if (ref.kind === 'document' && ref.id === DOCUMENT_ROOT_ID && relation === 'sections') {
      return parseMarkdownBuffer(this.documentAdapter.serializeBuffer(this.doc)).headings.map(
        (heading) => ({
          kind: 'section',
          id: heading.id,
        }),
      );
    }

    return [];
  }

  getProperty(ref: DocumentEntityRef, key: string): unknown {
    return this.getEntity(ref)?.props[key];
  }

  findByKind(kind: string): DocumentEntityRef[] {
    if (kind === 'document') {
      return [{ kind: 'document', id: DOCUMENT_ROOT_ID }];
    }

    if (kind === 'section') {
      return parseMarkdownBuffer(this.documentAdapter.serializeBuffer(this.doc)).headings.map(
        (heading) => ({
          kind: 'section',
          id: heading.id,
        }),
      );
    }

    return [];
  }

  getRevision(): string {
    return this.revisionSource.getRevision();
  }

  private readDocumentRoot(): DocumentEntity {
    const buffer = this.documentAdapter.serializeBuffer(this.doc);
    const parsedBuffer = parseMarkdownBuffer(buffer);
    return {
      ref: { kind: 'document', id: DOCUMENT_ROOT_ID },
      props: {
        id: DOCUMENT_ROOT_ID,
        buffer,
        body: parsedBuffer.body,
        frontmatter: parsedBuffer.frontmatter,
        metadata: this.documentAdapter.readMetadata(this.doc),
        headings: parsedBuffer.headings,
        summaryText: parsedBuffer.summaryText,
        templateKey: parsedBuffer.templateKey,
      },
    };
  }

  private readSection(sectionId: string): DocumentEntity | null {
    const section = parseMarkdownBuffer(
      this.documentAdapter.serializeBuffer(this.doc),
    ).headings.find((heading) => heading.id === sectionId);
    if (!section) {
      return null;
    }
    return {
      ref: { kind: 'section', id: section.id },
      props: {
        id: section.id,
        level: section.level,
        text: section.text,
      },
    };
  }
}
