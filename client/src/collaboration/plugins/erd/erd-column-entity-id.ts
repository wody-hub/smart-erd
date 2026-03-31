const ERD_COLUMN_ENTITY_ID_PREFIX = 'erd-column';

export function buildErdColumnEntityId(tableId: string, columnId: string): string {
  return JSON.stringify([ERD_COLUMN_ENTITY_ID_PREFIX, tableId, columnId]);
}

export function parseErdColumnEntityId(
  value: string,
): { tableId: string; columnId: string } | null {
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed[0] === ERD_COLUMN_ENTITY_ID_PREFIX &&
      typeof parsed[1] === 'string' &&
      parsed[1].length > 0 &&
      typeof parsed[2] === 'string' &&
      parsed[2].length > 0
    ) {
      return {
        tableId: parsed[1],
        columnId: parsed[2],
      };
    }
  } catch {
    // ignore malformed id
  }
  return null;
}
