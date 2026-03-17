const IDENTIFIER_WHITESPACE_REGEX = /\s/;

/**
 * DSL 식별자 문자열을 출력용으로 정규화한다.
 *
 * 공백이 포함된 식별자는 단일 인용부호로 감싸 파서 토큰 경계를 명확히 한다.
 * (예: 사용자 이름 -> '사용자 이름')
 *
 * @param raw 원본 식별자 문자열
 * @returns DSL 출력용 식별자
 */
export function formatDslIdentifier(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return value;
  }

  if (!IDENTIFIER_WHITESPACE_REGEX.test(value)) {
    return value;
  }

  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `'${value.replace(/'/g, "''")}'`;
}
