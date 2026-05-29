import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ExportProgressDialog from '@/components/erd/ExportProgressDialog';
import Header from '@/components/layout/Header';
import { ROUTES } from '@/constants/routes';
import useThemeStore from '@/stores/useThemeStore';
import ScreenDesignCanvas from './ScreenDesignCanvas';
import ScreenDesignEditorShell from './ScreenDesignEditorShell';
import ScreenDesignInspector from './ScreenDesignInspector';
import ScreenDesignLibrary from './ScreenDesignLibrary';
import {
  ScreenDesignPageLoadErrorState,
  ScreenDesignPageLoadingState,
} from './ScreenDesignPageState';
import { resolveScreenDesignCanvasPalette } from './screen-design-canvas-palette';
import { ScreenDesignExportStage } from './screen-design-instance-renderer';
import {
  resolveScreenDesignFramePreset,
  resolveScreenDesignFramePresetIdBySize,
  type ScreenDesignFramePreset,
} from './screen-design-frame-presets';
import {
  SCREEN_DESIGN_INITIAL_SCREEN_ID,
  type ScreenDesignInstance,
  type ScreenDesignLibraryItem,
} from './screen-design-document';
import { resolveScreenDesignInstanceLabel } from './screen-design-labels';
import { useScreenDesignCanvasController } from './use-screen-design-canvas-controller';
import { useScreenDesignExport } from './use-screen-design-export';
import { useScreenDesignHotkeys } from './use-screen-design-hotkeys';
import { useScreenDesignInteractivePageData } from './use-screen-design-interactive-page-data';

/**
 * 화면기획 협업 에디터 페이지를 렌더링한다.
 *
 * @returns 화면기획 에디터 페이지 JSX
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
  const exportStageMapRef = useRef(new Map<string, Konva.Stage>());
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [rebindMasterId, setRebindMasterId] = useState('');

  const resolvedTeamId = teamId ?? '';
  const resolvedProjectId = projectId ?? '';
  const resolvedDiagramId = diagramId ?? '';
  const screenDesignPalette = useMemo(() => resolveScreenDesignCanvasPalette(theme), [theme]);

  const {
    team,
    project,
    documentBootstrap,
    documentDetail,
    isLoading,
    isError,
    retryDocumentSetup,
    collaborationReady,
    collaborationError,
    sharedDocumentEngine,
    savePending,
    handleSave,
    lastDocumentChangeSummary,
    document: screenDocument,
    collaborationRuntimeStatus,
    selectedScreenId,
    selectedScreen,
    setSelectedScreenId,
    addScreen,
    renameScreen,
    updateScreenPreset,
    moveScreen,
    deleteScreen,
    addMaster,
    updateMaster,
    deleteMaster,
    addInstance,
    updateInstance,
    deleteInstance,
    moveInstanceLayer,
  } = useScreenDesignInteractivePageData({
    teamId: resolvedTeamId,
    projectId: resolvedProjectId,
    diagramId: resolvedDiagramId,
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

  const currentInstances = useMemo(
    () => (selectedScreenId ? (screenDocument.instancesByScreenId[selectedScreenId] ?? []) : []),
    [screenDocument.instancesByScreenId, selectedScreenId],
  );
  const selectedInstance = useMemo(
    () => currentInstances.find((instance) => instance.id === selectedInstanceId) ?? null,
    [currentInstances, selectedInstanceId],
  );
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

  const {
    stageContainerRef,
    transformerRef,
    instanceNodeMapRef,
    stageSize,
    viewport,
    zoomIn,
    zoomOut,
    fitToFrame,
    resetToActualSize,
    handleCanvasDragMove,
    handleCanvasWheel,
    safeAreaInset,
    gridLines,
    libraryDragActive,
    canvasDropActive,
    handleLibraryDragStart,
    handleLibraryDragEnd,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleCanvasMouseDown,
  } = useScreenDesignCanvasController({
    selectedScreen,
    activeFramePreset,
    libraryItemMap,
    currentInstances,
    selectedInstanceId,
    setSelectedInstanceId,
    addInstance,
  });

  useEffect(() => {
    if (
      !collaborationReady ||
      !sharedDocumentEngine ||
      documentBootstrap?.snapshotAvailable ||
      screenDocument.screens.length > 0
    ) {
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
    collaborationReady,
    documentBootstrap?.snapshotAvailable,
    screenDocument.screens.length,
    setSelectedScreenId,
    sharedDocumentEngine,
    t,
  ]);

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

  const handleSelectScreen = useCallback(
    (screenId: string): void => {
      setSelectedScreenId(screenId);
      setSelectedInstanceId(null);
    },
    [setSelectedScreenId],
  );
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
  const collaborationConnected = collaborationReady && !collaborationError;
  const collaborationStatus = useMemo(() => {
    if (collaborationRuntimeStatus.commandRejectedAt !== null) {
      return {
        label: t('screenSpec.status.editRejected') as string,
        tone: 'warning' as const,
      };
    }
    if (collaborationRuntimeStatus.remoteLockActive) {
      return {
        label: t('screenSpec.status.locked') as string,
        tone: 'warning' as const,
      };
    }
    if (collaborationError) {
      return {
        label: t('screenSpec.aria.connectionIssue') as string,
        tone: 'error' as const,
      };
    }
    if (!collaborationReady) {
      return {
        label: t('screenSpec.status.connecting') as string,
        tone: 'connecting' as const,
      };
    }
    if (lastDocumentChangeSummary?.origin === 'remote') {
      return {
        label: t('screenSpec.status.remoteChanged') as string,
        tone: 'ready' as const,
      };
    }
    return {
      label: t('screenSpec.status.ready') as string,
      tone: 'ready' as const,
    };
  }, [
    collaborationError,
    collaborationReady,
    collaborationRuntimeStatus.commandRejectedAt,
    collaborationRuntimeStatus.remoteLockActive,
    lastDocumentChangeSummary?.origin,
    t,
  ]);

  useScreenDesignHotkeys({
    selectedInstanceId,
    setSelectedInstanceId,
    currentInstances,
    selectedInstance,
    deleteInstance,
    updateInstance,
    navigateScreenByOffset,
    screenCount: screenDocument.screens.length,
  });

  const liveStatusMessage = useMemo(() => {
    if (collaborationError) {
      return t('screenSpec.aria.connectionIssue') as string;
    }
    if (!collaborationReady) {
      return t('screenSpec.aria.connecting') as string;
    }
    if (selectedInstance && selectedScreen) {
      return t('screenSpec.aria.selectedInstance', {
        screen: selectedScreen.name,
        name: resolveScreenDesignInstanceLabel(t, selectedInstance),
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

  /** 문서 허브 화면으로 이동한다. */
  const handleBack = (): void => {
    void navigate(ROUTES.DIAGRAMS(resolvedTeamId, resolvedProjectId));
  };

  /** 현재 문서에 새 화면을 추가하고 선택한다. */
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
   * 화면을 삭제하고 선택 상태를 정리한다.
   *
   * @param screenId 삭제할 화면 ID
   */
  const handleDeleteScreen = (screenId: string): void => {
    deleteScreen(screenId);
    if (selectedScreenId === screenId) {
      setSelectedInstanceId(null);
    }
  };

  if (isLoading) {
    return <ScreenDesignPageLoadingState />;
  }

  if (isError || !documentBootstrap || !documentDetail) {
    return (
      <ScreenDesignPageLoadErrorState
        teamId={resolvedTeamId}
        teamName={team?.name}
        projectId={resolvedProjectId}
        projectName={project?.name}
        onRetry={() => void retryDocumentSetup()}
      />
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
              collaborationReady={collaborationConnected}
              framePresetId={activeFramePreset.id}
              framePreset={activeFramePreset}
              viewport={viewport}
              screens={screenNavigationOptions}
              selectedScreenId={selectedScreenId}
              canNavigatePreviousScreen={canNavigatePreviousScreen}
              canNavigateNextScreen={canNavigateNextScreen}
              exportBusy={exportProgress.isExporting}
              savePending={savePending}
              collaborationStatusLabel={collaborationStatus.label}
              collaborationStatusTone={collaborationStatus.tone}
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
              onSave={handleSave}
              onExportPng={() => void exportPng()}
              onExportPdf={() => void exportPdf()}
              libraryPane={
                <ScreenDesignLibrary
                  screens={screenDocument.screens}
                  selectedScreenId={selectedScreenId}
                  screenInstanceCounts={screenInstanceCounts}
                  groupedLibraryItems={groupedLibraryItems}
                  defaultAccentColor={screenDesignPalette.surfaceStrokeHex}
                  onAddScreen={handleAddScreen}
                  onSelectScreen={handleSelectScreen}
                  onMoveScreen={moveScreen}
                  onDeleteScreen={handleDeleteScreen}
                  onAddMaster={(name) => addMaster({ name, categoryId: 'button', tier: 'widget' })}
                  onUpdateMaster={updateMaster}
                  onDeleteMaster={deleteMaster}
                  onLibraryDragStart={handleLibraryDragStart}
                  onLibraryDragEnd={handleLibraryDragEnd}
                />
              }
              viewportPane={
                <ScreenDesignCanvas
                  collaborationReady={collaborationReady}
                  hasCollaborationError={Boolean(collaborationError)}
                  selectedScreen={selectedScreen}
                  currentInstances={currentInstances}
                  selectedInstanceId={selectedInstanceId}
                  palette={screenDesignPalette}
                  stageContainerRef={stageContainerRef}
                  transformerRef={transformerRef}
                  instanceNodeMapRef={instanceNodeMapRef}
                  stageSize={stageSize}
                  viewport={viewport}
                  safeAreaInset={safeAreaInset}
                  gridLines={gridLines}
                  libraryDragActive={libraryDragActive}
                  canvasDropActive={canvasDropActive}
                  onCanvasDragOver={handleCanvasDragOver}
                  onCanvasDragLeave={handleCanvasDragLeave}
                  onCanvasDrop={handleCanvasDrop}
                  onCanvasWheel={handleCanvasWheel}
                  onCanvasMouseDown={handleCanvasMouseDown}
                  onCanvasPan={handleCanvasDragMove}
                  onSelectInstance={setSelectedInstanceId}
                  onUpdateInstance={updateInstance}
                />
              }
              inspectorPane={
                <ScreenDesignInspector
                  selectedScreen={selectedScreen}
                  activeFramePreset={activeFramePreset}
                  collaborationConnected={collaborationConnected}
                  selectedInstance={selectedInstance}
                  viewport={viewport}
                  rebindMasterId={rebindMasterId}
                  rebindCandidates={rebindCandidates}
                  defaultAccentColor={screenDesignPalette.surfaceStrokeHex}
                  onRebindMasterIdChange={setRebindMasterId}
                  onRenameScreen={(name) => {
                    if (!selectedScreen) {
                      return false;
                    }
                    return renameScreen(selectedScreen.id, name);
                  }}
                  updateInstance={updateInstance}
                  deleteInstance={deleteInstance}
                  moveInstanceLayer={moveInstanceLayer}
                  clearSelection={() => setSelectedInstanceId(null)}
                />
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
            resolveInstanceLabel={(instance: ScreenDesignInstance) =>
              resolveScreenDesignInstanceLabel(t, instance)
            }
            registerStage={registerExportStage}
          />
        ))}
      </div>
    </div>
  );
}
