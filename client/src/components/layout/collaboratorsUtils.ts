/**
 * 사용자 ID를 기반으로 고정 커서 색상을 생성한다.
 *
 * @param userId 사용자 ID
 * @returns CSS 색상 문자열
 */
export function getPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const idx = (hash % 6) + 1;
  return `hsl(var(--cursor-color-${idx}))`;
}

/**
 * 이름에서 아바타 이니셜(첫 글자)을 추출한다.
 *
 * @param name 표시 이름
 * @returns 이니셜 1글자
 */
export function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
