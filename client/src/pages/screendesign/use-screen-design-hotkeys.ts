import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { isTextInputLikeTarget } from '@/constants/canvas-history';
import {
  SCREEN_DESIGN_HOTKEY_CYCLE_INSTANCE_SELECTION,
  SCREEN_DESIGN_HOTKEY_DELETE_INSTANCE,
  SCREEN_DESIGN_HOTKEY_MOVE_INSTANCE,
  SCREEN_DESIGN_HOTKEY_NEXT_SCREEN,
  SCREEN_DESIGN_HOTKEY_PREVIOUS_SCREEN,
  SCREEN_DESIGN_INSTANCE_MOVE_STEP,
  SCREEN_DESIGN_INSTANCE_MOVE_STEP_LARGE,
} from '@/constants/screen-design';
import type { ScreenDesignInstance } from './screen-design-document';
import type { UpdateInstanceParams } from './use-screen-design-document';

interface UseScreenDesignHotkeysParams {
  selectedInstanceId: string | null;
  setSelectedInstanceId: (instanceId: string | null) => void;
  currentInstances: ScreenDesignInstance[];
  selectedInstance: ScreenDesignInstance | null;
  deleteInstance: (instanceId: string) => void;
  updateInstance: (instanceId: string, updates: UpdateInstanceParams) => void;
  navigateScreenByOffset: (offset: number) => void;
  screenCount: number;
}

/**
 * 화면기획 편집기 hotkey를 한 곳에 묶어 등록한다.
 *
 * @param params selection/instance/screen 이동에 필요한 액션 집합
 */
export function useScreenDesignHotkeys({
  selectedInstanceId,
  setSelectedInstanceId,
  currentInstances,
  selectedInstance,
  deleteInstance,
  updateInstance,
  navigateScreenByOffset,
  screenCount,
}: UseScreenDesignHotkeysParams): void {
  const shouldBypassCanvasHotkeys = useCallback(
    (): boolean => isTextInputLikeTarget(globalThis.document?.activeElement ?? null),
    [],
  );

  useHotkeys(
    SCREEN_DESIGN_HOTKEY_DELETE_INSTANCE,
    (event) => {
      if (shouldBypassCanvasHotkeys() || !selectedInstanceId) {
        return;
      }
      event.preventDefault();
      deleteInstance(selectedInstanceId);
      setSelectedInstanceId(null);
    },
    { enabled: Boolean(selectedInstanceId) },
    [deleteInstance, selectedInstanceId, setSelectedInstanceId, shouldBypassCanvasHotkeys],
  );

  useHotkeys(
    SCREEN_DESIGN_HOTKEY_CYCLE_INSTANCE_SELECTION,
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
    [currentInstances, selectedInstanceId, setSelectedInstanceId, shouldBypassCanvasHotkeys],
  );

  useHotkeys(
    SCREEN_DESIGN_HOTKEY_PREVIOUS_SCREEN,
    (event) => {
      if (shouldBypassCanvasHotkeys()) {
        return;
      }
      event.preventDefault();
      navigateScreenByOffset(-1);
    },
    { enabled: screenCount > 1 },
    [navigateScreenByOffset, screenCount, shouldBypassCanvasHotkeys],
  );

  useHotkeys(
    SCREEN_DESIGN_HOTKEY_NEXT_SCREEN,
    (event) => {
      if (shouldBypassCanvasHotkeys()) {
        return;
      }
      event.preventDefault();
      navigateScreenByOffset(1);
    },
    { enabled: screenCount > 1 },
    [navigateScreenByOffset, screenCount, shouldBypassCanvasHotkeys],
  );

  useHotkeys(
    SCREEN_DESIGN_HOTKEY_MOVE_INSTANCE,
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
    [selectedInstance, shouldBypassCanvasHotkeys, updateInstance],
  );
}
