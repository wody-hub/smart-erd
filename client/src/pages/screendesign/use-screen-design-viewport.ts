import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ScreenDesignFramePreset } from './screen-design-frame-presets';

const VIEWPORT_PADDING = 220;
const ZOOM_STEP = 1.12;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

interface StageSize {
  width: number;
  height: number;
}

export interface ScreenDesignViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface UseScreenDesignViewportParams {
  stageSize: StageSize;
  framePreset: ScreenDesignFramePreset;
}

interface UseScreenDesignViewportResult {
  viewport: ScreenDesignViewportState;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToFrame: () => void;
  resetToActualSize: () => void;
  handleCanvasDragMove: (event: KonvaEventObject<DragEvent>) => void;
  handleCanvasWheel: (event: KonvaEventObject<WheelEvent>) => void;
}

/**
 * 숫자 값을 최소/최대 범위로 제한한다.
 *
 * @param value 제한할 값
 * @param min 최소값
 * @param max 최대값
 * @returns 제한된 값
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 화면기획 캔버스의 로컬 viewport 상태를 관리한다.
 *
 * @param params 화면기획 viewport 계산 파라미터
 * @returns viewport 상태와 확대/축소/이동 핸들러
 */
export function useScreenDesignViewport({
  stageSize,
  framePreset,
}: UseScreenDesignViewportParams): UseScreenDesignViewportResult {
  const [viewport, setViewport] = useState<ScreenDesignViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const initializedRef = useRef(false);
  const previousFrameKeyRef = useRef<string | null>(null);
  const frameKey = useMemo(
    () => `${framePreset.id}:${framePreset.width}:${framePreset.height}`,
    [framePreset.height, framePreset.id, framePreset.width],
  );

  const computeCenteredViewport = useCallback(
    (zoom: number, preset: ScreenDesignFramePreset = framePreset): ScreenDesignViewportState => ({
      x: (stageSize.width - preset.width * zoom) / 2,
      y: (stageSize.height - preset.height * zoom) / 2,
      zoom,
    }),
    [framePreset, stageSize.height, stageSize.width],
  );

  const getFitZoom = useCallback(
    (preset: ScreenDesignFramePreset = framePreset) => {
      if (stageSize.width <= 0 || stageSize.height <= 0) {
        return 1;
      }

      return clamp(
        Math.min(
          (stageSize.width - VIEWPORT_PADDING) / preset.width,
          (stageSize.height - VIEWPORT_PADDING) / preset.height,
          1,
        ),
        MIN_ZOOM,
        1.2,
      );
    },
    [framePreset, stageSize.height, stageSize.width],
  );

  useEffect(() => {
    if (stageSize.width <= 0 || stageSize.height <= 0) {
      return;
    }

    if (!initializedRef.current || previousFrameKeyRef.current !== frameKey) {
      setViewport(computeCenteredViewport(getFitZoom()));
      initializedRef.current = true;
      previousFrameKeyRef.current = frameKey;
    }
  }, [computeCenteredViewport, frameKey, getFitZoom, stageSize.height, stageSize.width]);

  const zoomAroundPoint = useCallback((anchor: { x: number; y: number }, nextZoom: number) => {
    setViewport((currentViewport) => {
      const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const anchorPoint = {
        x: (anchor.x - currentViewport.x) / currentViewport.zoom,
        y: (anchor.y - currentViewport.y) / currentViewport.zoom,
      };

      return {
        x: anchor.x - anchorPoint.x * clampedZoom,
        y: anchor.y - anchorPoint.y * clampedZoom,
        zoom: clampedZoom,
      };
    });
  }, []);

  const zoomIn = useCallback(() => {
    zoomAroundPoint(
      {
        x: stageSize.width / 2,
        y: stageSize.height / 2,
      },
      viewport.zoom * ZOOM_STEP,
    );
  }, [stageSize.height, stageSize.width, viewport.zoom, zoomAroundPoint]);

  const zoomOut = useCallback(() => {
    zoomAroundPoint(
      {
        x: stageSize.width / 2,
        y: stageSize.height / 2,
      },
      viewport.zoom / ZOOM_STEP,
    );
  }, [stageSize.height, stageSize.width, viewport.zoom, zoomAroundPoint]);

  const fitToFrame = useCallback(() => {
    setViewport(computeCenteredViewport(getFitZoom()));
  }, [computeCenteredViewport, getFitZoom]);

  const resetToActualSize = useCallback(() => {
    setViewport(computeCenteredViewport(1));
  }, [computeCenteredViewport]);

  const handleCanvasDragMove = useCallback((event: KonvaEventObject<DragEvent>) => {
    setViewport((currentViewport) => ({
      ...currentViewport,
      x: event.target.x(),
      y: event.target.y(),
    }));
  }, []);

  const handleCanvasWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const pointer = event.target.getStage()?.getPointerPosition();
      if (!pointer) {
        return;
      }

      const zoomDelta = event.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      zoomAroundPoint(pointer, viewport.zoom * zoomDelta);
    },
    [viewport.zoom, zoomAroundPoint],
  );

  return {
    viewport,
    zoomIn,
    zoomOut,
    fitToFrame,
    resetToActualSize,
    handleCanvasDragMove,
    handleCanvasWheel,
  };
}
