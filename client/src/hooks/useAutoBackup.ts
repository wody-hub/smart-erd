import { useEffect, useRef } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import useCanvasStore from '@/stores/erd/useCanvasStore';

/** 자동 백업 주기 (밀리초) — 60초 */
const AUTO_BACKUP_INTERVAL_MS = 60 * 1000;
/** 변경 후 유휴 백업 대기 시간 (밀리초) — 10초 */
const AUTO_BACKUP_IDLE_MS = 10 * 1000;
/** p95 산출을 위한 최근 성공 지연 샘플 최대 개수 */
const AUTOSAVE_LATENCY_SAMPLE_LIMIT = 200;

/** 자동 백업 트리거 유형 */
type AutoBackupTrigger =
  | 'interval'
  | 'idle'
  | 'visibility-hidden'
  | 'pagehide'
  | 'beforeunload'
  | 'cleanup';

/** 자동 백업 스킵 사유 */
type AutoBackupSkipReason = 'pending' | 'mutex' | 'unchanged' | 'no-local-change';

/** 자동 백업 메트릭 누적 상태 */
interface AutoBackupMetricsState {
  attempts: number;
  successes: number;
  failures: number;
  skipCounts: Record<AutoBackupSkipReason, number>;
  successLatenciesMs: number[];
}

/**
 * 성공 지연 샘플 목록에 새 값을 추가한다.
 *
 * @param samples 기존 샘플 목록
 * @param latencyMs 추가할 지연(ms)
 * @returns 상한이 유지된 새 샘플 목록
 */
function appendLatencySample(samples: number[], latencyMs: number): number[] {
  if (samples.length < AUTOSAVE_LATENCY_SAMPLE_LIMIT) {
    return [...samples, latencyMs];
  }
  return [...samples.slice(1), latencyMs];
}

/**
 * 샘플 목록의 p95 지연(ms)을 계산한다.
 *
 * @param samples 지연 샘플 목록
 * @returns p95 값(ms), 샘플이 없으면 null
 */
function calculateLatencyP95(samples: number[]): number | null {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[Math.max(0, rank)] ?? null;
}

/**
 * 자동 백업 메트릭을 콘솔에 기록한다.
 *
 * @param event   메트릭 이벤트 유형
 * @param trigger 트리거 유형
 * @param metrics 누적 메트릭 상태
 * @param extra   추가 필드
 * @returns 없음
 */
function logAutosaveMetrics(
  event: 'skip' | 'success' | 'failure',
  trigger: AutoBackupTrigger,
  metrics: AutoBackupMetricsState,
  extra: Record<string, unknown> = {},
): void {
  const completed = metrics.successes + metrics.failures;
  const successRate = completed === 0 ? 1 : metrics.successes / completed;
  const latencyP95 = calculateLatencyP95(metrics.successLatenciesMs);
  const totalSkipCount =
    metrics.skipCounts.pending +
    metrics.skipCounts.mutex +
    metrics.skipCounts.unchanged +
    metrics.skipCounts['no-local-change'];

  console.info('[autosave-metrics]', {
    event,
    trigger,
    autosave_success_rate: Number((successRate * 100).toFixed(2)),
    autosave_latency_p95: latencyP95 == null ? null : Math.round(latencyP95),
    autosave_skip_count: {
      pending: metrics.skipCounts.pending,
      mutex: metrics.skipCounts.mutex,
      unchanged: metrics.skipCounts.unchanged,
      noLocalChange: metrics.skipCounts['no-local-change'],
      total: totalSkipCount,
    },
    attempts: metrics.attempts,
    successes: metrics.successes,
    failures: metrics.failures,
    ...extra,
  });
}

/**
 * 60초 주기 자동 백업, 변경 후 idle 10초 백업, 탭 이탈 시 즉시 백업을 수행하는 훅.
 *
 * 변경이 없으면 백업을 생략하고, 수동 백업(saveMutation) 진행 중이면 자동 백업을 건너뛴다.
 * 자동 백업 성공 시 토스트 없이 해시만 갱신한다.
 *
 * @param saveMutation saveDiagram 뮤테이션 결과
 * @param teamId       팀 ID
 * @param projectId    프로젝트 ID
 * @param diagramId    다이어그램 ID
 */
export function useAutoBackup(
  saveMutation: UseMutationResult<void, Error, string>,
  teamId: string,
  projectId: string,
  diagramId: string,
): void {
  const ydoc = useCanvasStore((s) => s.ydoc);
  /** 동시 실행 방지 뮤텍스 */
  const backupMutex = useRef(false);
  /** 최근 저장 이후 로컬(비-remote origin) 변경 발생 여부 */
  const hasLocalChangeRef = useRef(false);
  /** idle 트리거 타이머 */
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 자동 백업 메트릭 누적 상태 */
  const metricsRef = useRef<AutoBackupMetricsState>({
    attempts: 0,
    successes: 0,
    failures: 0,
    skipCounts: {
      pending: 0,
      mutex: 0,
      unchanged: 0,
      'no-local-change': 0,
    },
    successLatenciesMs: [],
  });

  /** 자동 백업 시도 함수 — 렌더 본문에서 직접 갱신하여 항상 최신 saveMutation을 참조한다 */
  const attemptBackup = useRef<(trigger: AutoBackupTrigger) => void>(() => {});

  // 렌더마다 최신 saveMutation 클로저로 갱신 (latest ref 패턴)
  attemptBackup.current = (trigger) => {
    if (backupMutex.current) {
      metricsRef.current.skipCounts.mutex += 1;
      logAutosaveMetrics('skip', trigger, metricsRef.current, { reason: 'mutex' });
      return;
    }
    if (saveMutation.isPending) {
      metricsRef.current.skipCounts.pending += 1;
      logAutosaveMetrics('skip', trigger, metricsRef.current, { reason: 'pending' });
      return;
    }
    if (!hasLocalChangeRef.current) {
      metricsRef.current.skipCounts['no-local-change'] += 1;
      logAutosaveMetrics('skip', trigger, metricsRef.current, { reason: 'no-local-change' });
      return;
    }
    const prepareBackup = useCanvasStore.getState().prepareBackup;
    const result = prepareBackup();
    if (!result) {
      // 마지막 저장 직후/수동 저장 직후처럼 더 이상 미저장 로컬 변경이 없으면 플래그를 내린다.
      hasLocalChangeRef.current = false;
      metricsRef.current.skipCounts.unchanged += 1;
      logAutosaveMetrics('skip', trigger, metricsRef.current, { reason: 'unchanged' });
      return;
    }

    metricsRef.current.attempts += 1;
    const startedAt = performance.now();
    backupMutex.current = true;
    const markBackedUp = useCanvasStore.getState().markBackedUp;
    saveMutation.mutate(result.content, {
      onSuccess: () => {
        const latencyMs = performance.now() - startedAt;
        metricsRef.current.successes += 1;
        metricsRef.current.successLatenciesMs = appendLatencySample(
          metricsRef.current.successLatenciesMs,
          latencyMs,
        );
        markBackedUp(result.hash);
        hasLocalChangeRef.current = false;
        backupMutex.current = false;
        logAutosaveMetrics('success', trigger, metricsRef.current, {
          latencyMs: Math.round(latencyMs),
        });
      },
      onError: (error) => {
        const latencyMs = performance.now() - startedAt;
        metricsRef.current.failures += 1;
        backupMutex.current = false;
        console.warn('[autosave-metrics] autosave-failed', error);
        logAutosaveMetrics('failure', trigger, metricsRef.current, {
          latencyMs: Math.round(latencyMs),
        });
      },
    });
  };

  useEffect(() => {
    hasLocalChangeRef.current = false;

    /**
     * 등록된 idle 타이머를 해제한다.
     *
     * @returns 없음
     */
    const clearIdleTimer = () => {
      if (!idleTimerRef.current) {
        return;
      }
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    };

    /**
     * 마지막 변경 후 유휴 구간에 백업을 예약한다.
     *
     * @returns 없음
     */
    const scheduleIdleBackup = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        attemptBackup.current('idle');
      }, AUTO_BACKUP_IDLE_MS);
    };

    // 60초 주기 자동 백업
    const intervalId = setInterval(() => {
      attemptBackup.current('interval');
    }, AUTO_BACKUP_INTERVAL_MS);

    /**
     * 탭 숨김 시 백업을 즉시 시도한다.
     *
     * @returns 없음
     */
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        attemptBackup.current('visibility-hidden');
      }
    };

    /**
     * 페이지 이탈(pagehide) 시 마지막 백업을 시도한다.
     *
     * @returns 없음
     */
    const handlePageHide = () => {
      attemptBackup.current('pagehide');
    };

    /**
     * beforeunload 시 마지막 백업을 시도한다.
     *
     * @returns 없음
     */
    const handleBeforeUnload = () => {
      attemptBackup.current('beforeunload');
    };

    /**
     * Y.Doc 업데이트를 감지해 로컬 변경만 idle 백업 대상으로 표시한다.
     *
     * @param _update Yjs 업데이트 페이로드
     * @param origin  업데이트 origin (remote면 원격 반영)
     * @returns 없음
     */
    const handleYDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') {
        return;
      }
      hasLocalChangeRef.current = true;
      scheduleIdleBackup();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    ydoc?.on('update', handleYDocUpdate);

    return () => {
      attemptBackup.current('cleanup');
      clearIdleTimer();
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      ydoc?.off('update', handleYDocUpdate);
    };
  }, [teamId, projectId, diagramId, ydoc]);
}
