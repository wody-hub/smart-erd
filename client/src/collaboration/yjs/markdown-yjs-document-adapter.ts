import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from 'diff-match-patch';
import * as Y from 'yjs';
import { parseMarkdownBuffer, serializeMarkdownBuffer } from '@/lib/markdown';
import { computeSectionBoundaries } from '@/lib/markdown-section-index';
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
      // frontmatter YAML 파싱 실패 시 기존 Y.Map 값을 보존하고 body만 업데이트한다.
      if (parsedBuffer.frontmatterValid) {
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

      if (parsedBuffer.frontmatterValid) {
        const metadataMap = this.getMetadataMap(doc);
        if (parsedBuffer.templateKey) {
          metadataMap.set('templateKey', parsedBuffer.templateKey);
        } else {
          metadataMap.delete('templateKey');
        }
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

  /**
   * markdown:section-update 커맨드를 증분 Y.Text 적용으로 처리한다.
   *
   * sectionId로 현재 Y.Text body에서 section 경계를 재계산한 뒤,
   * diff-match-patch로 현재 section과 변경된 section의 diff를 계산하고
   * Y.Doc.transact 내부에서 증분 연산을 적용한다.
   *
   * 동시 편집 시 앞 section 길이가 변경되어도 sectionId 기반 경계 재계산으로
   * 올바른 offset에 diff가 적용된다.
   *
   * @param doc          대상 Y.Doc
   * @param sectionId    대상 section의 안정적 ID (slug 기반)
   * @param sectionText  변경된 section 전체 텍스트
   * @param origin       Yjs transaction origin
   */
  applySectionUpdate(
    doc: Y.Doc,
    sectionId: string,
    sectionText: string,
    origin: unknown,
  ): void {
    const bodyText = this.getBodyText(doc);
    const currentBody = bodyText.toString();
    const boundaries = computeSectionBoundaries(currentBody);
    const target = boundaries.find((b) => b.id === sectionId);
    if (!target) {
      return;
    }

    const currentSection = currentBody.slice(target.startOffset, target.endOffset);
    if (currentSection === sectionText) {
      return;
    }

    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(currentSection, sectionText);
    dmp.diff_cleanupSemantic(diffs);

    doc.transact(() => {
      let cursor = target.startOffset;
      for (const [op, text] of diffs) {
        if (op === DIFF_EQUAL) {
          cursor += text.length;
        } else if (op === DIFF_DELETE) {
          bodyText.delete(cursor, text.length);
        } else if (op === DIFF_INSERT) {
          bodyText.insert(cursor, text);
          cursor += text.length;
        }
      }
    }, origin);
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
