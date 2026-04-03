import type { MarkdownTemplateKey } from '@/types/markdown';

/** markdown 템플릿 옵션. */
export interface MarkdownTemplateOption {
  /** template key */
  key: MarkdownTemplateKey;
  /** display label */
  label: string;
  /** template summary */
  description: string;
}

/** markdown 문서 생성 시 노출할 템플릿 옵션 목록. */
export const MARKDOWN_TEMPLATE_OPTIONS: MarkdownTemplateOption[] = [
  {
    key: 'technical-spec',
    label: 'Technical Spec',
    description: '배경, 제약, 접근 방식, 롤아웃까지 담는 기술 문서 템플릿입니다.',
  },
  {
    key: 'meeting-notes',
    label: 'Meeting Notes',
    description: '회의 정보, 논의 내용, 액션 아이템을 빠르게 정리합니다.',
  },
  {
    key: 'release-note',
    label: 'Release Note',
    description: '배포 하이라이트, 개선점, 공지사항을 정리합니다.',
  },
];

/**
 * 템플릿 키에 대응하는 표시 라벨을 반환한다.
 *
 * @param templateKey 템플릿 키
 * @returns 표시 라벨, 없으면 null
 */
export function resolveMarkdownTemplateLabel(
  templateKey: string | null | undefined,
): string | null {
  if (!templateKey) {
    return null;
  }
  return MARKDOWN_TEMPLATE_OPTIONS.find((template) => template.key === templateKey)?.label ?? null;
}
