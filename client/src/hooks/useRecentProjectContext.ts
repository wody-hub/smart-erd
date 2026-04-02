import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/constants/storage';

/** Dictionary 왕복에 사용하는 최근 프로젝트 컨텍스트. */
export interface RecentProjectContext {
  /** 팀 ID */
  teamId: string;
  /** 최근 프로젝트 ID */
  projectId: string;
  /** 기록 시각 */
  recordedAt: string;
}

interface SessionStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function logStorageWarning(action: 'set' | 'remove', error: unknown): void {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (env?.DEV === false) {
    return;
  }
  console.warn(`[useRecentProjectContext] sessionStorage ${action} failed`, error);
}

/** 팀 스코프 기준 최근 프로젝트 저장 키를 만든다. */
export function buildRecentProjectContextStorageKey(teamId?: string): string | null {
  if (!teamId) {
    return null;
  }
  return `${STORAGE_KEYS.RECENT_PROJECT_CONTEXT_PREFIX}:${teamId}`;
}

function getSessionStorage(): SessionStorageLike | null {
  const storage = (globalThis as { sessionStorage?: SessionStorageLike }).sessionStorage;
  return storage ?? null;
}

function parseRecentProjectContext(raw: string | null): RecentProjectContext | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RecentProjectContext>;
    if (
      typeof parsed.teamId !== 'string' ||
      typeof parsed.projectId !== 'string' ||
      typeof parsed.recordedAt !== 'string'
    ) {
      return null;
    }
    return {
      teamId: parsed.teamId,
      projectId: parsed.projectId,
      recordedAt: parsed.recordedAt,
    };
  } catch {
    return null;
  }
}

/** sessionStorage에서 최근 프로젝트 컨텍스트를 읽는다. */
export function loadRecentProjectContext(teamId?: string): RecentProjectContext | null {
  const key = buildRecentProjectContextStorageKey(teamId);
  const storage = getSessionStorage();
  if (!key || !storage) {
    return null;
  }
  return parseRecentProjectContext(storage.getItem(key));
}

/** sessionStorage에 최근 프로젝트 컨텍스트를 저장한다. */
export function saveRecentProjectContext(teamId: string, projectId: string): RecentProjectContext {
  const next: RecentProjectContext = {
    teamId,
    projectId,
    recordedAt: new Date().toISOString(),
  };
  const key = buildRecentProjectContextStorageKey(teamId);
  const storage = getSessionStorage();
  if (!key || !storage) {
    return next;
  }
  try {
    storage.setItem(key, JSON.stringify(next));
  } catch (error) {
    logStorageWarning('set', error);
  }
  return next;
}

/** sessionStorage에서 최근 프로젝트 컨텍스트를 제거한다. */
export function clearRecentProjectContext(teamId?: string): void {
  const key = buildRecentProjectContextStorageKey(teamId);
  const storage = getSessionStorage();
  if (!key || !storage) {
    return;
  }
  try {
    storage.removeItem(key);
  } catch (error) {
    logStorageWarning('remove', error);
  }
}

/** 팀 스코프 기준 최근 프로젝트 컨텍스트를 다루는 hook. */
export function useRecentProjectContext(teamId?: string) {
  const [recentProjectContext, setRecentProjectContext] = useState<RecentProjectContext | null>(
    () => loadRecentProjectContext(teamId),
  );

  useEffect(() => {
    setRecentProjectContext(loadRecentProjectContext(teamId));
  }, [teamId]);

  const recordRecentProjectContext = useCallback(
    (projectId: string) => {
      if (!teamId) {
        return null;
      }
      const next = saveRecentProjectContext(teamId, projectId);
      setRecentProjectContext(next);
      return next;
    },
    [teamId],
  );

  const clearStoredRecentProjectContext = useCallback(() => {
    clearRecentProjectContext(teamId);
    setRecentProjectContext(null);
  }, [teamId]);

  return {
    recentProjectContext,
    recordRecentProjectContext,
    clearRecentProjectContext: clearStoredRecentProjectContext,
  };
}
