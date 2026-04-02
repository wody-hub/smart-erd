import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { dump, load } from 'js-yaml';
import { MARKDOWN_SANITIZE_POLICY } from '@/collaboration/plugins/markdown/markdown-sanitize-policy.generated';
import { downloadBlobFile } from '@/lib/export/export-core';
import type { DocumentExportFormat } from '@/types/document';
import type { MarkdownHeadingItem, MarkdownTemplateKey, ParsedMarkdownBuffer } from '@/types/markdown';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * markdown 편집 버퍼를 frontmatter/body 구조로 파싱한다.
 *
 * @param buffer 직렬화된 markdown 버퍼
 * @returns 파싱 결과
 */
export function parseMarkdownBuffer(buffer: string): ParsedMarkdownBuffer {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frontmatterMatch = normalized.match(FRONTMATTER_PATTERN);
  const frontmatterText = frontmatterMatch?.[1] ?? null;
  const body = frontmatterMatch
    ? normalized.slice(frontmatterMatch[0].length).replace(/^\n/, '')
    : normalized;
  let loadedFrontmatter: unknown = {};
  if (frontmatterText) {
    try {
      loadedFrontmatter = load(frontmatterText);
    } catch {
      loadedFrontmatter = {};
    }
  }
  const frontmatter =
    loadedFrontmatter && typeof loadedFrontmatter === 'object' && !Array.isArray(loadedFrontmatter)
      ? normalizeMarkdownFrontmatter(loadedFrontmatter as Record<string, unknown>)
      : {};

  return {
    frontmatterText,
    frontmatter,
    body,
    templateKey: normalizeTemplateKey(frontmatter.template),
    summaryText: extractSummaryText(body),
    headings: extractHeadingItems(body),
  };
}

/**
 * frontmatter/body 구조를 markdown 편집 버퍼로 직렬화한다.
 *
 * @param frontmatter 직렬화할 frontmatter 객체
 * @param body markdown 본문
 * @returns 직렬화된 markdown 버퍼
 */
export function serializeMarkdownBuffer(frontmatter: Record<string, unknown>, body: string): string {
  const normalizedBody = body.replace(/\r\n/g, '\n');
  if (Object.keys(frontmatter).length === 0) {
    return normalizedBody;
  }
  return `---\n${dump(frontmatter, { lineWidth: 120 }).trim()}\n---\n\n${normalizedBody}`;
}

/**
 * markdown 본문을 sanitize 된 preview HTML로 렌더링한다.
 *
 * @param body markdown 본문
 * @returns sanitize 된 preview HTML
 */
export function renderMarkdownPreview(body: string): string {
  const rawHtml = marked.parse(body, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...MARKDOWN_SANITIZE_POLICY.allowedTags],
    ALLOWED_ATTR: Array.from(
      new Set(Object.values(MARKDOWN_SANITIZE_POLICY.allowedAttributes).flat()),
    ),
    ADD_ATTR: ['target', 'rel'],
  });
}

/**
 * 현재 markdown 버퍼를 브라우저에서 파일로 export 한다.
 *
 * html export는 preview와 동일한 renderer/sanitize 경로를 사용한다.
 *
 * @param documentName 문서 이름
 * @param buffer 현재 markdown 편집 버퍼
 * @param format export 포맷
 * @returns 없음
 */
export function exportMarkdownBuffer(
  documentName: string,
  buffer: string,
  format: DocumentExportFormat,
): void {
  const fileBaseName = sanitizeFilename(documentName || 'document');
  if (format === 'md') {
    downloadBlobFile(new Blob([buffer], { type: 'text/markdown;charset=utf-8' }), `${fileBaseName}.md`);
    return;
  }

  const parsedBuffer = parseMarkdownBuffer(buffer);
  const htmlDocument = renderMarkdownHtmlDocument(documentName, parsedBuffer.body);
  downloadBlobFile(new Blob([htmlDocument], { type: 'text/html;charset=utf-8' }), `${fileBaseName}.html`);
}

/**
 * markdown 본문을 전체 HTML 문서로 감싼다.
 *
 * @param documentName 문서 이름
 * @param body markdown 본문
 * @returns 전체 HTML 문서 문자열
 */
export function renderMarkdownHtmlDocument(documentName: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentName)}</title>
  <style>
    @font-face {
      font-family: 'Pretendard';
      src:
        local('Pretendard Variable'),
        local('Pretendard'),
        url('https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/variable/woff2/PretendardVariable.woff2')
          format('woff2-variations');
      font-style: normal;
      font-weight: 45 920;
      font-display: swap;
    }
    body { font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f6f1e8; color: #171717; }
    main { max-width: 960px; margin: 0 auto; padding: 56px 24px 80px; }
    article { background: #fffcf6; border: 1px solid #e3d9c8; border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(10, 16, 32, 0.08); }
    h1, h2, h3, h4, h5, h6 { font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.2; margin-top: 1.6em; letter-spacing: -0.03em; }
    h1 { margin-top: 0; font-size: 2.2rem; }
    p, li, blockquote { line-height: 1.75; }
    ul { padding-left: 1.5rem; }
    li { margin: 0.35em 0; }
    li > input[type='checkbox'] { width: 1rem; height: 1rem; margin-right: 0.55rem; vertical-align: -0.12rem; accent-color: #2457ff; pointer-events: none; }
    pre { background: #161c2f; color: #f8fafc; padding: 16px; border-radius: 14px; overflow: auto; }
    code { background: rgba(36, 87, 255, 0.09); padding: 0.15em 0.35em; border-radius: 6px; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 4px solid #c98b1e; margin: 1.2em 0; padding-left: 1em; color: #5b5b5b; }
    table { width: 100%; border-collapse: collapse; margin: 1.2em 0; }
    th, td { border: 1px solid #dccfb9; padding: 10px 12px; text-align: left; }
    th { background: #f2eadb; }
    hr { border: none; border-top: 1px solid #dccfb9; margin: 24px 0; }
  </style>
</head>
<body>
  <main>
    <article>${renderMarkdownPreview(body)}</article>
  </main>
</body>
</html>`;
}

function extractHeadingItems(body: string): MarkdownHeadingItem[] {
  return body
    .split('\n')
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => !!match)
    .map((match, index) => {
      const text = match[2]!.trim();
      return {
        id: `heading-${index}-${slugify(text)}`,
        level: match[1]!.length,
        text,
      };
    });
}

function extractSummaryText(body: string): string | null {
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s+/.test(line)) {
      return truncate(line.replace(/^([-*]|\d+\.)\s+/, ''));
    }
    return truncate(line);
  }
  return null;
}

function normalizeTemplateKey(value: unknown): MarkdownTemplateKey | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (value === 'technical-spec' || value === 'meeting-notes' || value === 'release-note') {
    return value;
  }
  return null;
}

function truncate(value: string): string {
  return value.length <= 120 ? value : `${value.slice(0, 117)}...`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeMarkdownFrontmatter(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeYamlValue(entryValue)]),
  );
}

function normalizeYamlValue(value: unknown): unknown {
  if (value instanceof Date) {
    return serializeYamlDateScalar(value);
  }
  if (Array.isArray(value)) {
    return value.map((entryValue) => normalizeYamlValue(entryValue));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        normalizeYamlValue(entryValue),
      ]),
    );
  }
  return value;
}

function serializeYamlDateScalar(value: Date): string {
  const hasTimeComponent =
    value.getUTCHours() !== 0 ||
    value.getUTCMinutes() !== 0 ||
    value.getUTCSeconds() !== 0 ||
    value.getUTCMilliseconds() !== 0;
  if (hasTimeComponent) {
    return value.toISOString();
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
