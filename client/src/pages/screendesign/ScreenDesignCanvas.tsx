import type { DragEvent as ReactDragEvent, MutableRefObject, RefObject } from 'react';
import type Konva from 'konva';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { useTranslation } from 'react-i18next';
import Spinner from '@/components/ui/spinner';
import {
  SCREEN_DESIGN_INSTANCE_MIN_HEIGHT,
  SCREEN_DESIGN_INSTANCE_MIN_WIDTH,
} from '@/constants/screen-design';
import { cn } from '@/lib/utils';
import type { ScreenDesignCanvasPalette } from './screen-design-canvas-palette';
import type { ScreenDesignInstance, ScreenDesignScreen } from './screen-design-document';
import { resolveScreenDesignInstanceLabel } from './screen-design-labels';
import { renderScreenDesignInstance } from './screen-design-instance-renderer';
import { resolveScreenDesignTransformedSize } from './screen-design-transform-utils';
import type { UpdateInstanceParams } from './use-screen-design-document';
import type { ScreenDesignViewportState } from './use-screen-design-viewport';

interface ScreenDesignCanvasProps {
  collaborationReady: boolean;
  hasCollaborationError: boolean;
  selectedScreen: ScreenDesignScreen | null;
  currentInstances: ScreenDesignInstance[];
  selectedInstanceId: string | null;
  palette: ScreenDesignCanvasPalette;
  stageContainerRef: RefObject<HTMLDivElement | null>;
  transformerRef: RefObject<Konva.Transformer | null>;
  instanceNodeMapRef: MutableRefObject<Map<string, Konva.Group>>;
  stageSize: {
    width: number;
    height: number;
  };
  viewport: ScreenDesignViewportState;
  safeAreaInset: number;
  gridLines: Array<{ key: string; points: number[] }>;
  libraryDragActive: boolean;
  canvasDropActive: boolean;
  onCanvasDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onCanvasDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void;
  onCanvasDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: Konva.KonvaEventObject<WheelEvent>) => void;
  onCanvasMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onCanvasPan: (event: Konva.KonvaEventObject<globalThis.DragEvent>) => void;
  onSelectInstance: (instanceId: string) => void;
  onUpdateInstance: (instanceId: string, updates: UpdateInstanceParams) => void;
}

/**
 * Konva stage와 드래그/선택 UI를 렌더링한다.
 *
 * @returns 중앙 canvas pane JSX
 */
export default function ScreenDesignCanvas({
  collaborationReady,
  hasCollaborationError,
  selectedScreen,
  currentInstances,
  selectedInstanceId,
  palette,
  stageContainerRef,
  transformerRef,
  instanceNodeMapRef,
  stageSize,
  viewport,
  safeAreaInset,
  gridLines,
  libraryDragActive,
  canvasDropActive,
  onCanvasDragOver,
  onCanvasDragLeave,
  onCanvasDrop,
  onCanvasWheel,
  onCanvasMouseDown,
  onCanvasPan,
  onSelectInstance,
  onUpdateInstance,
}: ScreenDesignCanvasProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={stageContainerRef}
      data-testid="screen-spec-canvas-dropzone"
      className="relative h-full w-full cursor-grab active:cursor-grabbing"
      onDragOver={onCanvasDragOver}
      onDragLeave={onCanvasDragLeave}
      onDrop={onCanvasDrop}
    >
      {stageSize.width > 0 && stageSize.height > 0 && selectedScreen ? (
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onWheel={onCanvasWheel}
          onMouseDown={onCanvasMouseDown}
        >
          <Layer listening={false}>
            <Rect
              width={stageSize.width}
              height={stageSize.height}
              fill={palette.canvasBackground}
            />
            {gridLines.map((line) => (
              <Line
                key={line.key}
                points={line.points}
                stroke={palette.grid}
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
              onDragMove={onCanvasPan}
            >
              <Rect
                x={-220}
                y={-220}
                width={selectedScreen.width + 440}
                height={selectedScreen.height + 440}
                fill={palette.canvasBackground}
                opacity={0.001}
                name="screen-design-background"
              />
              <Rect
                x={-18}
                y={-18}
                width={selectedScreen.width + 36}
                height={selectedScreen.height + 36}
                fill={palette.frameShadow}
                opacity={0.64}
                cornerRadius={18}
                name="screen-design-background"
              />
              <Rect
                width={selectedScreen.width}
                height={selectedScreen.height}
                fill={palette.frameFill}
                stroke={palette.frameStroke}
                strokeWidth={1}
                cornerRadius={12}
                name="screen-design-background"
              />
              <Rect
                x={safeAreaInset}
                y={safeAreaInset}
                width={selectedScreen.width - safeAreaInset * 2}
                height={selectedScreen.height - safeAreaInset * 2}
                stroke={palette.safeArea}
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
                  fill={palette.accentMuted}
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
                      onSelectInstance(instance.id);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      onSelectInstance(instance.id);
                    }}
                    onDragStart={(event) => {
                      event.cancelBubble = true;
                      onSelectInstance(instance.id);
                    }}
                    onDragEnd={(event) => {
                      onUpdateInstance(instance.id, {
                        x: event.target.x(),
                        y: event.target.y(),
                      });
                    }}
                    onTransformEnd={(event) => {
                      const node = event.target;
                      const { width: nextWidth, height: nextHeight } =
                        resolveScreenDesignTransformedSize({
                          width: instance.width,
                          height: instance.height,
                          scaleX: node.scaleX(),
                          scaleY: node.scaleY(),
                        });
                      node.scaleX(1);
                      node.scaleY(1);
                      onUpdateInstance(instance.id, {
                        x: node.x(),
                        y: node.y(),
                        width: nextWidth,
                        height: nextHeight,
                      });
                    }}
                  >
                    {renderScreenDesignInstance({
                      instance,
                      label: resolveScreenDesignInstanceLabel(t, instance),
                      palette,
                      selected,
                    })}
                  </Group>
                );
              })}
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                flipEnabled={false}
                keepRatio={false}
                borderStroke={palette.selection}
                anchorFill={palette.anchorFill}
                anchorStroke={palette.selection}
                borderDash={[6, 4]}
                boundBoxFunc={(_oldBox, newBox) => ({
                  ...newBox,
                  width: Math.max(SCREEN_DESIGN_INSTANCE_MIN_WIDTH, Math.abs(newBox.width)),
                  height: Math.max(SCREEN_DESIGN_INSTANCE_MIN_HEIGHT, Math.abs(newBox.height)),
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
              {hasCollaborationError
                ? t('workspace.status.retry')
                : t('screenSpec.status.connecting')}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
