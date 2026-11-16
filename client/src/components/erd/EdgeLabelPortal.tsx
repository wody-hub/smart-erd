import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@xyflow/react';
import { resolveEdgeLabelContainer } from './edgeLabelContainer';

const EdgeLabelContainerContext = createContext<HTMLElement | null>(null);

/**
 * 캔버스의 edge-label 컨테이너를 한 번 조회해 엣지 하위 요소에 공유한다.
 * @param props React 자식 요소
 * @returns 포털 컨테이너 context provider
 */
export function EdgeLabelPortalProvider({ children }: { children: ReactNode }) {
  const domNode = useStore((state) => state.domNode);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const refreshContainer = () => {
      const nextContainer = resolveEdgeLabelContainer(domNode, containerRef.current);
      if (nextContainer === containerRef.current) return;
      containerRef.current = nextContainer;
      setContainer(nextContainer);
    };

    refreshContainer();
    if (!domNode || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(refreshContainer);
    observer.observe(domNode, { childList: true, subtree: true });
    return () => observer.disconnect();
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
