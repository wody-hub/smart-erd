import { useEffect, useRef } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import useCanvasStore from '@/stores/useCanvasStore';

/** 자동 백업 주기 (밀리초) — 5분 */
const AUTO_BACKUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 5분 주기 자동 백업 및 탭 숨김 시 즉시 백업을 수행하는 훅.
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
  /** 동시 실행 방지 뮤텍스 */
  const backupMutex = useRef(false);

  /** 자동 백업 시도 함수 — 렌더 본문에서 직접 갱신하여 항상 최신 saveMutation을 참조한다 */
  const attemptBackup = useRef<() => void>(() => {});

  // 렌더마다 최신 saveMutation 클로저로 갱신 (latest ref 패턴)
  attemptBackup.current = () => {
    if (backupMutex.current || saveMutation.isPending) {
      return;
    }
    const prepareBackup = useCanvasStore.getState().prepareBackup;
    const result = prepareBackup();
    if (!result) {
      return;
    }

    backupMutex.current = true;
    const markBackedUp = useCanvasStore.getState().markBackedUp;
    saveMutation.mutate(result.content, {
      onSuccess: () => {
        markBackedUp(result.hash);
        backupMutex.current = false;
      },
      onError: () => {
        backupMutex.current = false;
      },
    });
  };

  useEffect(() => {
    // 5분 주기 자동 백업
    const intervalId = setInterval(() => {
      attemptBackup.current();
    }, AUTO_BACKUP_INTERVAL_MS);

    // 탭 숨김 시 즉시 백업 (브라우저 throttling 대응)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        attemptBackup.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [teamId, projectId, diagramId]);
}
