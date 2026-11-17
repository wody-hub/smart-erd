import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DIAGRAM_WORK_MODE,
  loadDiagramWorkMode,
  saveDiagramWorkMode,
  type DiagramWorkMode,
} from '@/lib/diagram-work-mode';

interface UseDiagramWorkModeStateParams {
  /** 내부 투영은 저장된 모드를 읽거나 변경하지 않고 이 모드로 동작한다. */
  forcedMode?: DiagramWorkMode;
  teamId: string | undefined;
  projectId: string | undefined;
  diagramId: string | undefined;
}

interface UseDiagramWorkModeStateResult {
  workMode: DiagramWorkMode;
  workModeHydrated: boolean;
  handleWorkModeChange: (nextMode: DiagramWorkMode) => void;
}

export function useDiagramWorkModeState({
  teamId,
  projectId,
  diagramId,
  forcedMode,
}: UseDiagramWorkModeStateParams): UseDiagramWorkModeStateResult {
  const [workMode, setWorkMode] = useState<DiagramWorkMode>(DEFAULT_DIAGRAM_WORK_MODE);
  const [workModeHydrated, setWorkModeHydrated] = useState(false);

  const handleWorkModeChange = useCallback((nextMode: DiagramWorkMode) => {
    setWorkMode(nextMode);
  }, []);

  useEffect(() => {
    if (forcedMode) return;
    setWorkModeHydrated(false);
    setWorkMode(loadDiagramWorkMode({ teamId, projectId, diagramId }));
    setWorkModeHydrated(true);
  }, [diagramId, projectId, teamId, forcedMode]);

  useEffect(() => {
    if (forcedMode || !workModeHydrated) {
      return;
    }
    saveDiagramWorkMode({ teamId, projectId, diagramId }, workMode);
  }, [diagramId, projectId, teamId, workMode, workModeHydrated, forcedMode]);

  return {
    workMode: forcedMode ?? workMode,
    workModeHydrated,
    handleWorkModeChange,
  };
}
