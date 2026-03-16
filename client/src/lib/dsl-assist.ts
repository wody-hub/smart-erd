import { formatDslIdentifier } from './dsl-format.js';

/** 보조 팝업 자동/수동 트리거 유형 */
export type AssistPopupTrigger = 'manual' | 'typing' | 'focus' | 'hover';

/** 보조 팝업 항목 카테고리 */
export type AssistPopupItemCategory =
  | 'term'
  | 'domain'
  | 'register'
  | 'type'
  | 'option'
  | 'fk'
  | 'keyword';

export interface ColumnTermAssistContext {
  logicalName: string;
  replaceStartColumn: number;
  replaceEndColumn: number;
}

function unwrapAssistQuotedIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const first = trimmed.charAt(0);
  const last = trimmed.charAt(trimmed.length - 1);
  if ((first === "'" || first === '"') && first === last) {
    const inner = trimmed.substring(1, trimmed.length - 1).trim();
    if (first === "'") {
      return inner.replace(/''/g, "'");
    }
    return inner.replace(/""/g, '"');
  }
  return trimmed;
}

/** 자동 트리거 지연 시간(ms) */
export const AUTO_ASSIST_TRIGGER_DELAY_MS: Readonly<
  Record<Exclude<AssistPopupTrigger, 'manual'>, number>
> = {
  typing: 1000,
  focus: 2000,
  hover: 1000,
};

interface AssistPopupItemLike {
  category: AssistPopupItemCategory;
}

const AUTO_ASSIST_CATEGORIES = new Set<AssistPopupItemCategory>(['term', 'domain', 'register']);
const ASSIST_CATEGORY_ORDER: Record<AssistPopupItemCategory, number> = {
  term: 0,
  domain: 0,
  register: 1,
  keyword: 2,
  fk: 2,
  type: 2,
  option: 2,
};

/**
 * 트리거 유형에 따라 보조 팝업 노출 항목을 필터링한다.
 *
 * 자동 트리거는 noisy한 키워드/type/FK 제안 대신 용어/도메인/빠른 등록 위주로만 노출한다.
 *
 * @param items 보조 팝업 항목 목록
 * @param trigger 팝업 오픈 트리거
 * @returns 필터링된 항목 목록
 */
export function filterAssistItemsForTrigger<T extends AssistPopupItemLike>(
  items: T[],
  trigger: AssistPopupTrigger,
): T[] {
  if (trigger === 'manual') {
    return items;
  }
  return items.filter((item) => AUTO_ASSIST_CATEGORIES.has(item.category));
}

/**
 * 보조 팝업 항목을 사용자 가치가 높은 순서로 안정 정렬한다.
 *
 * 기존 용어/도메인 후보를 빠른 등록보다 우선 노출하고,
 * 나머지 보조 키워드는 뒤로 보낸다.
 *
 * @param items 보조 팝업 항목 목록
 * @returns 정렬된 항목 목록
 */
export function sortAssistItems<T extends AssistPopupItemLike>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const categoryDiff =
        ASSIST_CATEGORY_ORDER[a.item.category] - ASSIST_CATEGORY_ORDER[b.item.category];
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * 용어 자동완성 선택 시 DSL에 삽입할 텍스트를 계산한다.
 *
 * 컬럼 블록에서는 연결된 도메인을 즉시 명시해 사용자가 적용 결과를
 * 바로 확인할 수 있게 하고, 나머지 컨텍스트에서는 용어명만 삽입한다.
 *
 * @param logicalName 용어 논리명
 * @param domainLogicalName 연결된 도메인 논리명
 * @param inBlock 현재 위치가 컬럼 블록 내부인지 여부
 * @returns DSL 삽입 텍스트
 */
export function buildTermAssistInsertText(
  logicalName: string,
  domainLogicalName: string | null | undefined,
  inBlock: boolean,
): string {
  const formattedLogicalName = formatDslIdentifier(logicalName);
  if (!inBlock || !domainLogicalName) {
    return formattedLogicalName;
  }
  return `${formattedLogicalName} :${formatDslIdentifier(domainLogicalName)}`;
}

/**
 * 컬럼 DSL 한 줄에서 용어 추천에 사용할 논리명 core와 치환 범위를 계산한다.
 *
 * `:도메인`, `::타입`, `[옵션]`, `> FK`, `// comment``는 치환 범위에서 제외해
 * 수동 자동완성으로 용어를 바꿔도 나머지 구문은 유지되도록 한다.
 *
 * @param lineContent DSL 원본 한 줄
 * @returns 용어 core와 치환 범위. 계산 불가 시 null
 */
export function extractColumnTermAssistContext(
  lineContent: string,
): ColumnTermAssistContext | null {
  if (!lineContent.trim() || /^\s*Table\b/u.test(lineContent) || /^\s*\/\//u.test(lineContent)) {
    return null;
  }

  const withoutComment = lineContent.replace(/\s*\/\/.*$/u, '');
  const indent = withoutComment.match(/^\s*/u)?.[0] ?? '';
  const afterIndent = withoutComment.slice(indent.length);
  if (!afterIndent.trim()) {
    return null;
  }

  const boundaryCandidates = [afterIndent.indexOf('['), afterIndent.indexOf('>')].filter(
    (index) => index >= 0,
  );
  const coreBoundary =
    boundaryCandidates.length > 0 ? Math.min(...boundaryCandidates) : afterIndent.length;
  const core = afterIndent.slice(0, coreBoundary).trimEnd();
  if (!core) {
    return null;
  }

  const logicalName = unwrapAssistQuotedIdentifier(
    core
    .replace(/\s+::\s*.+$/u, '')
    .replace(/\s+:(?!:)\s*.+$/u, '')
    .trim(),
  );
  if (!logicalName) {
    return null;
  }

  return {
    logicalName,
    replaceStartColumn: indent.length + 1,
    replaceEndColumn: indent.length + core.length + 1,
  };
}
