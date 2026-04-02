/** markdown 문서 템플릿 키. */
export type MarkdownTemplateKey = 'technical-spec' | 'meeting-notes' | 'release-note';

/** markdown heading outline 항목. */
export interface MarkdownHeadingItem {
  /** heading anchor id */
  id: string;
  /** heading depth */
  level: number;
  /** heading text */
  text: string;
}

/** 편집 버퍼 파싱 결과. */
export interface ParsedMarkdownBuffer {
  /** raw frontmatter text */
  frontmatterText: string | null;
  /** parsed frontmatter object */
  frontmatter: Record<string, unknown>;
  /** markdown body without frontmatter */
  body: string;
  /** normalized template key */
  templateKey: MarkdownTemplateKey | null;
  /** document hub summary text */
  summaryText: string | null;
  /** extracted outline headings */
  headings: MarkdownHeadingItem[];
}
