import { createContext, useContext } from 'react';

const ErdFkModeContext = createContext(false);

/** FK 모드 Provider */
export const ErdFkModeProvider = ErdFkModeContext.Provider;

/**
 * FK 연결 모드 활성 여부를 반환하는 훅.
 *
 * @returns FK 연결 모드 활성 여부
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useErdFkMode(): boolean {
  return useContext(ErdFkModeContext);
}
