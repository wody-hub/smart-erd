import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type Konva from 'konva';
import {
  SCREEN_DESIGN_GRID_STEP,
  SCREEN_DESIGN_LIBRARY_DRAG_MIME,
} from '@/constants/screen-design';
import type { ScreenDesignFramePreset } from './screen-design-frame-presets';
import type {
  ScreenDesignInstance,
  ScreenDesignLibraryItem,
  ScreenDesignScreen,
} from './screen-design-document';
import type { AddInstanceParams } from './use-screen-design-document';
import { useScreenDesignViewport } from './use-screen-design-viewport';

interface UseScreenDesignCanvasControllerParams {
  selectedScreen: ScreenDesignScreen | null;
  activeFramePreset: ScreenDesignFramePreset;
  libraryItemMap: Map<string, ScreenDesignLibraryItem>;
  currentInstances: ScreenDesignInstance[];
  selectedInstanceId: string | null;
  setSelectedInstanceId: (instanceId: string | null) => void;
  addInstance: (params: AddInstanceParams) => string | null;
}

/**
 * 캔버스 pane에 필요한 viewport/ref/drag 상태를 한 곳에서 관리한다.
 *
 * @param params 현재 화면, 선택 상태, instance 추가 액션
 * @returns 캔버스 렌더링에 필요한 상태와 이벤트 핸들러
 */
export function useScreenDesignCanvasController({
  selectedScreen,
  activeFramePreset,
  libraryItemMap,
  currentInstances,
  selectedInstanceId,
  setSelectedInstanceId,
  addInstance,
}: UseScreenDesignCanvasControllerParams) {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const instanceNodeMapRef = useRef(new Map<string, Konva.Group>());
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const [canvasDropActive, setCanvasDropActive] = useState(false);

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

  useEffect(() => {
    const element = stageContainerRef.current;
    if (!element) {
      return;
    }

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
    if (!selectedInstanceId) {
      return;
    }
    if (!currentInstances.some((instance) => instance.id === selectedInstanceId)) {
      setSelectedInstanceId(null);
    }
  }, [currentInstances, selectedInstanceId, setSelectedInstanceId]);

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

  const safeAreaInset = useMemo(
    () =>
      Math.round(
        Math.min(
          selectedScreen?.width ?? activeFramePreset.width,
          selectedScreen?.height ?? activeFramePreset.height,
        ) * 0.06,
      ),
    [activeFramePreset.height, activeFramePreset.width, selectedScreen],
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

  const handleLibraryDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, item: ScreenDesignLibraryItem): void => {
      event.dataTransfer.setData(SCREEN_DESIGN_LIBRARY_DRAG_MIME, item.id);
      event.dataTransfer.effectAllowed = 'copy';
      setLibraryDragActive(true);
    },
    [],
  );

  const handleLibraryDragEnd = useCallback((): void => {
    setLibraryDragActive(false);
    setCanvasDropActive(false);
  }, []);

  const handleCanvasDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (!selectedScreen || !event.dataTransfer.types.includes(SCREEN_DESIGN_LIBRARY_DRAG_MIME)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setCanvasDropActive(true);
    },
    [selectedScreen],
  );

  const handleCanvasDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setCanvasDropActive(false);
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
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
    },
    [addInstance, libraryItemMap, selectedScreen, setSelectedInstanceId, viewport],
  );

  const handleCanvasMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>): void => {
      const targetName = event.target === event.target.getStage() ? '' : event.target.name();
      if (!targetName || targetName.includes('screen-design-background')) {
        setSelectedInstanceId(null);
      }
    },
    [setSelectedInstanceId],
  );

  return {
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
  };
}
