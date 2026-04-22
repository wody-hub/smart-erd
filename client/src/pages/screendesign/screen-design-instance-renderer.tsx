/* eslint-disable react-refresh/only-export-components */

import type Konva from 'konva';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import type { ScreenDesignCanvasPalette } from './screen-design-canvas-palette';
import type { ScreenDesignInstance } from './screen-design-document';

interface ScreenDesignInstanceRendererParams {
  instance: ScreenDesignInstance;
  label: string;
  palette: ScreenDesignCanvasPalette;
  selected: boolean;
}

/**
 * 인스턴스 renderKind에 맞는 wireframe Konva primitive를 렌더링한다.
 *
 * @param args 렌더링에 필요한 인스턴스/라벨/팔레트/선택 상태
 * @returns Konva shape fragment
 */
export function renderScreenDesignInstance({
  instance,
  label,
  palette,
  selected,
}: ScreenDesignInstanceRendererParams) {
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

interface ScreenDesignExportStageProps {
  palette: ScreenDesignCanvasPalette;
  screen: {
    id: string;
    width: number;
    height: number;
  };
  instances: ScreenDesignInstance[];
  resolveInstanceLabel: (instance: ScreenDesignInstance) => string;
  registerStage: (screenId: string, stage: Konva.Stage | null) => void;
}

/**
 * export용 숨김 Stage를 렌더링하고 stage ref를 등록한다.
 *
 * @param props export 대상 화면/인스턴스와 팔레트 정보
 * @returns 숨김 export stage JSX
 */
export function ScreenDesignExportStage({
  palette,
  screen,
  instances,
  resolveInstanceLabel,
  registerStage,
}: ScreenDesignExportStageProps) {
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
            {renderScreenDesignInstance({
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
