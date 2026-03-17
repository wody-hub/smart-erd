import { STORAGE_KEYS } from '../constants/storage.js';
import { djb2 } from './hash.js';

/** Diff Apply rollout 모드 */
export type DiffApplyRolloutMode = 'off' | 'internal' | 'beta' | 'all';

/** 로컬 override 정보 */
export interface DiffApplyLocalOverride {
  forceMode: DiffApplyRolloutMode | null;
  internalOptIn: boolean;
}

/** rollout 판정 입력 */
export interface DiffApplyRolloutInput {
  mode: string | undefined;
  betaPercent: string | number | undefined;
  internalIds: string | undefined;
  teamId?: string;
  projectId?: string;
  diagramId?: string;
  loginId?: string | null;
  localOverride: DiffApplyLocalOverride;
}

/** rollout 판정 결과 */
export interface DiffApplyRolloutDecision {
  enabled: boolean;
  mode: DiffApplyRolloutMode;
  reason:
    | 'mode-off'
    | 'mode-all'
    | 'internal-eligible'
    | 'internal-not-eligible'
    | 'beta-eligible'
    | 'beta-not-eligible'
    | 'beta-no-key';
  bucket?: number;
  betaPercent?: number;
}

interface StorageLike {
  getItem: (key: string) => string | null;
}

/**
 * localStorage에서 diff apply rollout override를 로드한다.
 *
 * @returns 로컬 override 정보
 */
export function loadDiffApplyLocalOverride(): DiffApplyLocalOverride {
  const storage = getLocalStorage();
  if (!storage) {
    return { forceMode: null, internalOptIn: false };
  }

  const forceModeRaw = storage.getItem(STORAGE_KEYS.ERD_DIFF_APPLY_FORCE_MODE);
  const forceMode = normalizeRolloutMode(forceModeRaw);
  const internalOptInRaw = storage.getItem(STORAGE_KEYS.ERD_DIFF_APPLY_INTERNAL_OPT_IN);
  const internalOptIn = internalOptInRaw === 'true' || internalOptInRaw === '1';

  return {
    forceMode,
    internalOptIn,
  };
}

/**
 * rollout 입력을 기반으로 diff apply 활성 여부를 판정한다.
 *
 * @param input rollout 판정 입력
 * @returns 활성/비활성 판정 결과
 */
export function resolveDiffApplyRollout(input: DiffApplyRolloutInput): DiffApplyRolloutDecision {
  const mode = input.localOverride.forceMode ?? normalizeRolloutMode(input.mode) ?? 'off';
  if (mode === 'off') {
    return { enabled: false, mode, reason: 'mode-off' };
  }
  if (mode === 'all') {
    return { enabled: true, mode, reason: 'mode-all' };
  }

  const allowlistedIds = parseInternalIds(input.internalIds);
  const isAllowlisted = Boolean(input.loginId && allowlistedIds.has(input.loginId));
  if (mode === 'internal') {
    const eligible = isAllowlisted || input.localOverride.internalOptIn;
    return {
      enabled: eligible,
      mode,
      reason: eligible ? 'internal-eligible' : 'internal-not-eligible',
    };
  }

  const key = buildRolloutKey({
    teamId: input.teamId,
    projectId: input.projectId,
    diagramId: input.diagramId,
    loginId: input.loginId,
  });
  if (!key) {
    return { enabled: false, mode, reason: 'beta-no-key' };
  }

  const betaPercent = normalizeBetaPercent(input.betaPercent);
  const bucket = Number.parseInt(djb2(key), 10) % 100;
  const enabled = bucket < betaPercent;
  return {
    enabled,
    mode,
    reason: enabled ? 'beta-eligible' : 'beta-not-eligible',
    bucket,
    betaPercent,
  };
}

/**
 * rollout key를 구성한다.
 *
 * @param scope rollout 분배 스코프
 * @returns key 문자열. 구성 불가 시 null
 */
export function buildRolloutKey(scope: {
  teamId?: string;
  projectId?: string;
  diagramId?: string;
  loginId?: string | null;
}): string | null {
  const { teamId, projectId, diagramId, loginId } = scope;
  const keyParts = [teamId, projectId, diagramId, loginId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  if (keyParts.length === 0) {
    return null;
  }
  return keyParts.join(':');
}

function normalizeRolloutMode(raw: string | null | undefined): DiffApplyRolloutMode | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'off' ||
    normalized === 'internal' ||
    normalized === 'beta' ||
    normalized === 'all'
  ) {
    return normalized;
  }
  return null;
}

function parseInternalIds(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function normalizeBetaPercent(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampPercent(raw);
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return clampPercent(parsed);
    }
  }
  return 10;
}

function clampPercent(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.floor(value);
}

function getLocalStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}
