import type { IScaleConfig } from '@svar-ui/react-gantt';

/** 간트 줌 preset 식별자. */
export type GanttZoomPreset = 'day' | 'week' | 'month';

type GanttScaleLabelKey = 'gantt.toolbar.day' | 'gantt.toolbar.week' | 'gantt.toolbar.month';

/** 간트 줌 preset 설정. */
export interface GanttScalePreset {
  /** 번역 키 */
  labelKey: GanttScaleLabelKey;
  /** SVAR scales 설정 */
  scales: IScaleConfig[];
  /** 타임라인 셀 너비 */
  cellWidth: number;
  /** 축 길이 단위 */
  lengthUnit: 'day' | 'week' | 'month';
}

/**
 * 간트 줌 preset 모음.
 *
 * day/week/month 모두 2단 헤더(상단/하단)로 고정한다.
 */
export const GANTT_SCALE_PRESETS: Record<GanttZoomPreset, GanttScalePreset> = {
  day: {
    labelKey: 'gantt.toolbar.day',
    scales: [
      { unit: 'month', step: 1, format: '%Y-%m' },
      { unit: 'day', step: 1, format: '%d' },
    ],
    cellWidth: 44,
    lengthUnit: 'day',
  },
  week: {
    labelKey: 'gantt.toolbar.week',
    scales: [
      { unit: 'year', step: 1, format: '%Y' },
      { unit: 'week', step: 1, format: 'W%W' },
    ],
    cellWidth: 84,
    lengthUnit: 'week',
  },
  month: {
    labelKey: 'gantt.toolbar.month',
    scales: [
      { unit: 'year', step: 1, format: '%Y' },
      { unit: 'month', step: 1, format: '%m' },
    ],
    cellWidth: 120,
    lengthUnit: 'month',
  },
};

/** 툴바 노출 순서. */
export const GANTT_SCALE_PRESET_ORDER: GanttZoomPreset[] = ['day', 'week', 'month'];
