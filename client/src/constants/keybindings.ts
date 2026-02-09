/** 키보드 단축키 레지스트리. 모든 단축키를 한 곳에서 정의하여 충돌 방지 및 도움말 생성에 사용한다. */
export const KEYBINDINGS = {
  /** 다이어그램을 서버에 저장한다 (Ctrl+S / Cmd+S) */
  SAVE: 'mod+s',
  /** 선택된 엣지를 삭제한다 (Delete / Backspace) */
  DELETE: 'delete, backspace',
  /** 현재 모드를 취소한다 (Escape) */
  ESCAPE: 'escape',
} as const;
