import { useState, useEffect, useRef, useCallback } from 'react';

/** 사이드바 최소 너비(px) */
export const SIDEBAR_MIN_WIDTH = 180;
/** 사이드바 최대 너비(px) */
export const SIDEBAR_MAX_WIDTH = 480;
/** 키보드 리사이즈 이동 단위(px) */
const SIDEBAR_KEYBOARD_STEP = 16;
/** 기본 사이드바 너비(px) */
const SIDEBAR_DEFAULT_WIDTH = 224;

/** useSidebarResize 훅 반환값 */
interface UseSidebarResizeReturn {
  /** 현재 사이드바 너비(px) */
  sidebarWidth: number;
  /** 리사이즈 진행 여부 */
  isSidebarResizing: boolean;
  /** 사이드바 래퍼 DOM ref (리사이즈 중 직접 width 반영) */
  sidebarContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** 사이드바 리사이즈 핸들 ref (접근성 값 실시간 반영) */
  sidebarResizeHandleRef: React.MutableRefObject<HTMLDivElement | null>;
  /** 포인터 기반 리사이즈 시작 핸들러 */
  handleSidebarResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** 키보드 기반 리사이즈 핸들러 */
  handleSidebarResizeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * 사이드바 포인터/키보드 리사이즈 로직을 캡슐화하는 훅.
 *
 * rAF 기반 스로틀, 전역 커서 제어, 접근성 aria-valuenow 반영,
 * 언마운트 시 안전한 정리를 통합 관리한다.
 *
 * @returns 사이드바 리사이즈 상태 및 핸들러
 */
export function useSidebarResize(): UseSidebarResizeReturn {
  /** 좌측 사이드바 너비(px) */
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  /** 사이드바 리사이즈 진행 여부 */
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);

  /** 사이드바 래퍼 DOM ref */
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  /** 사이드바 리사이즈 핸들 ref */
  const sidebarResizeHandleRef = useRef<HTMLDivElement | null>(null);
  /** 최신 사이드바 너비 ref */
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  /** 사이드바 리사이즈 rAF ID */
  const sidebarResizeRafRef = useRef<number | null>(null);
  /** rAF 틱에서 반영할 사이드바 너비 */
  const pendingSidebarWidthRef = useRef<number | null>(null);
  /** 진행 중인 사이드바 리사이즈 정리 함수 */
  const sidebarResizeCleanupRef = useRef<(() => void) | null>(null);
  /** 언마운트 진행 여부 */
  const isUnmountingRef = useRef(false);

  /**
   * 사이드바 너비를 허용 범위로 보정한다.
   *
   * @param width 후보 너비
   * @returns 보정된 너비
   */
  const clampSidebarWidth = (width: number) =>
    Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));

  /** 사이드바 DOM 너비를 즉시 반영한다. */
  const applySidebarWidth = useCallback((width: number) => {
    const sidebarEl = sidebarContainerRef.current;
    if (sidebarEl) {
      sidebarEl.style.width = `${width}px`;
    }
    const resizeHandle = sidebarResizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.setAttribute('aria-valuenow', String(Math.round(width)));
    }
  }, []);

  /**
   * 현재 진행 중인 사이드바 리사이즈 리스너/전역 스타일을 정리한다.
   */
  const cleanupSidebarResize = () => {
    if (!sidebarResizeCleanupRef.current) {
      return;
    }
    sidebarResizeCleanupRef.current();
    sidebarResizeCleanupRef.current = null;
  };

  /**
   * 사이드바 리사이즈 시작 핸들러.
   *
   * @param e PointerDown 이벤트
   */
  const handleSidebarResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
    cleanupSidebarResize();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsSidebarResizing(true);

    /**
     * 리사이즈 중 대기 너비를 상태와 DOM에 반영한다.
     */
    const flushPendingWidth = () => {
      if (sidebarResizeRafRef.current !== null) {
        cancelAnimationFrame(sidebarResizeRafRef.current);
        sidebarResizeRafRef.current = null;
      }
      const nextWidth = pendingSidebarWidthRef.current;
      pendingSidebarWidthRef.current = null;
      if (nextWidth === null) {
        if (!isUnmountingRef.current) {
          setSidebarWidth((prev) =>
            prev === sidebarWidthRef.current ? prev : sidebarWidthRef.current,
          );
        }
        return;
      }
      sidebarWidthRef.current = nextWidth;
      applySidebarWidth(nextWidth);
      if (!isUnmountingRef.current) {
        setSidebarWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
    };

    /**
     * pointermove 중 사이드바 너비를 갱신한다.
     *
     * @param ev PointerEvent
     */
    const handleMove = (ev: PointerEvent) => {
      pendingSidebarWidthRef.current = clampSidebarWidth(startWidth + (ev.clientX - startX));
      if (sidebarResizeRafRef.current !== null) {
        return;
      }
      sidebarResizeRafRef.current = requestAnimationFrame(() => {
        sidebarResizeRafRef.current = null;
        const nextWidth = pendingSidebarWidthRef.current;
        pendingSidebarWidthRef.current = null;
        if (nextWidth === null) {
          return;
        }
        if (nextWidth === sidebarWidthRef.current) {
          return;
        }
        sidebarWidthRef.current = nextWidth;
        applySidebarWidth(nextWidth);
      });
    };

    /**
     * 리사이즈 종료 시 리스너와 전역 상태를 정리한다.
     */
    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('blur', handleEnd);
      flushPendingWidth();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (!isUnmountingRef.current) {
        setIsSidebarResizing(false);
      }
      sidebarResizeCleanupRef.current = null;
    };

    sidebarResizeCleanupRef.current = handleEnd;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('blur', handleEnd);
  };

  /**
   * 키보드 기반 사이드바 리사이즈 핸들러.
   *
   * ArrowLeft/ArrowRight로 너비를 조절하고, Home/End로 최소/최대로 이동한다.
   *
   * @param e 키보드 이벤트
   */
  const handleSidebarResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev - SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth((prev) => clampSidebarWidth(prev + SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  // sidebarWidth 변경 시 DOM에 반영
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
    applySidebarWidth(sidebarWidth);
  }, [sidebarWidth, applySidebarWidth]);

  // 언마운트 시 리사이즈 리소스 정리
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (sidebarResizeCleanupRef.current) {
        sidebarResizeCleanupRef.current();
        sidebarResizeCleanupRef.current = null;
      }
      if (sidebarResizeRafRef.current !== null) {
        cancelAnimationFrame(sidebarResizeRafRef.current);
        sidebarResizeRafRef.current = null;
      }
      pendingSidebarWidthRef.current = null;
    };
  }, []);

  return {
    sidebarWidth,
    isSidebarResizing,
    sidebarContainerRef,
    sidebarResizeHandleRef,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
  };
}
