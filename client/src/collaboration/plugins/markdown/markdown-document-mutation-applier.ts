import type {
  DocumentMutation,
  DocumentMutationApplyResult,
} from '@/collaboration/core/contracts/document-read-executor';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';
import { MarkdownYjsDocumentAdapter } from '@/collaboration/yjs/markdown-yjs-document-adapter';

/**
 * markdown command를 canonical Y.Doc shared state에 적용한다.
 */
export class MarkdownDocumentMutationApplier {
  constructor(
    private readonly engine: YjsSharedDocumentEngine,
    private readonly documentAdapter: MarkdownYjsDocumentAdapter,
  ) {}

  apply<T = unknown>(mutation: DocumentMutation): DocumentMutationApplyResult<T> {
    switch (mutation.key) {
      case 'markdown:body-replace':
        return this.toApplyResult(this.applyBufferReplace(mutation));
      case 'markdown:section-update':
        return this.toApplyResult(this.applySectionUpdate(mutation));
      case 'markdown:frontmatter-update':
        return this.toApplyResult(this.applyFrontmatterUpdate(mutation));
      default:
        return { applied: false };
    }
  }

  private toApplyResult<T = unknown>(applied: boolean, value?: T): DocumentMutationApplyResult<T> {
    if (!applied) {
      return { applied: false };
    }
    return value === undefined ? { applied: true } : { applied: true, value };
  }

  private applyBufferReplace(mutation: DocumentMutation): boolean {
    const buffer = typeof mutation.payload?.buffer === 'string' ? mutation.payload.buffer : null;
    if (buffer == null) {
      return false;
    }
    this.documentAdapter.replaceBuffer(this.engine.getDocument(), buffer, mutation.key);
    return true;
  }

  private applySectionUpdate(mutation: DocumentMutation): boolean {
    const payload = mutation.payload;
    if (
      typeof payload?.sectionId !== 'string' ||
      typeof payload?.sectionText !== 'string'
    ) {
      return false;
    }
    this.documentAdapter.applySectionUpdate(
      this.engine.getDocument(),
      payload.sectionId as string,
      payload.sectionText as string,
      mutation.key,
    );
    return true;
  }

  private applyFrontmatterUpdate(mutation: DocumentMutation): boolean {
    const frontmatter =
      mutation.payload?.frontmatter &&
      typeof mutation.payload.frontmatter === 'object' &&
      !Array.isArray(mutation.payload.frontmatter)
        ? (mutation.payload.frontmatter as Record<string, unknown>)
        : null;
    if (!frontmatter) {
      return false;
    }

    const doc = this.engine.getDocument();
    const currentBody = this.documentAdapter.readBody(doc);
    const nextBuffer = this.documentAdapter.serializeBuffer(doc);
    const currentParsed = this.documentAdapter.readFrontmatter(doc);
    const mergedFrontmatter = {
      ...currentParsed,
      ...frontmatter,
    };
    this.documentAdapter.replaceBuffer(
      doc,
      this.documentAdapter.serializeBufferFromParts(mergedFrontmatter, currentBody),
      mutation.key,
    );
    return nextBuffer !== this.documentAdapter.serializeBuffer(doc);
  }
}
