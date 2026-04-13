import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type Konva from 'konva';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BringToFront,
  GripVertical,
  Layers,
  MousePointer2,
  Plus,
  SendToBack,
  Trash2,
} from 'lucide-react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchDiagram, fetchDiagramBootstrap } from '@/api/diagramApi';
import { fetchProject } from '@/api/projectApi';
import { fetchTeam } from '@/api/teamApi';
import ExportProgressDialog from '@/components/erd/ExportProgressDialog';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { useDocumentPageHost } from '@/collaboration/core/session/use-document-page-host';
import { SCREEN_SPEC_DOCUMENT_ENGINE_ID } from '@/collaboration/plugins/screen-spec/screen-spec-document-plugin';
import { isTextInputLikeTarget } from '@/constants/canvas-history';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import {
  SCREEN_DESIGN_GRID_STEP,
  SCREEN_DESIGN_INSTANCE_MOVE_STEP,
  SCREEN_DESIGN_INSTANCE_MOVE_STEP_LARGE,
  SCREEN_DESIGN_LIBRARY_DRAG_MIME,
} from '@/constants/screen-design';
import { cn } from '@/lib/utils';
import useThemeStore from '@/stores/useThemeStore';
import { SCREEN_SPEC_DOCUMENT_PLUGIN_ID } from '@/types/document';
import ScreenDesignEditorShell from './ScreenDesignEditorShell';
import {
  resolveScreenDesignCanvasPalette,
  type ScreenDesignCanvasPalette,
} from './screen-design-canvas-palette';
import {
  resolveScreenDesignFramePreset,
  resolveScreenDesignFramePresetIdBySize,
  type ScreenDesignFramePreset,
} from './screen-design-frame-presets';
import {
  SCREEN_DESIGN_INITIAL_SCREEN_ID,
  resolveScreenDesignLibraryCategory,
  type ScreenDesignInstance,
  type ScreenDesignLibraryItem,
} from './screen-design-document';
import { useScreenDesignDocument } from './use-screen-design-document';
import { useScreenDesignExport } from './use-screen-design-export';
import { useScreenDesignSession } from './use-screen-design-session';
import { useScreenDesignViewport } from './use-screen-design-viewport';

/**
 * 화면 CRUD와 인스턴스 배치/이동/리사이즈를 제공하는 화면기획 편집기 구현체.
 *
 * @returns 화면기획 편집기 JSX
 */
export default function ScreenDesignInteractivePage() {
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const exportStageMapRef = useRef(new Map<string, Konva.Stage>());
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const instanceNodeMapRef = useRef(new Map<string, Konva.Group>());
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [canvasDropActive, setCanvasDropActive] = useState(false);
  const [rebindMasterId, setRebindMasterId] = useState<string>('');

  const resolvedTeamId = teamId ?? '';
  const resolvedProjectId = projectId ?? '';
  const resolvedDiagramId = diagramId ?? '';
  void theme;
  const screenDesignPalette = resolveScreenDesignCanvasPalette();

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(resolvedTeamId),
    queryFn: () => fetchTeam(resolvedTeamId),
    enabled: Boolean(resolvedTeamId),
  });
  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(resolvedTeamId, resolvedProjectId),
    queryFn: () => fetchProject(resolvedTeamId, resolvedProjectId),
    enabled: Boolean(resolvedTeamId) && Boolean(resolvedProjectId),
  });
  const { documentBootstrap, documentDetail, isLoading, isError, retryDocumentSetup } =
    useDocumentPageHost({
      bootstrapQueryKey: queryKeys.diagrams.bootstrap(
        resolvedTeamId,
        resolvedProjectId,
        resolvedDiagramId,
      ),
      bootstrapQueryFn: () =>
        fetchDiagramBootstrap(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
      detailQueryKey: queryKeys.diagrams.detail(
        resolvedTeamId,
        resolvedProjectId,
        resolvedDiagramId,
      ),
      detailQueryFn: () => fetchDiagram(resolvedTeamId, resolvedProjectId, resolvedDiagramId),
      expectedPluginId: SCREEN_SPEC_DOCUMENT_PLUGIN_ID,
      expectedEngineId: SCREEN_SPEC_DOCUMENT_ENGINE_ID,
      enabled: Boolean(resolvedTeamId) && Boolean(resolvedProjectId) && Boolean(resolvedDiagramId),
    });
  const {
    collaborationReady,
    collaborationError,
    sharedDocumentEngine,
    documentMutationSession,
    projectionVersion,
    lastDocumentChangeSummary,
  } = useScreenDesignSession({
    teamId: resolvedTeamId,
    projectId: resolvedProjectId,
    diagramId: resolvedDiagramId,
    documentDetail,
    documentBootstrap,
  });
  const {
    document: screenDocument,
    selectedScreenId,
    selectedScreen,
    setSelectedScreenId,
    addScreen,
    renameScreen,
    updateScreenPreset,
    moveScreen,
    deleteScreen,
    addInstance,
    updateInstance,
    deleteInstance,
    moveInstanceLayer,
  } = useScreenDesignDocument({
    sharedDocumentEngine,
    documentMutationSession,
    projectionVersion,
  });
  const screenNavigationOptions = useMemo(
    () =>
      screenDocument.screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
      })),
    [screenDocument.screens],
  );
  const currentScreenIndex = useMemo(
    () => screenDocument.screens.findIndex((screen) => screen.id === selectedScreenId),
    [screenDocument.screens, selectedScreenId],
  );
  const canNavigatePreviousScreen = currentScreenIndex > 0;
  const canNavigateNextScreen =
    currentScreenIndex >= 0 && currentScreenIndex < screenDocument.screens.length - 1;

  const activeFramePreset = useMemo<ScreenDesignFramePreset>(() => {
    if (!selectedScreen) {
      return resolveScreenDesignFramePreset('desktop');
    }
    return {
      id: resolveScreenDesignFramePresetIdBySize(selectedScreen.width, selectedScreen.height),
      width: selectedScreen.width,
      height: selectedScreen.height,
    };
  }, [selectedScreen]);

  const {
    viewport,
    zoomIn,
    zoomOut,
    fitToFrame,
    resetToActualSize,
    handleCanvasDragMove,
    handleCanvasWheel,
  } = useScreenDesignViewport({
    stageSize,
    framePreset: activeFramePreset,
  });

  const currentInstances = useMemo(
    () => (selectedScreenId ? (screenDocument.instancesByScreenId[selectedScreenId] ?? []) : []),
    [screenDocument.instancesByScreenId, selectedScreenId],
  );
  const selectedInstance = useMemo(
    () => currentInstances.find((instance) => instance.id === selectedInstanceId) ?? null,
    [currentInstances, selectedInstanceId],
  );
  /**
   * export용 Stage ref를 화면 ID 기준으로 등록하거나 해제한다.
   *
   * @param screenId export 대상 화면 ID
   * @param stage mount/unmount 되는 Konva stage
   */
  const registerExportStage = useCallback((screenId: string, stage: Konva.Stage | null): void => {
    if (stage) {
      exportStageMapRef.current.set(screenId, stage);
      return;
    }
    exportStageMapRef.current.delete(screenId);
  }, []);
  const { exportPng, exportPdf, exportProgress } = useScreenDesignExport({
    documentName: documentDetail?.name ?? 'screen-spec',
    screens: screenDocument.screens,
    selectedScreen,
    getStage: (screenId) => exportStageMapRef.current.get(screenId) ?? null,
  });
  const libraryItemMap = useMemo(
    () => new Map(screenDocument.libraryItems.map((item) => [item.id, item])),
    [screenDocument.libraryItems],
  );
  const groupedLibraryItems = useMemo(() => {
    const groups = new Map<string, ScreenDesignLibraryItem[]>();
    screenDocument.libraryItems.forEach((item) => {
      const key = item.categoryId;
      const currentGroup = groups.get(key) ?? [];
      currentGroup.push(item);
      groups.set(key, currentGroup);
    });
    return Array.from(groups.entries());
  }, [screenDocument.libraryItems]);
  const screenInstanceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    screenDocument.screens.forEach((screen) => {
      counts.set(screen.id, screenDocument.instancesByScreenId[screen.id]?.length ?? 0);
    });
    return counts;
  }, [screenDocument.instancesByScreenId, screenDocument.screens]);
  const rebindCandidates = useMemo(
    () =>
      selectedInstance
        ? screenDocument.libraryItems.filter((item) => item.id !== selectedInstance.masterId)
        : [],
    [screenDocument.libraryItems, selectedInstance],
  );

  useEffect(() => {
    const element = stageContainerRef.current;
    if (!element) {
      return;
    }

    /**
     * stage container 크기를 Konva stage state에 반영한다.
     */
    const updateStageSize = (): void => {
      setStageSize({
        width: Math.max(element.clientWidth, 1),
        height: Math.max(element.clientHeight, 1),
      });
    };

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sharedDocumentEngine || screenDocument.screens.length > 0) {
      return;
    }
    const nextScreenId = addScreen(
      t('screenSpec.screen.defaultName', { index: screenDocument.screens.length + 1 }),
      activeFramePreset.id,
      SCREEN_DESIGN_INITIAL_SCREEN_ID,
    );
    if (nextScreenId) {
      setSelectedScreenId(nextScreenId);
    }
  }, [
    activeFramePreset.id,
    addScreen,
    screenDocument.screens.length,
    setSelectedScreenId,
    sharedDocumentEngine,
    t,
  ]);

  useEffect(() => {
    if (!selectedInstanceId) {
      return;
    }
    if (!currentInstances.some((instance) => instance.id === selectedInstanceId)) {
      setSelectedInstanceId(null);
    }
  }, [currentInstances, selectedInstanceId]);

  useEffect(() => {
    if (!selectedInstance?.isOrphan) {
      setRebindMasterId('');
      return;
    }
    const nextMasterId = screenDocument.libraryItems.find(
      (item) => item.id !== selectedInstance.masterId,
    )?.id;
    setRebindMasterId(nextMasterId ?? '');
  }, [screenDocument.libraryItems, selectedInstance]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    const selectedNode = selectedInstanceId
      ? (instanceNodeMapRef.current.get(selectedInstanceId) ?? null)
      : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [currentInstances, selectedInstanceId]);

  /**
   * 라이브러리 항목의 사용자 표시 라벨을 해석한다.
   *
   * @param item 라벨을 계산할 라이브러리 항목
   * @param fallbackId item이 없을 때 사용할 fallback ID
   * @returns 번역 또는 저장된 라벨 문자열
   */
  const resolveLibraryItemLabel = (
    item: ScreenDesignLibraryItem | undefined,
    fallbackId?: string,
  ): string => {
    if (!item) {
      return fallbackId ?? '';
    }
    return item.labelKey ? (t(item.labelKey as never) as string) : (item.label ?? item.id);
  };
  /**
   * 인스턴스의 현재 표시 라벨을 해석한다.
   *
   * @param instance 라벨을 계산할 인스턴스
   * @returns override가 반영된 라벨 문자열
   */
  const resolveInstanceLabel = (instance: ScreenDesignInstance): string =>
    instance.labelKey ? (t(instance.labelKey as never) as string) : instance.label;
  /**
   * 인스턴스가 상속받는 마스터 기본 라벨을 해석한다.
   *
   * @param instance 기준 인스턴스
   * @returns 마스터 snapshot 또는 기본 마스터 라벨
   */
  const resolveMasterDefaultLabel = (instance: ScreenDesignInstance): string =>
    instance.masterLabelKey
      ? (t(instance.masterLabelKey as never) as string)
      : instance.masterLabel;
  /**
   * 라이브러리 카테고리 ID를 번역 가능한 라벨로 변환한다.
   *
   * @param groupKey 카테고리 ID
   * @returns 카테고리 표시 라벨
   */
  const resolveLibraryCategoryLabel = (groupKey: string): string =>
    t(resolveScreenDesignLibraryCategory(groupKey).labelKey as never) as string;

  const liveStatusMessage = useMemo(() => {
    if (collaborationError) {
      return t('screenSpec.aria.connectionIssue') as string;
    }
    if (!collaborationReady) {
      return t('screenSpec.aria.connecting') as string;
    }
    if (selectedInstance && selectedScreen) {
      const selectedInstanceName = selectedInstance.labelKey
        ? (t(selectedInstance.labelKey as never) as string)
        : selectedInstance.label;
      return t('screenSpec.aria.selectedInstance', {
        screen: selectedScreen.name,
        name: selectedInstanceName,
      }) as string;
    }
    if (selectedScreen) {
      if (lastDocumentChangeSummary?.origin === 'remote') {
        return t('screenSpec.aria.remoteSync', {
          screen: selectedScreen.name,
        }) as string;
      }
      return t('screenSpec.aria.selectedScreen', {
        screen: selectedScreen.name,
        count: currentInstances.length,
      }) as string;
    }
    return t('screenSpec.aria.ready') as string;
  }, [
    collaborationError,
    collaborationReady,
    currentInstances.length,
    lastDocumentChangeSummary?.origin,
    selectedInstance,
    selectedScreen,
    t,
  ]);

  /**
   * 문서 목록 화면으로 복귀한다.
   */
  const handleBack = (): void => {
    void navigate(ROUTES.DIAGRAMS(resolvedTeamId, resolvedProjectId));
  };
  const safeAreaInset = Math.round(
    Math.min(activeFramePreset.width, activeFramePreset.height) * 0.06,
  );
  const gridLines = useMemo(() => {
    const lines: Array<{ key: string; points: number[] }> = [];
    for (let x = SCREEN_DESIGN_GRID_STEP; x < stageSize.width; x += SCREEN_DESIGN_GRID_STEP) {
      lines.push({
        key: `vertical-${x}`,
        points: [x, 0, x, stageSize.height],
      });
    }
    for (let y = SCREEN_DESIGN_GRID_STEP; y < stageSize.height; y += SCREEN_DESIGN_GRID_STEP) {
      lines.push({
        key: `horizontal-${y}`,
        points: [0, y, stageSize.width, y],
      });
    }
    return lines;
  }, [stageSize.height, stageSize.width]);

  /**
   * 현재 프레임 preset 기반의 새 화면을 추가한다.
   */
  const handleAddScreen = (): void => {
    const nextScreenId = addScreen(
      t('screenSpec.screen.defaultName', { index: screenDocument.screens.length + 1 }),
      activeFramePreset.id,
    );
    if (nextScreenId) {
      setSelectedScreenId(nextScreenId);
      setSelectedInstanceId(null);
    }
  };

  /**
   * 지정한 화면을 삭제하고 선택 상태를 정리한다.
   *
   * @param screenId 삭제할 화면 ID
   */
  const handleDeleteScreen = (screenId: string): void => {
    deleteScreen(screenId);
    if (selectedScreenId === screenId) {
      setSelectedInstanceId(null);
    }
  };
  /**
   * 선택 화면과 인스턴스 selection을 동기화한다.
   *
   * @param screenId 활성화할 화면 ID
   */
  const handleSelectScreen = useCallback(
    (screenId: string): void => {
      setSelectedScreenId(screenId);
      setSelectedInstanceId(null);
    },
    [setSelectedScreenId],
  );
  /**
   * 현재 인덱스를 기준으로 이전/다음 화면으로 이동한다.
   *
   * @param offset 이동할 상대 인덱스
   */
  const navigateScreenByOffset = useCallback(
    (offset: number): void => {
      if (screenDocument.screens.length === 0) {
        return;
      }
      const safeIndex = currentScreenIndex >= 0 ? currentScreenIndex : 0;
      const nextIndex = Math.min(
        screenDocument.screens.length - 1,
        Math.max(0, safeIndex + offset),
      );
      if (nextIndex === safeIndex) {
        return;
      }
      const nextScreen = screenDocument.screens[nextIndex];
      if (!nextScreen) {
        return;
      }
      handleSelectScreen(nextScreen.id);
    },
    [currentScreenIndex, handleSelectScreen, screenDocument.screens],
  );

  /**
   * 라이브러리 항목 drag payload를 초기화한다.
   *
   * @param event drag start 이벤트
   * @param item drag 중인 라이브러리 항목
   */
  const handleLibraryDragStart = (
    event: DragEvent<HTMLButtonElement>,
    item: ScreenDesignLibraryItem,
  ): void => {
    event.dataTransfer.setData(SCREEN_DESIGN_LIBRARY_DRAG_MIME, item.id);
    event.dataTransfer.effectAllowed = 'copy';
    setLibraryDragActive(true);
  };

  /**
   * drag 상태에 사용하던 overlay flag를 정리한다.
   */
  const handleLibraryDragEnd = (): void => {
    setLibraryDragActive(false);
    setCanvasDropActive(false);
  };

  /**
   * 유효한 라이브러리 drag가 캔버스 위에 올라오면 drop 상태를 활성화한다.
   *
   * @param event canvas drag-over 이벤트
   */
  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!selectedScreen || !event.dataTransfer.types.includes(SCREEN_DESIGN_LIBRARY_DRAG_MIME)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setCanvasDropActive(true);
  };

  /**
   * 캔버스 영역을 벗어나면 drop overlay를 해제한다.
   *
   * @param event canvas drag-leave 이벤트
   */
  const handleCanvasDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setCanvasDropActive(false);
  };

  /**
   * drag된 마스터를 현재 화면에 새 인스턴스로 배치한다.
   *
   * @param event canvas drop 이벤트
   */
  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>): void => {
    setCanvasDropActive(false);
    setLibraryDragActive(false);
    if (!selectedScreen) {
      return;
    }

    const masterId = event.dataTransfer.getData(SCREEN_DESIGN_LIBRARY_DRAG_MIME);
    const libraryItem = libraryItemMap.get(masterId);
    if (!masterId || !libraryItem || !stageContainerRef.current) {
      return;
    }

    event.preventDefault();
    const containerRect = stageContainerRef.current.getBoundingClientRect();
    const x =
      (event.clientX - containerRect.left - viewport.x) / viewport.zoom - libraryItem.width / 2;
    const y =
      (event.clientY - containerRect.top - viewport.y) / viewport.zoom - libraryItem.height / 2;
    const nextInstanceId = addInstance({
      screenId: selectedScreen.id,
      masterId,
      x,
      y,
    });
    if (nextInstanceId) {
      setSelectedInstanceId(nextInstanceId);
    }
  };

  /**
   * 배경 클릭 시 현재 인스턴스 selection을 해제한다.
   *
   * @param event Konva mouse down 이벤트
   */
  const handleCanvasMouseDown = (event: Konva.KonvaEventObject<MouseEvent>): void => {
    const targetName = event.target === event.target.getStage() ? '' : event.target.name();
    if (!targetName || targetName.includes('screen-design-background')) {
      setSelectedInstanceId(null);
    }
  };

  /**
   * 텍스트 입력 포커스 중에는 캔버스 hotkey를 비활성화해야 하는지 판별한다.
   *
   * @returns 입력 포커스 중이면 true
   */
  const shouldBypassCanvasHotkeys = (): boolean =>
    isTextInputLikeTarget(globalThis.document?.activeElement ?? null);

  useHotkeys(
    'backspace,del',
    (event) => {
      if (shouldBypassCanvasHotkeys() || !selectedInstanceId) {
        return;
      }
      event.preventDefault();
      deleteInstance(selectedInstanceId);
      setSelectedInstanceId(null);
    },
    { enabled: Boolean(selectedInstanceId) },
    [deleteInstance, selectedInstanceId],
  );

  useHotkeys(
    'tab',
    (event) => {
      if (shouldBypassCanvasHotkeys() || currentInstances.length === 0) {
        return;
      }
      event.preventDefault();
      const currentIndex = currentInstances.findIndex(
        (instance) => instance.id === selectedInstanceId,
      );
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + direction + currentInstances.length) % currentInstances.length;
      setSelectedInstanceId(currentInstances[nextIndex]?.id ?? null);
    },
    { enabled: currentInstances.length > 0 },
    [currentInstances, selectedInstanceId],
  );

  useHotkeys(
    'shift+pageup',
    (event) => {
      if (shouldBypassCanvasHotkeys()) {
        return;
      }
      event.preventDefault();
      navigateScreenByOffset(-1);
    },
    { enabled: screenDocument.screens.length > 1 },
    [navigateScreenByOffset, screenDocument.screens.length],
  );

  useHotkeys(
    'shift+pagedown',
    (event) => {
      if (shouldBypassCanvasHotkeys()) {
        return;
      }
      event.preventDefault();
      navigateScreenByOffset(1);
    },
    { enabled: screenDocument.screens.length > 1 },
    [navigateScreenByOffset, screenDocument.screens.length],
  );

  useHotkeys(
    'left,right,up,down',
    (event) => {
      if (shouldBypassCanvasHotkeys() || !selectedInstance) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey
        ? SCREEN_DESIGN_INSTANCE_MOVE_STEP_LARGE
        : SCREEN_DESIGN_INSTANCE_MOVE_STEP;
      switch (event.key) {
        case 'ArrowLeft':
          updateInstance(selectedInstance.id, { x: selectedInstance.x - step });
          break;
        case 'ArrowRight':
          updateInstance(selectedInstance.id, { x: selectedInstance.x + step });
          break;
        case 'ArrowUp':
          updateInstance(selectedInstance.id, { y: selectedInstance.y - step });
          break;
        case 'ArrowDown':
          updateInstance(selectedInstance.id, { y: selectedInstance.y + step });
          break;
      }
    },
    { enabled: Boolean(selectedInstance) },
    [selectedInstance, updateInstance],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !documentBootstrap || !documentDetail) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          workspaceContext={{
            team: team ? { id: resolvedTeamId, name: team.name } : undefined,
            project: project ? { id: resolvedProjectId, name: project.name } : undefined,
            section: 'documents',
            documentType: 'screen-spec',
          }}
        />
        <main className="workspace-shell flex-1 overflow-auto p-6">
          <div className="workspace-container max-w-5xl">
            <WorkspaceEmptyState
              icon={<AlertTriangle className="h-10 w-10" />}
              title={t('workspace.status.loadFailedTitle')}
              description={t('screenSpec.status.loadFailed')}
              tone="error"
              action={
                <Button variant="outline" onClick={() => void retryDocumentSetup()}>
                  {t('workspace.status.retry')}
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        workspaceContext={{
          team: team ? { id: resolvedTeamId, name: team.name } : undefined,
          project: project ? { id: resolvedProjectId, name: project.name } : undefined,
          section: 'documents',
          document: {
            id: resolvedDiagramId,
            name: documentDetail.name,
            type: 'screen-spec',
          },
        }}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {liveStatusMessage}
      </p>
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="workspace-shell flex min-h-0 flex-1 overflow-hidden p-4 md:p-6">
          <div className="workspace-container flex min-h-0 max-w-[1600px] flex-1">
            <ScreenDesignEditorShell
              documentName={documentDetail.name}
              collaborationReady={collaborationReady && !collaborationError}
              framePresetId={activeFramePreset.id}
              framePreset={activeFramePreset}
              viewport={viewport}
              screens={screenNavigationOptions}
              selectedScreenId={selectedScreenId}
              canNavigatePreviousScreen={canNavigatePreviousScreen}
              canNavigateNextScreen={canNavigateNextScreen}
              exportBusy={exportProgress.isExporting}
              onBack={handleBack}
              onScreenChange={handleSelectScreen}
              onNavigatePreviousScreen={() => navigateScreenByOffset(-1)}
              onNavigateNextScreen={() => navigateScreenByOffset(1)}
              onFramePresetChange={(nextPresetId) => {
                if (!selectedScreen) {
                  return;
                }
                updateScreenPreset(
                  selectedScreen.id,
                  nextPresetId as ScreenDesignFramePreset['id'],
                );
              }}
              onFitToFrame={fitToFrame}
              onResetToActualSize={resetToActualSize}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onExportPng={() => void exportPng()}
              onExportPdf={() => void exportPdf()}
              libraryPane={
                <div className="flex min-h-0 flex-1 flex-col">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {t('screenSpec.screenList.title')}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5"
                        onClick={handleAddScreen}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {t('screenSpec.screenList.add')}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {screenDocument.screens.map((screen, index) => {
                        const isActive = screen.id === selectedScreenId;
                        const instanceCount = screenInstanceCounts.get(screen.id) ?? 0;
                        return (
                          <div
                            key={screen.id}
                            className={cn(
                              'rounded-md border border-border/70 bg-background/72 px-3 py-3',
                              isActive && 'border-primary/45 bg-primary/5',
                            )}
                          >
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => handleSelectScreen(screen.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {screen.name}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {screen.width} x {screen.height}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {t('screenSpec.screenList.instanceCount', {
                                    count: instanceCount,
                                  })}
                                </span>
                              </div>
                            </button>
                            <div className="mt-3 flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={index === 0}
                                onClick={() => moveScreen(screen.id, 'up')}
                                aria-label={t('screenSpec.screenList.moveUp')}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={index === screenDocument.screens.length - 1}
                                onClick={() => moveScreen(screen.id, 'down')}
                                aria-label={t('screenSpec.screenList.moveDown')}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteScreen(screen.id)}
                                aria-label={t('screenSpec.screenList.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="mt-6 min-h-0 flex-1">
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {t('screenSpec.library.title')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('screenSpec.library.dragHint')}
                      </p>
                    </div>

                    <div className="space-y-5">
                      {groupedLibraryItems.map(([groupKey, items]) => (
                        <section key={groupKey}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {resolveLibraryCategoryLabel(groupKey)}
                          </p>
                          <div
                            role="listbox"
                            aria-label={resolveLibraryCategoryLabel(groupKey)}
                            className="space-y-2"
                          >
                            {items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                role="option"
                                draggable
                                className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-background/72 px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5"
                                onDragStart={(event) => handleLibraryDragStart(event, item)}
                                onDragEnd={handleLibraryDragEnd}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {resolveLibraryItemLabel(item)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.width} x {item.height}
                                  </p>
                                </div>
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                </div>
              }
              viewportPane={
                <div
                  ref={stageContainerRef}
                  className="relative h-full w-full cursor-grab active:cursor-grabbing"
                  onDragOver={handleCanvasDragOver}
                  onDragLeave={handleCanvasDragLeave}
                  onDrop={handleCanvasDrop}
                >
                  {stageSize.width > 0 && stageSize.height > 0 && selectedScreen ? (
                    <Stage
                      width={stageSize.width}
                      height={stageSize.height}
                      onWheel={handleCanvasWheel}
                      onMouseDown={handleCanvasMouseDown}
                    >
                      <Layer listening={false}>
                        <Rect
                          width={stageSize.width}
                          height={stageSize.height}
                          fill={screenDesignPalette.canvasBackground}
                        />
                        {gridLines.map((line) => (
                          <Line
                            key={line.key}
                            points={line.points}
                            stroke={screenDesignPalette.grid}
                            strokeWidth={1}
                            opacity={0.7}
                          />
                        ))}
                      </Layer>

                      <Layer>
                        <Group
                          x={viewport.x}
                          y={viewport.y}
                          scaleX={viewport.zoom}
                          scaleY={viewport.zoom}
                          draggable
                          onDragMove={handleCanvasDragMove}
                        >
                          <Rect
                            x={-220}
                            y={-220}
                            width={selectedScreen.width + 440}
                            height={selectedScreen.height + 440}
                            fill={screenDesignPalette.canvasBackground}
                            opacity={0.001}
                            name="screen-design-background"
                          />
                          <Rect
                            x={-18}
                            y={-18}
                            width={selectedScreen.width + 36}
                            height={selectedScreen.height + 36}
                            fill={screenDesignPalette.frameShadow}
                            opacity={0.64}
                            cornerRadius={18}
                            name="screen-design-background"
                          />
                          <Rect
                            width={selectedScreen.width}
                            height={selectedScreen.height}
                            fill={screenDesignPalette.frameFill}
                            stroke={screenDesignPalette.frameStroke}
                            strokeWidth={1}
                            cornerRadius={12}
                            name="screen-design-background"
                          />
                          <Rect
                            x={safeAreaInset}
                            y={safeAreaInset}
                            width={selectedScreen.width - safeAreaInset * 2}
                            height={selectedScreen.height - safeAreaInset * 2}
                            stroke={screenDesignPalette.safeArea}
                            strokeWidth={1}
                            dash={[12, 10]}
                            cornerRadius={10}
                            name="screen-design-background"
                          />
                          {currentInstances.length === 0 ? (
                            <Text
                              x={selectedScreen.width / 2 - 150}
                              y={selectedScreen.height / 2 - 18}
                              width={300}
                              align="center"
                              text={t('screenSpec.canvas.emptyState')}
                              fontSize={16}
                              fill={screenDesignPalette.accentMuted}
                              listening={false}
                            />
                          ) : null}
                          {currentInstances.map((instance) => {
                            const selected = instance.id === selectedInstanceId;
                            return (
                              <Group
                                key={instance.id}
                                x={instance.x}
                                y={instance.y}
                                draggable
                                name="screen-design-instance"
                                ref={(node) => {
                                  if (node) {
                                    instanceNodeMapRef.current.set(instance.id, node);
                                  } else {
                                    instanceNodeMapRef.current.delete(instance.id);
                                  }
                                }}
                                onMouseDown={(event) => {
                                  event.cancelBubble = true;
                                  setSelectedInstanceId(instance.id);
                                }}
                                onTap={(event) => {
                                  event.cancelBubble = true;
                                  setSelectedInstanceId(instance.id);
                                }}
                                onDragStart={(event) => {
                                  event.cancelBubble = true;
                                  setSelectedInstanceId(instance.id);
                                }}
                                onDragEnd={(event) => {
                                  updateInstance(instance.id, {
                                    x: event.target.x(),
                                    y: event.target.y(),
                                  });
                                }}
                                onTransformEnd={(event) => {
                                  const node = event.target;
                                  const nextWidth = instance.width * node.scaleX();
                                  const nextHeight = instance.height * node.scaleY();
                                  node.scaleX(1);
                                  node.scaleY(1);
                                  updateInstance(instance.id, {
                                    x: node.x(),
                                    y: node.y(),
                                    width: nextWidth,
                                    height: nextHeight,
                                  });
                                }}
                              >
                                {renderLibraryInstance({
                                  instance,
                                  label: resolveInstanceLabel(instance),
                                  palette: screenDesignPalette,
                                  selected,
                                })}
                              </Group>
                            );
                          })}
                          <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            keepRatio={false}
                            borderStroke={screenDesignPalette.selection}
                            anchorFill={screenDesignPalette.anchorFill}
                            anchorStroke={screenDesignPalette.selection}
                            borderDash={[6, 4]}
                            boundBoxFunc={(_oldBox, newBox) => ({
                              ...newBox,
                              width: Math.max(72, Math.abs(newBox.width)),
                              height: Math.max(56, Math.abs(newBox.height)),
                            })}
                          />
                        </Group>
                      </Layer>
                    </Stage>
                  ) : null}

                  {libraryDragActive && selectedScreen ? (
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity',
                        canvasDropActive ? 'opacity-100' : 'opacity-0',
                      )}
                    >
                      <div className="rounded-md border border-border/70 bg-background/95 px-4 py-3 text-sm text-foreground shadow-sm">
                        {t('screenSpec.canvas.dropHint')}
                      </div>
                    </div>
                  ) : null}

                  {!collaborationReady ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/38">
                      <div className="flex items-center gap-3 rounded-md border border-border/70 bg-background/95 px-4 py-3 text-sm text-foreground shadow-sm">
                        <Spinner />
                        <span>
                          {collaborationError
                            ? t('workspace.status.retry')
                            : t('screenSpec.status.connecting')}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              }
              inspectorPane={
                <div className="space-y-5">
                  <section>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t('screenSpec.inspector.title')}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="screen-spec-screen-name">
                          {t('screenSpec.inspector.screen')}
                        </Label>
                        <Input
                          id="screen-spec-screen-name"
                          aria-label={t('screenSpec.inspector.screen')}
                          className="mt-2"
                          value={selectedScreen?.name ?? ''}
                          onChange={(event) => {
                            if (!selectedScreen) {
                              return;
                            }
                            renameScreen(selectedScreen.id, event.target.value);
                          }}
                          placeholder={t('screenSpec.screenList.namePlaceholder')}
                        />
                      </div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">
                            {t('screenSpec.inspector.frame')}
                          </dt>
                          <dd className="font-medium text-foreground">
                            {t(`screenSpec.framePreset.${activeFramePreset.id}.label`)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">
                            {t('screenSpec.inspector.size')}
                          </dt>
                          <dd className="font-medium text-foreground">
                            {selectedScreen
                              ? `${selectedScreen.width} x ${selectedScreen.height}`
                              : '-'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">
                            {t('screenSpec.inspector.status')}
                          </dt>
                          <dd className="font-medium text-foreground">
                            {collaborationReady && !collaborationError
                              ? t('screenSpec.status.ready')
                              : t('screenSpec.status.connecting')}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section className="border-t border-border/70 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t('screenSpec.inspector.selection')}
                    </p>
                    {selectedInstance ? (
                      <div className="space-y-3">
                        {selectedInstance.isOrphan ? (
                          <div className="rounded-md border border-amber-300/80 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium">{t('screenSpec.orphan.title')}</p>
                                <p className="mt-1 text-xs leading-5 text-amber-800/90 dark:text-amber-100/80">
                                  {t('screenSpec.orphan.description')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-md border border-border/70 bg-background/72 px-3 py-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                            <span>{resolveInstanceLabel(selectedInstance)}</span>
                          </div>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-muted-foreground">
                                {t('screenSpec.inspector.position')}
                              </dt>
                              <dd className="font-medium text-foreground">
                                {Math.round(selectedInstance.x)}, {Math.round(selectedInstance.y)}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-muted-foreground">
                                {t('screenSpec.inspector.size')}
                              </dt>
                              <dd className="font-medium text-foreground">
                                {Math.round(selectedInstance.width)} x{' '}
                                {Math.round(selectedInstance.height)}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-muted-foreground">
                                {t('screenSpec.inspector.masterDefault')}
                              </dt>
                              <dd className="font-medium text-foreground">
                                {resolveMasterDefaultLabel(selectedInstance)}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="space-y-3 rounded-md border border-border/70 bg-background/72 px-3 py-3">
                          <div>
                            <Label htmlFor="screen-spec-instance-label">
                              {t('screenSpec.inspector.labelOverride')}
                            </Label>
                            <Input
                              id="screen-spec-instance-label"
                              aria-label={t('screenSpec.inspector.labelOverride')}
                              className="mt-2"
                              value={
                                selectedInstance.overrideState.label ? selectedInstance.label : ''
                              }
                              placeholder={resolveMasterDefaultLabel(selectedInstance)}
                              onChange={(event) =>
                                updateInstance(selectedInstance.id, {
                                  label: event.target.value.trim() || null,
                                })
                              }
                            />
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span>
                                {selectedInstance.overrideState.label
                                  ? t('screenSpec.inspector.overrideStatus.overridden')
                                  : t('screenSpec.inspector.overrideStatus.inherited')}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => updateInstance(selectedInstance.id, { label: null })}
                                disabled={!selectedInstance.overrideState.label}
                              >
                                {t('screenSpec.inspector.resetLabel')}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="screen-spec-instance-accent">
                              {t('screenSpec.inspector.accentColor')}
                            </Label>
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                id="screen-spec-instance-accent"
                                aria-label={t('screenSpec.inspector.accentColor')}
                                type="color"
                                className="h-10 w-16 p-1"
                                value={
                                  selectedInstance.accentColor ??
                                  selectedInstance.masterAccentColor ??
                                  screenDesignPalette.surfaceStrokeHex
                                }
                                onChange={(event) =>
                                  updateInstance(selectedInstance.id, {
                                    accentColor: event.target.value,
                                  })
                                }
                              />
                              <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                                {selectedInstance.overrideState.accentColor
                                  ? t('screenSpec.inspector.overrideStatus.overridden')
                                  : t('screenSpec.inspector.overrideStatus.inherited')}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() =>
                                  updateInstance(selectedInstance.id, { accentColor: null })
                                }
                                disabled={!selectedInstance.overrideState.accentColor}
                              >
                                {t('screenSpec.inspector.resetColor')}
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                            <span>
                              {selectedInstance.overrideState.width ||
                              selectedInstance.overrideState.height
                                ? t('screenSpec.inspector.overrideStatus.overridden')
                                : t('screenSpec.inspector.overrideStatus.inherited')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() =>
                                updateInstance(selectedInstance.id, {
                                  width: null,
                                  height: null,
                                })
                              }
                              disabled={
                                !selectedInstance.overrideState.width &&
                                !selectedInstance.overrideState.height
                              }
                            >
                              {t('screenSpec.inspector.resetSize')}
                            </Button>
                          </div>
                        </div>

                        {selectedInstance.isOrphan ? (
                          <div className="space-y-3 rounded-md border border-border/70 bg-background/72 px-3 py-3">
                            <div>
                              <Label htmlFor="screen-spec-orphan-rebind">
                                {t('screenSpec.orphan.rebindLabel')}
                              </Label>
                              <Select value={rebindMasterId} onValueChange={setRebindMasterId}>
                                <SelectTrigger
                                  id="screen-spec-orphan-rebind"
                                  className="mt-2"
                                  aria-label={t('screenSpec.orphan.rebindLabel')}
                                >
                                  <SelectValue
                                    placeholder={t('screenSpec.orphan.rebindPlaceholder')}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {rebindCandidates.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {resolveLibraryItemLabel(item, item.id)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              disabled={!rebindMasterId}
                              onClick={() => {
                                if (!rebindMasterId) {
                                  return;
                                }
                                updateInstance(selectedInstance.id, { masterId: rebindMasterId });
                              }}
                            >
                              {t('screenSpec.orphan.rebindAction')}
                            </Button>
                          </div>
                        ) : null}

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {t('screenSpec.inspector.layers')}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() =>
                                selectedScreen &&
                                moveInstanceLayer(selectedScreen.id, selectedInstance.id, 'front')
                              }
                            >
                              <BringToFront className="mr-1 h-4 w-4" />
                              {t('screenSpec.inspector.bringToFront')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() =>
                                selectedScreen &&
                                moveInstanceLayer(selectedScreen.id, selectedInstance.id, 'back')
                              }
                            >
                              <SendToBack className="mr-1 h-4 w-4" />
                              {t('screenSpec.inspector.sendToBack')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() =>
                                selectedScreen &&
                                moveInstanceLayer(selectedScreen.id, selectedInstance.id, 'forward')
                              }
                            >
                              <Layers className="mr-1 h-4 w-4" />
                              {t('screenSpec.inspector.bringForward')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              onClick={() =>
                                selectedScreen &&
                                moveInstanceLayer(
                                  selectedScreen.id,
                                  selectedInstance.id,
                                  'backward',
                                )
                              }
                            >
                              <Layers className="mr-1 h-4 w-4" />
                              {t('screenSpec.inspector.sendBackward')}
                            </Button>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start text-destructive hover:text-destructive"
                          onClick={() => {
                            deleteInstance(selectedInstance.id);
                            setSelectedInstanceId(null);
                          }}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          {t('screenSpec.inspector.deleteSelection')}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                        {t('screenSpec.inspector.selectionEmpty')}
                      </div>
                    )}
                  </section>

                  <section className="border-t border-border/70 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t('screenSpec.inspector.view')}
                    </p>
                    <dl className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{t('screenSpec.inspector.zoom')}</dt>
                        <dd className="font-medium text-foreground">
                          {Math.round(viewport.zoom * 100)}%
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">
                          {t('screenSpec.inspector.offsetX')}
                        </dt>
                        <dd className="font-medium text-foreground">{Math.round(viewport.x)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">
                          {t('screenSpec.inspector.offsetY')}
                        </dt>
                        <dd className="font-medium text-foreground">{Math.round(viewport.y)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 rounded-md border border-border/70 bg-background/72 px-3 py-3 text-xs text-muted-foreground">
                      {t('screenSpec.inspector.keyboardHint')}
                    </div>
                  </section>
                </div>
              }
            />
          </div>
        </div>
      </main>
      <ExportProgressDialog
        progress={exportProgress}
        actionLabel={t('screenSpec.toolbar.export')}
        stepLabels={{
          preparing: t('screenSpec.export.progress.stepPreparing'),
          rendering: t('screenSpec.export.progress.stepRendering'),
          finalizing: t('screenSpec.export.progress.stepFinalizing'),
          downloading: t('screenSpec.export.progress.stepDownloading'),
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-[100000px] top-0 h-0 w-0 overflow-hidden opacity-0"
      >
        {screenDocument.screens.map((screen) => (
          <ScreenDesignExportStage
            key={`screen-export-${screen.id}`}
            palette={screenDesignPalette}
            screen={screen}
            instances={screenDocument.instancesByScreenId[screen.id] ?? []}
            resolveInstanceLabel={resolveInstanceLabel}
            registerStage={registerExportStage}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 인스턴스 renderKind에 맞는 wireframe Konva primitive를 렌더링한다.
 *
 * @param args 렌더링에 필요한 인스턴스/라벨/팔레트/선택 상태
 * @returns Konva shape fragment
 */
function renderLibraryInstance({
  instance,
  label,
  palette,
  selected,
}: {
  instance: ScreenDesignInstance;
  label: string;
  palette: ScreenDesignCanvasPalette;
  selected: boolean;
}) {
  const stroke = selected
    ? palette.selection
    : instance.isOrphan
      ? palette.orphan
      : (instance.accentColor ?? palette.surfaceStroke);
  const strokeWidth = selected ? 2 : 1;
  const titleColor = selected ? palette.selection : (instance.accentColor ?? palette.accentInk);

  switch (instance.renderKind) {
    case 'topBar':
      return (
        <>
          <Rect
            width={instance.width}
            height={instance.height}
            fill={palette.accentPrimary}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={12}
          />
          <CircleRow count={3} x={20} y={22} spacing={18} radius={4} fill={palette.accentMuted} />
          <Rect
            x={instance.width / 2 - 70}
            y={18}
            width={140}
            height={16}
            fill={palette.surfaceFill}
            cornerRadius={8}
          />
          <Rect
            x={instance.width - 84}
            y={18}
            width={52}
            height={18}
            fill={palette.surfaceFill}
            cornerRadius={9}
          />
          <Text x={20} y={instance.height - 34} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    case 'sideRail':
      return (
        <>
          <Rect
            width={instance.width}
            height={instance.height}
            fill={palette.accentSecondary}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={14}
          />
          <Rect
            x={18}
            y={18}
            width={instance.width - 36}
            height={22}
            fill={palette.surfaceFill}
            cornerRadius={10}
          />
          {Array.from({ length: 5 }).map((_, index) => (
            <Rect
              key={`rail-row-${index}`}
              x={18}
              y={62 + index * 58}
              width={instance.width - 36}
              height={38}
              fill={index % 2 === 0 ? palette.accentPrimary : palette.surfaceFill}
              cornerRadius={12}
            />
          ))}
          <Text x={18} y={instance.height - 32} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    case 'bottomTabs':
      return (
        <>
          <Rect
            width={instance.width}
            height={instance.height}
            fill={palette.accentPrimary}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={12}
          />
          {Array.from({ length: 4 }).map((_, index) => (
            <Group key={`tab-${index}`} x={20 + index * ((instance.width - 40) / 4)} y={18}>
              <Rect width={42} height={18} fill={palette.surfaceFill} cornerRadius={9} />
              <Rect
                y={30}
                width={54}
                height={10}
                fill={palette.accentMuted}
                opacity={0.6}
                cornerRadius={5}
              />
            </Group>
          ))}
          <Text x={20} y={instance.height - 28} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    case 'cardList':
      return (
        <>
          <SurfaceCard
            instance={instance}
            palette={palette}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <Rect
            x={20}
            y={18}
            width={instance.width - 40}
            height={18}
            fill={palette.accentPrimary}
            cornerRadius={9}
          />
          {Array.from({ length: 3 }).map((_, index) => (
            <Group key={`card-${index}`} x={20} y={54 + index * 70}>
              <Rect
                width={instance.width - 40}
                height={56}
                fill={palette.accentTertiary}
                cornerRadius={14}
              />
              <Rect
                x={14}
                y={12}
                width={72}
                height={10}
                fill={palette.surfaceFill}
                cornerRadius={5}
              />
              <Rect
                x={14}
                y={30}
                width={instance.width - 108}
                height={8}
                fill={palette.surfaceFill}
                opacity={0.85}
                cornerRadius={4}
              />
            </Group>
          ))}
          <Text x={20} y={instance.height - 28} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    case 'formStack':
      return (
        <>
          <SurfaceCard
            instance={instance}
            palette={palette}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          {Array.from({ length: 4 }).map((_, index) => (
            <Group key={`field-${index}`} x={20} y={24 + index * 58}>
              <Rect
                width={96}
                height={10}
                fill={palette.accentMuted}
                opacity={0.5}
                cornerRadius={5}
              />
              <Rect
                y={18}
                width={instance.width - 40}
                height={26}
                fill={palette.accentQuaternary}
                cornerRadius={10}
              />
            </Group>
          ))}
          <Rect
            x={20}
            y={instance.height - 58}
            width={Math.min(140, instance.width - 40)}
            height={30}
            fill={palette.accentPrimary}
            cornerRadius={12}
          />
          <Text x={20} y={instance.height - 86} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    case 'detailPane':
      return (
        <>
          <SurfaceCard
            instance={instance}
            palette={palette}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <Rect
            x={20}
            y={20}
            width={instance.width - 40}
            height={112}
            fill={palette.accentTertiary}
            cornerRadius={16}
          />
          <Rect
            x={20}
            y={148}
            width={instance.width - 40}
            height={14}
            fill={palette.accentPrimary}
            cornerRadius={7}
          />
          <Rect
            x={20}
            y={176}
            width={instance.width - 40}
            height={14}
            fill={palette.accentPrimary}
            opacity={0.8}
            cornerRadius={7}
          />
          <Rect
            x={20}
            y={206}
            width={(instance.width - 52) / 2}
            height={instance.height - 236}
            fill={palette.accentQuaternary}
            cornerRadius={14}
          />
          <Rect
            x={32 + (instance.width - 52) / 2}
            y={206}
            width={(instance.width - 52) / 2}
            height={instance.height - 236}
            fill={palette.accentPrimary}
            cornerRadius={14}
          />
          <Text x={20} y={instance.height - 28} text={label} fontSize={14} fill={titleColor} />
        </>
      );
    default:
      return (
        <>
          <SurfaceCard
            instance={instance}
            palette={palette}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <Text
            x={20}
            y={instance.height / 2 - 10}
            width={Math.max(0, instance.width - 40)}
            align="center"
            text={label}
            fontSize={16}
            fill={titleColor}
          />
        </>
      );
  }
}

/**
 * export용 숨김 Stage를 렌더링하고 stage ref를 등록한다.
 *
 * @param props export 대상 화면/인스턴스와 팔레트 정보
 * @returns 숨김 export stage JSX
 */
function ScreenDesignExportStage({
  palette,
  screen,
  instances,
  resolveInstanceLabel,
  registerStage,
}: {
  palette: ScreenDesignCanvasPalette;
  screen: {
    id: string;
    width: number;
    height: number;
  };
  instances: ScreenDesignInstance[];
  resolveInstanceLabel: (instance: ScreenDesignInstance) => string;
  registerStage: (screenId: string, stage: Konva.Stage | null) => void;
}) {
  const safeAreaInset = Math.round(Math.min(screen.width, screen.height) * 0.06);

  return (
    <Stage
      width={screen.width}
      height={screen.height}
      ref={(node) => registerStage(screen.id, node)}
    >
      <Layer listening={false}>
        <Rect
          width={screen.width}
          height={screen.height}
          fill={palette.frameFill}
          stroke={palette.frameStroke}
          strokeWidth={1}
          cornerRadius={12}
        />
        <Rect
          x={safeAreaInset}
          y={safeAreaInset}
          width={screen.width - safeAreaInset * 2}
          height={screen.height - safeAreaInset * 2}
          stroke={palette.safeArea}
          strokeWidth={1}
          dash={[12, 10]}
          cornerRadius={10}
        />
        {instances.map((instance) => (
          <Group key={instance.id} x={instance.x} y={instance.y} listening={false}>
            {renderLibraryInstance({
              instance,
              label: resolveInstanceLabel(instance),
              palette,
              selected: false,
            })}
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}

/**
 * 공통 카드 컨테이너 배경과 그림자를 렌더링한다.
 *
 * @param props 카드 크기와 stroke/palette 정보
 * @returns 카드 배경 Rect
 */
function SurfaceCard({
  instance,
  palette,
  stroke,
  strokeWidth,
}: {
  instance: ScreenDesignInstance;
  palette: ScreenDesignCanvasPalette;
  stroke: string;
  strokeWidth: number;
}) {
  return (
    <Rect
      width={instance.width}
      height={instance.height}
      fill={palette.surfaceFill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      cornerRadius={16}
      shadowColor={palette.shadowColor}
      shadowBlur={10}
      shadowOffset={{ x: 0, y: 4 }}
      shadowOpacity={0.14}
    />
  );
}

/**
 * 작은 원형 indicator row를 사각형 primitive로 렌더링한다.
 *
 * @param props indicator 개수와 위치/색상 정보
 * @returns indicator row fragment
 */
function CircleRow({
  count,
  x,
  y,
  spacing,
  radius,
  fill,
}: {
  count: number;
  x: number;
  y: number;
  spacing: number;
  radius: number;
  fill: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Rect
          key={`circle-${index}`}
          x={x + index * spacing}
          y={y}
          width={radius * 2}
          height={radius * 2}
          fill={fill}
          cornerRadius={radius}
        />
      ))}
    </>
  );
}
