import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DIAGRAM_WORK_MODE,
  loadDiagramWorkMode,
  saveDiagramWorkMode,
  type DiagramWorkMode,
} from '@/lib/diagram-work-mode';

interface UseDiagramWorkModeStateParams {
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
}: UseDiagramWorkModeStateParams): UseDiagramWorkModeStateResult {
  const [workMode, setWorkMode] = useState<DiagramWorkMode>(DEFAULT_DIAGRAM_WORK_MODE);
  const [workModeHydrated, setWorkModeHydrated] = useState(false);

  const handleWorkModeChange = useCallback((nextMode: DiagramWorkMode) => {
    setWorkMode(nextMode);
  }, []);

  useEffect(() => {
    setWorkModeHydrated(false);
    setWorkMode(loadDiagramWorkMode({ teamId, projectId, diagramId }));
    setWorkModeHydrated(true);
  }, [diagramId, projectId, teamId]);

  useEffect(() => {
    if (!workModeHydrated) {
      return;
    }
    saveDiagramWorkMode({ teamId, projectId, diagramId }, workMode);
  }, [diagramId, projectId, teamId, workMode, workModeHydrated]);

  return {
    workMode,
    workModeHydrated,
    handleWorkModeChange,
  };
}
