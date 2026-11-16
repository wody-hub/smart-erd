/**
 * ID 기준 projection 갱신을 기존 배열 순서와 엔티티 참조를 보존하며 병합한다.
 * @param current 현재 엔티티 목록
 * @param requestedIds 이번 projection에서 교체할 엔티티 ID
 * @param nextEntries 새로 projection된 엔티티
 * @returns 유지된 참조와 새 엔티티를 포함하는 목록
 */
export function mergeProjectedEntitiesById<T extends { id: string }>(
  current: T[],
  requestedIds: Set<string>,
  nextEntries: T[],
): T[] {
  if (requestedIds.size === 0) return current;

  const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));
  const merged = current
    .filter((entry) => !requestedIds.has(entry.id) || nextById.has(entry.id))
    .map((entry) => nextById.get(entry.id) ?? entry);
  const currentIds = new Set(current.map((entry) => entry.id));

  for (const entry of nextEntries) {
    if (!currentIds.has(entry.id)) merged.push(entry);
  }

  return merged;
}
