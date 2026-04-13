import type {
  ScreenDesignLibraryItem,
  ScreenDesignMasterRenderKind,
} from './screen-design-document';

export interface ScreenDesignMasterPreviewPalette {
  surface: string;
  line: string;
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  danger: string;
}

export type ScreenDesignMasterPreviewShape =
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      dash?: number[];
    }
  | {
      kind: 'line';
      points: number[];
      stroke: string;
      strokeWidth?: number;
      dash?: number[];
      lineCap?: 'round' | 'square';
    }
  | {
      kind: 'circle';
      x: number;
      y: number;
      radius: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    };

/**
 * 선택된 마스터를 Konva로 미리보기 위한 wireframe shape 목록을 계산한다.
 *
 * @param item 라이브러리 마스터 메타
 * @param palette preview 팔레트
 * @returns Konva primitive shape 배열
 */
export function buildScreenDesignMasterPreviewShapes(
  item: ScreenDesignLibraryItem,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const frame = createFrame(item, palette);
  const shapes = resolvePreviewShapes(item.renderKind, palette, item.width, item.height);
  return [...frame, ...shapes];
}

/**
 * render kind별 preview shape 생성기를 선택한다.
 *
 * @param renderKind 해상할 master render kind
 * @param palette preview 팔레트
 * @param width preview 너비
 * @param height preview 높이
 * @returns 선택된 preview shape 목록
 */
function resolvePreviewShapes(
  renderKind: ScreenDesignMasterRenderKind,
  palette: ScreenDesignMasterPreviewPalette,
  width: number,
  height: number,
): ScreenDesignMasterPreviewShape[] {
  switch (renderKind) {
    case 'topBar':
    case 'gnb':
      return buildGnbPreview(width, height, palette);
    case 'sideRail':
    case 'lnb':
      return buildLnbPreview(width, height, palette);
    case 'bottomTabs':
    case 'tabMenu':
      return buildTabMenuPreview(width, height, palette);
    case 'breadcrumb':
      return buildBreadcrumbPreview(width, height, palette);
    case 'dataTable':
      return buildDataTablePreview(width, height, palette);
    case 'simpleTable':
      return buildSimpleTablePreview(width, height, palette);
    case 'cardList':
      return buildCardListPreview(width, height, palette);
    case 'loginForm':
      return buildLoginFormPreview(width, height, palette);
    case 'searchBar':
      return buildSearchBarPreview(width, height, palette);
    case 'filterPanel':
      return buildFilterPanelPreview(width, height, palette);
    case 'editForm':
      return buildEditFormPreview(width, height, palette);
    case 'formStack':
      return buildEditFormPreview(width, height, palette);
    case 'detailPane':
      return buildGenericPreview(width, height, palette);
    case 'textInput':
      return buildTextInputPreview(width, height, palette);
    case 'dropdown':
      return buildDropdownPreview(width, height, palette);
    case 'checkboxGroup':
      return buildCheckboxGroupPreview(width, height, palette);
    case 'radioGroup':
      return buildRadioGroupPreview(width, height, palette);
    case 'datePicker':
      return buildDatePickerPreview(width, height, palette);
    case 'toast':
      return buildToastPreview(width, height, palette);
    case 'dialog':
      return buildDialogPreview(width, height, palette);
    case 'spinner':
      return buildSpinnerPreview(width, height, palette);
    case 'emptyState':
      return buildEmptyStatePreview(width, height, palette);
    case 'primaryButton':
      return buildPrimaryButtonPreview(width, height, palette);
    case 'iconButton':
      return buildIconButtonPreview(width, height, palette);
    case 'buttonGroup':
      return buildButtonGroupPreview(width, height, palette);
    case 'generic':
    default:
      return buildGenericPreview(width, height, palette);
  }
}

/**
 * 모든 preview 공통 외곽 frame을 생성한다.
 *
 * @param item preview 대상 마스터 메타
 * @param palette preview 팔레트
 * @returns frame shape 목록
 */
function createFrame(
  item: ScreenDesignLibraryItem,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    {
      kind: 'rect',
      x: 0,
      y: 0,
      width: item.width,
      height: item.height,
      fill: palette.surface,
      stroke: palette.line,
      strokeWidth: 1,
      cornerRadius: 16,
    },
  ];
}

/**
 * GNB/top bar preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildGnbPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const barHeight = Math.min(Math.max(52, height * 0.74), height - 8);
  const itemWidth = Math.max(84, width * 0.1);
  return [
    rect(12, 12, width - 24, barHeight, palette.primary, 12),
    circle(34, 12 + barHeight / 2, 10, palette.surface),
    rect(56, 12 + barHeight / 2 - 10, Math.max(120, width * 0.16), 20, palette.surface, 8),
    rect(width - itemWidth * 3 - 40, 12 + barHeight / 2 - 9, itemWidth, 18, palette.secondary, 8),
    rect(width - itemWidth * 2 - 28, 12 + barHeight / 2 - 9, itemWidth, 18, palette.secondary, 8),
    rect(width - itemWidth - 16, 12 + barHeight / 2 - 9, itemWidth, 18, palette.surface, 8),
  ];
}

/**
 * LNB/side rail preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildLnbPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const railWidth = Math.min(Math.max(96, width * 0.3), 240);
  return [
    rect(12, 12, railWidth, height - 24, palette.primary, 12),
    rect(28, 32, railWidth - 32, 18, palette.surface, 8),
    ...buildStack(28, 74, railWidth - 32, 18, 6, 16, palette.secondary, 8),
    rect(railWidth + 28, 24, width - railWidth - 44, 42, palette.secondary, 12),
    rect(railWidth + 28, 84, width - railWidth - 44, height - 108, palette.tertiary, 14),
  ];
}

/**
 * 탭 메뉴 preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildTabMenuPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const tabCount = 4;
  const tabWidth = (width - 48) / tabCount;
  const shapes: ScreenDesignMasterPreviewShape[] = [
    rect(12, 16, width - 24, 48, palette.primary, 12),
  ];
  for (let index = 0; index < tabCount; index += 1) {
    shapes.push(
      rect(
        20 + tabWidth * index,
        24,
        tabWidth - 12,
        28,
        index === 0 ? palette.surface : palette.secondary,
        10,
      ),
    );
  }
  shapes.push(rect(12, 80, width - 24, height - 96, palette.tertiary, 14));
  return shapes;
}

/**
 * breadcrumb preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildBreadcrumbPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const chipWidth = Math.max(72, width * 0.16);
  const y = height / 2 - 12;
  return [
    rect(18, y, chipWidth, 24, palette.secondary, 12),
    line([chipWidth + 28, height / 2, chipWidth + 44, height / 2], palette.line, 3),
    rect(chipWidth + 52, y, chipWidth * 0.92, 24, palette.secondary, 12),
    line([chipWidth * 1.92 + 62, height / 2, chipWidth * 1.92 + 78, height / 2], palette.line, 3),
    rect(chipWidth * 1.92 + 86, y, width - chipWidth * 1.92 - 104, 24, palette.primary, 12),
  ];
}

/**
 * data table preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildDataTablePreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const inset = 18;
  const bodyTop = 92;
  const rowHeight = Math.min(46, Math.max(32, (height - bodyTop - 72) / 5));
  const shapes: ScreenDesignMasterPreviewShape[] = [
    rect(inset, 18, width - inset * 2, 48, palette.primary, 12),
    rect(inset, bodyTop - 28, width - inset * 2, 24, palette.secondary, 8),
  ];
  for (let index = 0; index < 5; index += 1) {
    shapes.push(
      rect(
        inset,
        bodyTop + index * (rowHeight + 12),
        width - inset * 2,
        rowHeight,
        palette.tertiary,
        10,
      ),
    );
  }
  shapes.push(rect(width - 196, height - 44, 180, 18, palette.secondary, 8));
  return shapes;
}

/**
 * simple table preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildSimpleTablePreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const inset = 18;
  const shapes: ScreenDesignMasterPreviewShape[] = [
    rect(inset, 18, width - inset * 2, 28, palette.primary, 8),
  ];
  const rowHeight = Math.min(40, Math.max(26, (height - 84) / 5));
  for (let index = 0; index < 5; index += 1) {
    shapes.push(
      rect(
        inset,
        58 + index * (rowHeight + 10),
        width - inset * 2,
        rowHeight,
        palette.secondary,
        8,
      ),
    );
  }
  return shapes;
}

/**
 * card list preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildCardListPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const gap = 16;
  const cardWidth = (width - gap * 4) / 3;
  const cardHeight = height - 40;
  return [0, 1, 2].flatMap((index) => [
    rect(16 + index * (cardWidth + gap), 20, cardWidth, cardHeight, palette.secondary, 16),
    rect(
      28 + index * (cardWidth + gap),
      36,
      cardWidth - 24,
      cardHeight * 0.42,
      palette.tertiary,
      12,
    ),
    rect(28 + index * (cardWidth + gap), cardHeight * 0.54, cardWidth - 52, 16, palette.primary, 8),
    rect(
      28 + index * (cardWidth + gap),
      cardHeight * 0.66,
      cardWidth - 32,
      12,
      palette.secondary,
      8,
    ),
    rect(
      28 + index * (cardWidth + gap),
      cardHeight * 0.75,
      cardWidth - 44,
      12,
      palette.secondary,
      8,
    ),
  ]);
}

/**
 * login form preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildLoginFormPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const cardWidth = Math.min(width - 48, 340);
  const cardHeight = Math.min(height - 48, 360);
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;
  return [
    rect(cardX, cardY, cardWidth, cardHeight, palette.secondary, 18),
    circle(width / 2, cardY + 62, 24, palette.primary),
    rect(cardX + 40, cardY + 110, cardWidth - 80, 16, palette.primary, 8),
    rect(cardX + 32, cardY + 150, cardWidth - 64, 48, palette.tertiary, 12),
    rect(cardX + 32, cardY + 216, cardWidth - 64, 48, palette.tertiary, 12),
    rect(cardX + 32, cardY + cardHeight - 72, cardWidth - 64, 42, palette.primary, 14),
  ];
}

/**
 * search bar preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildSearchBarPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(16, 18, width - 148, 44, palette.tertiary, 12),
    rect(width - 120, 18, 104, 44, palette.primary, 12),
    rect(16, 82, width - 32, height - 100, palette.secondary, 14),
    ...buildStack(28, 98, width - 56, 18, 2, 18, palette.tertiary, 8),
  ];
}

/**
 * filter panel preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildFilterPanelPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(16, 16, width * 0.34, height - 32, palette.secondary, 14),
    ...buildStack(28, 38, width * 0.22, 18, 4, 26, palette.tertiary, 8),
    rect(width * 0.4, 16, width * 0.56 - 20, 42, palette.primary, 12),
    ...buildStack(width * 0.4, 82, width * 0.56 - 20, 28, 5, 16, palette.tertiary, 10),
  ];
}

/**
 * edit form/form stack preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildEditFormPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(18, 18, width - 36, 18, palette.primary, 8),
    ...buildStack(18, 62, width - 36, 54, 5, 18, palette.tertiary, 12),
    rect(width - 216, height - 62, 92, 38, palette.secondary, 12),
    rect(width - 112, height - 62, 92, 38, palette.primary, 12),
  ];
}

/**
 * text input preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildTextInputPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(16, 18, width * 0.32, 12, palette.primary, 6),
    rect(16, 44, width - 32, Math.max(44, height - 60), palette.tertiary, 12),
  ];
}

/**
 * dropdown preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildDropdownPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(16, 18, width * 0.28, 12, palette.primary, 6),
    rect(16, 44, width - 32, Math.max(44, height - 60), palette.tertiary, 12),
    line(
      [width - 42, height / 2 - 2, width - 32, height / 2 + 8, width - 22, height / 2 - 2],
      palette.line,
      3,
    ),
  ];
}

/**
 * checkbox group preview를 생성한다.
 *
 * @param width preview 너비
 * @param _height preview 높이(미사용)
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildCheckboxGroupPreview(
  width: number,
  _height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [0, 1, 2].flatMap((index) => [
    rect(20, 24 + index * 48, 20, 20, palette.primary, 6),
    rect(54, 26 + index * 48, width - 78, 16, palette.secondary, 8),
  ]);
}

/**
 * radio group preview를 생성한다.
 *
 * @param width preview 너비
 * @param _height preview 높이(미사용)
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildRadioGroupPreview(
  width: number,
  _height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [0, 1, 2].flatMap((index) => [
    circle(30, 34 + index * 48, 10, palette.surface, palette.primary, 4),
    ...(index === 0 ? [circle(30, 34 + index * 48, 4, palette.primary)] : []),
    rect(54, 26 + index * 48, width - 78, 16, palette.secondary, 8),
  ]);
}

/**
 * date picker preview를 생성한다.
 *
 * @param width preview 너비
 * @param _height preview 높이(미사용)
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildDatePickerPreview(
  width: number,
  _height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const calendarTop = 72;
  const dayCellWidth = (width - 56) / 7;
  const shapes: ScreenDesignMasterPreviewShape[] = [
    rect(16, 18, width - 32, 40, palette.tertiary, 12),
  ];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      shapes.push(
        rect(
          16 + column * dayCellWidth,
          calendarTop + row * 34,
          dayCellWidth - 6,
          24,
          row === 1 && column === 3 ? palette.primary : palette.secondary,
          8,
        ),
      );
    }
  }
  return shapes;
}

/**
 * toast preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildToastPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const toastY = Math.max(18, height * 0.22);
  return [
    rect(18, toastY, width - 36, Math.min(72, height - toastY - 18), palette.accent, 16),
    circle(44, toastY + 24, 10, palette.surface),
    rect(64, toastY + 14, width - 116, 14, palette.surface, 7),
    rect(64, toastY + 38, width - 160, 12, palette.secondary, 7),
  ];
}

/**
 * dialog preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildDialogPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const dialogWidth = Math.min(width - 40, width * 0.78);
  const dialogHeight = Math.min(height - 40, height * 0.72);
  const dialogX = (width - dialogWidth) / 2;
  const dialogY = (height - dialogHeight) / 2;
  return [
    rect(12, 12, width - 24, height - 24, palette.secondary, 16),
    rect(dialogX, dialogY, dialogWidth, dialogHeight, palette.surface, 18),
    rect(dialogX + 24, dialogY + 22, dialogWidth - 48, 18, palette.primary, 8),
    rect(dialogX + 24, dialogY + 56, dialogWidth - 64, 14, palette.secondary, 7),
    rect(dialogX + 24, dialogY + 84, dialogWidth - 92, 14, palette.secondary, 7),
    rect(dialogX + dialogWidth - 100, dialogY + dialogHeight - 56, 76, 34, palette.primary, 10),
  ];
}

/**
 * spinner preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildSpinnerPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.24;
  const dots: ScreenDesignMasterPreviewShape[] = [];
  const fills = [
    palette.primary,
    palette.secondary,
    palette.tertiary,
    palette.accent,
    palette.danger,
  ];
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    dots.push(
      circle(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        8,
        fills[index % fills.length],
      ),
    );
  }
  return dots;
}

/**
 * empty state preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildEmptyStatePreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(18, 18, width - 36, height - 36, palette.secondary, 18, palette.line, 1, [10, 10]),
    circle(width / 2, height * 0.34, 28, palette.tertiary),
    rect(width / 2 - 96, height * 0.52, 192, 18, palette.primary, 8),
    rect(width / 2 - 120, height * 0.62, 240, 14, palette.secondary, 7),
    rect(width / 2 - 86, height * 0.72, 172, 14, palette.secondary, 7),
  ];
}

/**
 * primary button preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildPrimaryButtonPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [rect(14, 14, width - 28, height - 28, palette.primary, Math.min(height / 2, 16))];
}

/**
 * icon button preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildIconButtonPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(14, 14, width - 28, height - 28, palette.secondary, 16),
    line([width / 2, 28, width / 2, height - 28], palette.primary, 4, undefined, 'round'),
    line([28, height / 2, width - 28, height / 2], palette.primary, 4, undefined, 'round'),
  ];
}

/**
 * button group preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildButtonGroupPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  const buttonWidth = (width - 56) / 3;
  return [0, 1, 2].map((index) =>
    rect(
      14 + index * (buttonWidth + 14),
      16,
      buttonWidth,
      height - 32,
      index === 1 ? palette.primary : palette.secondary,
      14,
    ),
  );
}

/**
 * 범용 generic preview를 생성한다.
 *
 * @param width preview 너비
 * @param height preview 높이
 * @param palette preview 팔레트
 * @returns preview shape 목록
 */
function buildGenericPreview(
  width: number,
  height: number,
  palette: ScreenDesignMasterPreviewPalette,
): ScreenDesignMasterPreviewShape[] {
  return [
    rect(18, 18, width - 36, 20, palette.primary, 8),
    rect(18, 56, width * 0.42, height - 74, palette.secondary, 14),
    rect(width * 0.48, 56, width * 0.34, height * 0.26, palette.tertiary, 12),
    rect(width * 0.48, height * 0.42, width * 0.34, height * 0.18, palette.secondary, 10),
    rect(width * 0.48, height * 0.68, width * 0.24, 18, palette.accent, 9),
  ];
}

/**
 * 동일한 rect를 수직 stack 형태로 반복 생성한다.
 *
 * @param x 시작 x 좌표
 * @param startY 시작 y 좌표
 * @param width 각 item 너비
 * @param itemHeight 각 item 높이
 * @param count item 개수
 * @param gap item 간격
 * @param fill item fill 색상
 * @param cornerRadius item corner radius
 * @returns 반복 생성된 rect shape 목록
 */
function buildStack(
  x: number,
  startY: number,
  width: number,
  itemHeight: number,
  count: number,
  gap: number,
  fill: string,
  cornerRadius: number,
): ScreenDesignMasterPreviewShape[] {
  return Array.from({ length: count }, (_, index) =>
    rect(x, startY + index * gap, width, itemHeight, fill, cornerRadius),
  );
}

/**
 * rect preview shape를 만든다.
 *
 * @param x x 좌표
 * @param y y 좌표
 * @param width 너비
 * @param height 높이
 * @param fill fill 색상
 * @param cornerRadius corner radius
 * @param stroke 선택적 stroke 색상
 * @param strokeWidth 선택적 stroke 너비
 * @param dash 선택적 dash 패턴
 * @returns rect preview shape
 */
function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  cornerRadius: number,
  stroke?: string,
  strokeWidth?: number,
  dash?: number[],
): ScreenDesignMasterPreviewShape {
  return {
    kind: 'rect',
    x,
    y,
    width,
    height,
    fill,
    cornerRadius,
    stroke,
    strokeWidth,
    dash,
  };
}

/**
 * line preview shape를 만든다.
 *
 * @param points line point 목록
 * @param stroke stroke 색상
 * @param strokeWidth stroke 너비
 * @param dash 선택적 dash 패턴
 * @param lineCap 선택적 line cap
 * @returns line preview shape
 */
function line(
  points: number[],
  stroke: string,
  strokeWidth = 2,
  dash?: number[],
  lineCap?: 'round' | 'square',
): ScreenDesignMasterPreviewShape {
  return {
    kind: 'line',
    points,
    stroke,
    strokeWidth,
    dash,
    lineCap,
  };
}

/**
 * circle preview shape를 만든다.
 *
 * @param x x 좌표
 * @param y y 좌표
 * @param radius 반지름
 * @param fill fill 색상
 * @param stroke 선택적 stroke 색상
 * @param strokeWidth 선택적 stroke 너비
 * @returns circle preview shape
 */
function circle(
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke?: string,
  strokeWidth?: number,
): ScreenDesignMasterPreviewShape {
  return {
    kind: 'circle',
    x,
    y,
    radius,
    fill,
    stroke,
    strokeWidth,
  };
}
