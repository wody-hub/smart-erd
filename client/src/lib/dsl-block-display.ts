/** 블록 생성·파싱에서 CR/LF를 동일한 표시 공백으로 정규화한다. 원본은 sidecar에 둔다. */
export function normalizeBlockDisplayName(value: string): string {
  return value.replace(/\r\n|[\r\n]/g, ' ');
}
