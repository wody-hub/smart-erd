/** 키보드 단축키 레지스트리. 모든 단축키를 한 곳에서 정의하여 충돌 방지 및 도움말 생성에 사용한다. */
export const KEYBINDINGS = {
  /** 다이어그램을 서버에 저장한다 (Ctrl+S / Cmd+S) */
  SAVE: 'mod+s',
  /** 마지막 캔버스 변경을 되돌린다 (Ctrl+Z / Cmd+Z) */
  UNDO: 'mod+z',
  /** 되돌린 캔버스 변경을 다시 적용한다 (Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y) */
  REDO: 'mod+shift+z, ctrl+y',
  /** 선택된 엣지를 삭제한다 (Delete / Backspace) */
  DELETE: 'delete, backspace',
  /** 현재 모드를 취소한다 (Escape) */
  ESCAPE: 'escape',
} as const;

/** DOM KeyboardEvent.key 상수. React onKeyDown 핸들러에서 사용한다. */
export const KEYS = {
  /** Escape 키 */
  ESCAPE: 'Escape',
  /** Enter 키 */
  ENTER: 'Enter',
  /** 위쪽 화살표 */
  ARROW_UP: 'ArrowUp',
  /** 아래쪽 화살표 */
  ARROW_DOWN: 'ArrowDown',
} as const;
