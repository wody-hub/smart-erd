import { computeSectionBoundaries } from '@/lib/markdown-section-index';

/** 발행할 커맨드 타입 */
export type SectionCommand =
  | {
      key: 'markdown:section-update';
      payload: {
        /** section scope ID */
        sectionId: string;
        /** 변경된 section 전체 텍스트 */
        sectionText: string;
        /** body 내 section 시작 offset */
        startOffset: number;
        /** body 내 section 종료 offset */
        endOffset: number;
      };
    }
  | {
      key: 'markdown:body-replace';
      payload: { buffer: string };
    };

/**
 * 이전/현재 body를 비교하여 발행할 커맨드를 결정한다.
 *
 * section 구조 변경(heading 추가/삭제/이동) 또는 section 경계를 넘는 변경은
 * markdown:body-replace fallback을 반환한다.
 *
 * @param prevBody  이전 markdown body (frontmatter 제외)
 * @param nextBody  현재 markdown body (frontmatter 제외)
 * @param fullBuffer 전체 markdown buffer (frontmatter 포함) -- body-replace fallback용
 * @returns 발행할 커맨드 배열 (항상 1개)
 */
export function buildSectionCommands(
  prevBody: string,
  nextBody: string,
  fullBuffer: string,
): SectionCommand[] {
  const prevBoundaries = computeSectionBoundaries(prevBody);
  const nextBoundaries = computeSectionBoundaries(nextBody);

  // section 구조 변경 감지: section 수 또는 section ID 순서 변경
  const prevIds = prevBoundaries.map((b) => b.id);
  const nextIds = nextBoundaries.map((b) => b.id);
  const structureChanged =
    prevIds.length !== nextIds.length || prevIds.some((id, i) => id !== nextIds[i]);

  if (structureChanged) {
    return [bodyReplaceCommand(fullBuffer)];
  }

  // section별 내용 비교: 변경된 section이 1개이면 section-update, 2개 이상이면 body-replace
  let changedSectionIndex = -1;
  let changedCount = 0;

  for (let i = 0; i < prevBoundaries.length; i++) {
    const prev = prevBoundaries[i]!;
    const next = nextBoundaries[i]!;
    const prevText = prevBody.slice(prev.startOffset, prev.endOffset);
    const nextText = nextBody.slice(next.startOffset, next.endOffset);

    if (prevText !== nextText) {
      changedCount++;
      changedSectionIndex = i;
    }
  }

  if (changedCount !== 1) {
    // 변경된 section이 없거나 여러 개 -> body-replace
    return [bodyReplaceCommand(fullBuffer)];
  }

  const boundary = nextBoundaries[changedSectionIndex]!;
  return [
    {
      key: 'markdown:section-update',
      payload: {
        sectionId: boundary.id,
        sectionText: nextBody.slice(boundary.startOffset, boundary.endOffset),
        startOffset: boundary.startOffset,
        endOffset: boundary.endOffset,
      },
    },
  ];
}

/**
 * body-replace fallback 커맨드를 생성한다.
 *
 * @param fullBuffer 전체 markdown buffer
 * @returns body-replace 커맨드
 */
function bodyReplaceCommand(fullBuffer: string): SectionCommand {
  return { key: 'markdown:body-replace', payload: { buffer: fullBuffer } };
}
