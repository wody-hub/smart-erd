import * as Y from 'yjs';
import { parseMarkdownBuffer, serializeMarkdownBuffer } from '@/lib/markdown';
import type { MarkdownCollaborationBootstrap } from '@/collaboration/channel/document/markdown-collaboration-bootstrap';
import type { YjsDocumentAdapter } from './yjs-document-adapter.js';

export const MARKDOWN_BOOTSTRAP_TRANSACTION_ORIGIN = 'bootstrap';

const BODY_KEY = 'body';
const FRONTMATTER_KEY = 'frontmatter';
const METADATA_KEY = 'metadata';

/**
 * markdown bootstrap/buffer와 Y.Doc 간 변환을 담당한다.
 */
export class MarkdownYjsDocumentAdapter
  implements YjsDocumentAdapter<MarkdownCollaborationBootstrap>
{
  /**
   * bootstrap content를 canonical markdown shared state로 반영한다.
   *
   * @param doc 대상 Y.Doc
   * @param bootstrap bootstrap 데이터
   * @param origin Yjs transaction origin
   */
  applyBootstrapToDoc(
    doc: Y.Doc,
    bootstrap: MarkdownCollaborationBootstrap,
    origin: unknown,
  ): void {
    this.replaceBuffer(doc, bootstrap.content ?? '', origin);
  }

  /**
   * 현재 Y.Doc 전체 상태 update를 추출한다.
   *
   * @param doc 대상 Y.Doc
   * @returns 전체 상태 update
   */
  extractFullStateUpdate(doc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * 직렬화된 markdown buffer를 canonical shared state로 반영한다.
   *
   * @param doc 대상 Y.Doc
   * @param buffer 직렬화된 markdown buffer
   * @param origin Yjs transaction origin
   */
  replaceBuffer(doc: Y.Doc, buffer: string, origin: unknown): void {
    const parsedBuffer = parseMarkdownBuffer(buffer);
    const normalizedFrontmatter = parsedBuffer.frontmatter;
    const normalizedBody = parsedBuffer.body.replace(/\r\n/g, '\n');
    doc.transact(() => {
      const frontmatterMap = this.getFrontmatterMap(doc);
      const existingFrontmatterKeys = Array.from(frontmatterMap.keys());
      for (const key of existingFrontmatterKeys) {
        if (!(key in normalizedFrontmatter)) {
          frontmatterMap.delete(key);
        }
      }
      for (const [key, value] of Object.entries(normalizedFrontmatter)) {
        if (value === undefined) {
          frontmatterMap.delete(key);
          continue;
        }
        frontmatterMap.set(key, normalizeCollaborativeValue(value));
      }

      const bodyText = this.getBodyText(doc);
      const currentBody = bodyText.toString();
      if (currentBody !== normalizedBody) {
        if (currentBody.length > 0) {
          bodyText.delete(0, currentBody.length);
        }
        if (normalizedBody.length > 0) {
          bodyText.insert(0, normalizedBody);
        }
      }

      const metadataMap = this.getMetadataMap(doc);
      if (parsedBuffer.templateKey) {
        metadataMap.set('templateKey', parsedBuffer.templateKey);
      } else {
        metadataMap.delete('templateKey');
      }
    }, origin);
  }

  /**
   * 현재 Y.Doc을 markdown editor buffer로 직렬화한다.
   *
   * @param doc 대상 Y.Doc
   * @returns 직렬화된 markdown buffer
   */
  serializeBuffer(doc: Y.Doc): string {
    return serializeMarkdownBuffer(this.readFrontmatter(doc), this.readBody(doc));
  }

  /**
   * plain frontmatter/body를 markdown editor buffer로 직렬화한다.
   *
   * @param frontmatter 직렬화할 frontmatter
   * @param body markdown 본문
   * @returns 직렬화된 markdown buffer
   */
  serializeBufferFromParts(frontmatter: Record<string, unknown>, body: string): string {
    return serializeMarkdownBuffer(frontmatter, body);
  }

  /**
   * 현재 frontmatter를 plain object로 읽는다.
   *
   * @param doc 대상 Y.Doc
   * @returns plain frontmatter object
   */
  readFrontmatter(doc: Y.Doc): Record<string, unknown> {
    const frontmatterMap = this.getFrontmatterMap(doc);
    const result: Record<string, unknown> = {};
    for (const [key, value] of frontmatterMap.entries()) {
      result[key] = toPlainJsonValue(value);
    }
    return result;
  }

  /**
   * 현재 body 텍스트를 읽는다.
   *
   * @param doc 대상 Y.Doc
   * @returns markdown body
   */
  readBody(doc: Y.Doc): string {
    return this.getBodyText(doc).toString();
  }

  /**
   * 현재 metadata를 plain object로 읽는다.
   *
   * @param doc 대상 Y.Doc
   * @returns plain metadata object
   */
  readMetadata(doc: Y.Doc): Record<string, unknown> {
    const metadataMap = this.getMetadataMap(doc);
    const result: Record<string, unknown> = {};
    for (const [key, value] of metadataMap.entries()) {
      result[key] = toPlainJsonValue(value);
    }
    return result;
  }

  private getBodyText(doc: Y.Doc): Y.Text {
    return doc.getText(BODY_KEY);
  }

  private getFrontmatterMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(FRONTMATTER_KEY);
  }

  private getMetadataMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(METADATA_KEY);
  }
}

function toPlainJsonValue(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of value.entries()) {
      result[key] = toPlainJsonValue(entryValue);
    }
    return result;
  }
  if (value instanceof Y.Array) {
    return value.toArray().map((entryValue) => toPlainJsonValue(entryValue));
  }
  return value;
}

function normalizeCollaborativeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entryValue) => normalizeCollaborativeValue(entryValue));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        normalizeCollaborativeValue(entryValue),
      ]),
    );
  }
  return value;
}
