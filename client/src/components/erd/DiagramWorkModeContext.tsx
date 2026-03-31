import { createContext, useContext } from 'react';
import type { DiagramWorkMode, DiagramWorkModeCapabilities } from '@/lib/diagram-work-mode';

/** 작업 모드 컨텍스트 값 */
interface DiagramWorkModeContextValue {
  /** 현재 작업 모드 */
  mode: DiagramWorkMode;
  /** 현재 작업 모드 capability */
  capabilities: DiagramWorkModeCapabilities;
  /** 작업 모드 변경 함수 */
  setMode: (mode: DiagramWorkMode) => void;
}

const DiagramWorkModeContext = createContext<DiagramWorkModeContextValue | null>(null);

/** DiagramWorkModeProvider 컴포넌트 props */
interface DiagramWorkModeProviderProps {
  /** 현재 작업 모드 */
  mode: DiagramWorkMode;
  /** 현재 작업 모드 capability */
  capabilities: DiagramWorkModeCapabilities;
  /** 작업 모드 변경 함수 */
  setMode: (mode: DiagramWorkMode) => void;
  /** 자식 요소 */
  children: React.ReactNode;
}

/**
 * 다이어그램 작업 모드 Provider.
 *
 * @param props.mode 현재 작업 모드
 * @param props.capabilities 현재 작업 모드 capability
 * @param props.setMode 작업 모드 변경 함수
 * @param props.children 자식 요소
 * @returns 작업 모드 Provider JSX
 */
export function DiagramWorkModeProvider({
  mode,
  capabilities,
  setMode,
  children,
}: DiagramWorkModeProviderProps) {
  return (
    <DiagramWorkModeContext.Provider value={{ mode, capabilities, setMode }}>
      {children}
    </DiagramWorkModeContext.Provider>
  );
}

/**
 * 다이어그램 작업 모드 컨텍스트를 소비한다.
 *
 * @returns 작업 모드 컨텍스트 값
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDiagramWorkMode(): DiagramWorkModeContextValue {
  const ctx = useContext(DiagramWorkModeContext);
  if (!ctx) {
    throw new Error('useDiagramWorkMode must be used within DiagramWorkModeProvider');
  }
  return ctx;
}
