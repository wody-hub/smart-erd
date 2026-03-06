/**
 * 불리언 환경변수를 파싱한다.
 *
 * @param value        원본 문자열
 * @param defaultValue 값이 없거나 잘못된 경우의 기본값
 * @returns 파싱된 불리언 값
 */
function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return defaultValue;
}

/**
 * 양의 정수 환경변수를 파싱한다.
 *
 * @param value        원본 문자열
 * @param defaultValue 값이 없거나 잘못된 경우의 기본값
 * @param minValue     허용 최소값
 * @returns 파싱된 정수 값
 */
function parsePositiveIntEnv(
  value: string | undefined,
  defaultValue: number,
  minValue: number,
): number {
  if (value == null || value.trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    return defaultValue;
  }

  return parsed;
}

/** feature flag: 다이어그램 API preview 활성화 여부 (기본 ON, 명시적으로 false면 OFF) */
export const ENABLE_API_PREVIEW = parseBooleanEnv(
  import.meta.env.VITE_ENABLE_DIAGRAM_API_PREVIEW,
  true,
);

/** 자동 백업 주기 (ms) — 기본 30초 */
export const AUTO_BACKUP_INTERVAL_MS = parsePositiveIntEnv(
  import.meta.env.VITE_ERD_AUTOSAVE_INTERVAL_MS,
  30_000,
  1_000,
);

/** 변경 후 유휴 백업 대기 시간 (ms) — 기본 5초 */
export const AUTO_BACKUP_IDLE_MS = parsePositiveIntEnv(
  import.meta.env.VITE_ERD_AUTOSAVE_IDLE_MS,
  5_000,
  1_000,
);
