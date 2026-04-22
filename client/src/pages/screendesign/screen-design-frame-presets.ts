export type ScreenDesignFramePresetId = 'mobile' | 'tablet' | 'desktop';

export interface ScreenDesignFramePreset {
  id: ScreenDesignFramePresetId;
  width: number;
  height: number;
}

/**
 * 화면기획 에디터에서 선택 가능한 기본 프레임 preset 목록.
 */
export const SCREEN_DESIGN_FRAME_PRESETS: ScreenDesignFramePreset[] = [
  {
    id: 'mobile',
    width: 390,
    height: 844,
  },
  {
    id: 'tablet',
    width: 834,
    height: 1194,
  },
  {
    id: 'desktop',
    width: 1440,
    height: 1024,
  },
];

/**
 * 화면기획 에디터가 첫 렌더에서 선택하는 기본 프레임 preset 식별자.
 */
export const DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID: ScreenDesignFramePresetId = 'desktop';

/**
 * 주어진 id에 해당하는 프레임 preset을 해상한다.
 *
 * @param presetId 해상할 preset id
 * @returns 해상된 프레임 preset
 */
export function resolveScreenDesignFramePreset(
  presetId: string | null | undefined,
): ScreenDesignFramePreset {
  return (
    SCREEN_DESIGN_FRAME_PRESETS.find((preset) => preset.id === presetId) ??
    SCREEN_DESIGN_FRAME_PRESETS.find(
      (preset) => preset.id === DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID,
    ) ??
    SCREEN_DESIGN_FRAME_PRESETS[0]
  );
}

/**
 * 화면 크기와 일치하는 preset 식별자를 해석한다.
 *
 * @param width 화면 너비
 * @param height 화면 높이
 * @returns 일치하는 preset id 또는 기본 preset id
 */
export function resolveScreenDesignFramePresetIdBySize(
  width: number,
  height: number,
): ScreenDesignFramePresetId {
  return (
    SCREEN_DESIGN_FRAME_PRESETS.find((preset) => preset.width === width && preset.height === height)
      ?.id ?? DEFAULT_SCREEN_DESIGN_FRAME_PRESET_ID
  );
}
