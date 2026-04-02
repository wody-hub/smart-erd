/**
 * Section 경계 정보 — heading 단위로 markdown body 를 분할한 결과.
 *
 * 증분 동기화와 증분 프리뷰의 핵심 primitive 로,
 * 어떤 변경이 어느 section 에 속하는지 판별하는 데 사용한다.
 */
export interface SectionBoundary {
  /** heading 이 시작하는 body 내 character offset (root section 은 0) */
  startOffset: number;
  /** 다음 section 의 startOffset (마지막 section 은 body.length) */
  endOffset: number;
  /** 안정적 section ID: slug 기반, 같은 slug 충돌 시 '-1'/'-2' 접미사 */
  id: string;
  /** heading level (1~6). root section 은 0 */
  level: number;
  /** heading 텍스트 (root section 은 '') */
  text: string;
}

/** heading 정규식 — 줄 시작에서 1~6 개의 # + 공백 + 텍스트 */
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/gm;

/**
 * markdown body 에서 section 경계 배열을 계산한다.
 * heading 이전 영역은 id='root', level=0 으로 처리한다.
 *
 * @param body markdown 본문 (frontmatter 제외, \r\n 은 \n 으로 정규화된 상태)
 * @returns section 경계 배열 (순서 보장)
 */
export function computeSectionBoundaries(body: string): SectionBoundary[] {
  const headings: Array<{ offset: number; level: number; text: string }> = [];

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = HEADING_PATTERN.exec(body)) !== null) {
    headings.push({
      offset: match.index,
      level: match[1]!.length,
      text: match[2]!.trim(),
    });
  }

  // heading 이 하나도 없으면 전체를 root section 으로
  if (headings.length === 0) {
    return [
      {
        id: 'root',
        level: 0,
        startOffset: 0,
        endOffset: body.length,
        text: '',
      },
    ];
  }

  const sections: SectionBoundary[] = [];
  const slugCountMap = new Map<string, number>();

  // heading 이전 content 가 있으면 root section 추가
  const firstHeadingOffset = headings[0]!.offset;
  if (firstHeadingOffset > 0) {
    sections.push({
      id: 'root',
      level: 0,
      startOffset: 0,
      endOffset: firstHeadingOffset,
      text: '',
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]!;
    const nextHeading = headings[i + 1];
    const endOffset = nextHeading ? nextHeading.offset : body.length;

    const slug = slugifySection(heading.text);
    const id = assignUniqueId(slug, slugCountMap);

    sections.push({
      id,
      level: heading.level,
      startOffset: heading.offset,
      endOffset,
      text: heading.text,
    });
  }

  return sections;
}

/**
 * 변경된 offset 범위가 속하는 section ID 를 반환한다.
 *
 * @param boundaries computeSectionBoundaries 결과
 * @param changeStart 변경 시작 offset (inclusive)
 * @param changeEnd 변경 종료 offset (exclusive)
 * @returns 단일 section 내 변경이면 sectionId, 경계를 넘으면 null
 */
export function findAffectedSection(
  boundaries: SectionBoundary[],
  changeStart: number,
  changeEnd: number,
): string | null {
  // 빈 변경 (커서 위치만)
  if (changeStart === changeEnd) {
    for (const section of boundaries) {
      if (changeStart >= section.startOffset && changeStart < section.endOffset) {
        return section.id;
      }
    }
    // 문서 끝에 위치한 경우 마지막 section
    if (boundaries.length > 0) {
      const last = boundaries[boundaries.length - 1]!;
      if (changeStart === last.endOffset) {
        return last.id;
      }
    }
    return null;
  }

  // 범위 변경: 하나의 section 에 완전히 포함되어야 한다
  for (const section of boundaries) {
    if (changeStart >= section.startOffset && changeEnd <= section.endOffset) {
      return section.id;
    }
  }

  return null;
}

/**
 * heading 텍스트를 slug 로 변환한다.
 * 한글을 포함한 유니코드 문자를 지원한다.
 *
 * @param text heading 텍스트
 * @returns slug 문자열 (빈 경우 'section')
 */
function slugifySection(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'section';
}

/**
 * slug 에 고유 ID 를 부여한다.
 * 첫 등장은 그대로, 이후 중복은 '-1', '-2' 접미사를 추가한다.
 *
 * @param slug 기본 slug
 * @param countMap slug 별 등장 횟수 추적 맵
 * @returns 고유 ID
 */
function assignUniqueId(slug: string, countMap: Map<string, number>): string {
  const count = countMap.get(slug) ?? 0;
  countMap.set(slug, count + 1);

  if (count === 0) {
    return slug;
  }
  return `${slug}-${count}`;
}
