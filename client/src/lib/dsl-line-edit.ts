import { formatDslIdentifier } from './dsl-format.js';

/** Table 선언 줄을 빠르게 제외하기 위한 DSL 접두 패턴 */
const DSL_TABLE_PREFIX_REGEX = /^\s*Table\b/u;

/**
 * 따옴표 내부를 제외하고 DSL 한 줄에서 trailing `//` 주석 시작 위치를 찾는다.
 *
 * @param lineContent 주석 시작 위치를 찾을 DSL 한 줄
 * @returns 주석 시작 인덱스. 주석이 없으면 `-1`
 */
function findCommentStart(lineContent: string): number {
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < lineContent.length - 1; index += 1) {
    const char = lineContent[index];
    const nextChar = lineContent[index + 1];

    if (quote) {
      if (char === quote && nextChar === quote) {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      return index;
    }
  }

  return -1;
}

/**
 * DSL 한 줄에서 trailing `//` 주석을 분리한다.
 *
 * @param lineContent 분리할 원본 한 줄
 * @returns 주석을 제외한 statement와 보존할 commentPart
 */
function splitTrailingComment(lineContent: string): { statement: string; commentPart: string } {
  const commentStart = findCommentStart(lineContent);
  if (commentStart < 0) {
    return {
      statement: lineContent.trimEnd(),
      commentPart: '',
    };
  }

  return {
    statement: lineContent.slice(0, commentStart).trimEnd(),
    commentPart: ` ${lineContent.slice(commentStart).trimStart()}`,
  };
}

/**
 * 컬럼 줄의 첫 논리명 식별자가 끝나는 위치를 찾는다.
 *
 * 인용 식별자와 이스케이프된 따옴표를 고려하고, 공백/FK/도메인/옵션 시작 전까지만
 * 논리명 영역으로 본다.
 *
 * @param statement 주석과 들여쓰기를 제외한 DSL statement
 * @returns 첫 식별자 종료 인덱스. 식별자가 없으면 `-1`
 */
function findIdentifierEnd(statement: string): number {
  let index = 0;
  while (index < statement.length && /\s/u.test(statement[index]!)) {
    index += 1;
  }

  if (index >= statement.length) {
    return -1;
  }

  const firstChar = statement[index]!;
  if (firstChar === "'" || firstChar === '"') {
    const quote = firstChar;
    index += 1;
    while (index < statement.length) {
      const char = statement[index]!;
      const nextChar = statement[index + 1];
      if (char === quote && nextChar === quote) {
        index += 2;
        continue;
      }
      if (char === quote) {
        return index + 1;
      }
      index += 1;
    }
    return statement.length;
  }

  while (index < statement.length) {
    const char = statement[index]!;
    if (/\s/u.test(char) || char === '>' || char === ':' || char === '[') {
      return index;
    }
    index += 1;
  }

  return statement.length;
}

/**
 * statement 끝쪽의 `:도메인` 또는 `::타입` 구간 시작 위치를 찾는다.
 *
 * 따옴표 내부의 `:`는 무시하고, 마지막 trailing 타입/도메인 구간만 반환한다.
 *
 * @param statement trailing 타입/도메인 구간을 찾을 DSL statement
 * @returns trailing 타입/도메인 시작 인덱스. 없으면 `-1`
 */
function findTrailingTypeOrDomainStart(statement: string): number {
  let quote: "'" | '"' | null = null;
  let trailingStart = -1;

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index]!;
    const nextChar = statement[index + 1];
    const prevChar = index > 0 ? statement[index - 1] : undefined;

    if (quote) {
      if (char === quote && nextChar === quote) {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === ':' && nextChar === ':') {
      trailingStart = index;
      index += 1;
      continue;
    }

    if (char === ':' && prevChar !== ':') {
      trailingStart = index;
    }
  }

  if (trailingStart < 0) {
    return -1;
  }

  while (trailingStart > 0 && /\s/u.test(statement[trailingStart - 1]!)) {
    trailingStart -= 1;
  }

  return trailingStart;
}

/**
 * 빠른 용어 등록 결과를 컬럼 DSL 한 줄에 반영한다.
 *
 * 논리명은 새 용어명으로 치환하고, 선택된 도메인이 있으면 `:도메인`을 재작성한다.
 * 기존 `[옵션]`, `> FK`, `// comment`는 보존한다. 도메인이 없으면 기존 `:도메인`/`::타입`
 * 표현도 그대로 유지한다.
 *
 * @param lineContent 원본 컬럼 한 줄
 * @param logicalName 새 용어 논리명
 * @param domainLogicalName 선택된 도메인 논리명
 * @returns 변경된 한 줄
 */
export function applyQuickTermToDslLine(
  lineContent: string,
  logicalName: string,
  domainLogicalName?: string,
): string {
  if (
    !logicalName.trim() ||
    DSL_TABLE_PREFIX_REGEX.test(lineContent) ||
    lineContent.trim().startsWith('//')
  ) {
    return lineContent;
  }

  const { statement, commentPart } = splitTrailingComment(lineContent);
  if (!statement.trim()) {
    return lineContent;
  }

  const indent = statement.match(/^\s*/u)?.[0] ?? '';
  const content = statement.slice(indent.length);

  const optionsMatch = content.match(/\s+(\[[^\]]*\])\s*$/u);
  const optionsPart = optionsMatch ? ` ${optionsMatch[1]}` : '';
  let working = optionsMatch ? content.slice(0, optionsMatch.index).trimEnd() : content.trimEnd();

  if (domainLogicalName?.trim()) {
    const trailingStart = findTrailingTypeOrDomainStart(working);
    if (trailingStart >= 0) {
      working = working.slice(0, trailingStart).trimEnd();
    }
  }

  const identifierEnd = findIdentifierEnd(working);
  if (identifierEnd < 0) {
    return lineContent;
  }

  const trailingPart = working.slice(identifierEnd);
  const nextLogicalName = formatDslIdentifier(logicalName);
  const domainPart = domainLogicalName?.trim()
    ? ` :${formatDslIdentifier(domainLogicalName)}`
    : '';

  return `${indent}${nextLogicalName}${trailingPart}${domainPart}${optionsPart}${commentPart}`;
}
