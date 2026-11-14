import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@xyflow/react';

const EdgeLabelContainerContext = createContext<HTMLElement | null>(null);

/**
 * 캔버스의 edge-label 컨테이너를 한 번 조회해 엣지 하위 요소에 공유한다.
 * @param props React 자식 요소
 * @returns 포털 컨테이너 context provider
 */
export function EdgeLabelPortalProvider({ children }: { children: ReactNode }) {
  const domNode = useStore((state) => state.domNode);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(domNode?.querySelector<HTMLElement>('.react-flow__edgelabel-renderer') ?? null);
  }, [domNode]);

  return (
    <EdgeLabelContainerContext.Provider value={container}>
      {children}
    </EdgeLabelContainerContext.Provider>
  );
}

/**
 * 현재 엣지의 라벨 요소를 공유된 edge-label 컨테이너에 포털 렌더링한다.
 * @param props 포털에 렌더링할 자식 요소
 * @returns edge-label portal 또는 컨테이너가 준비되지 않았으면 null
 */
export function EdgeLabelPortal({ children }: { children: ReactNode }) {
  const container = useContext(EdgeLabelContainerContext);
  return useMemo(
    () => (container ? createPortal(children, container) : null),
    [children, container],
  );
}
