import { useCallback, useEffect, useRef, useState } from 'react';

/** 사이드바 최소 너비 (px) */
const SIDEBAR_MIN_WIDTH = 180;
/** 사이드바 최대 너비 (px) */
const SIDEBAR_MAX_WIDTH = 480;
/** 사이드바 키보드 리사이즈 단위 (px) */
const SIDEBAR_KEYBOARD_STEP = 16;

/**
 * useSidebarResize 훅의 반환 타입.
 */
interface UseSidebarResizeReturn {
  /** 현재 사이드바 너비 (px) */
  sidebarWidth: number;
  /** 리사이즈 진행 여부 */
  isSidebarResizing: boolean;
  /** 사이드바 컨테이너 DOM ref */
  sidebarContainerRef: React.RefObject<HTMLDivElement | null>;
  /** 리사이즈 핸들 DOM ref */
  sidebarResizeHandleRef: React.RefObject<HTMLDivElement | null>;
  /** 리사이즈 시작 핸들러 */
  handleResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** 키보드 리사이즈 핸들러 */
  handleResizeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** 최소 너비 */
  minWidth: number;
  /** 최대 너비 */
  maxWidth: number;
}

/**
 * 사이드바 드래그/키보드 리사이즈를 관리하는 훅.
 *
 * PointerEvent 기반 드래그, ArrowLeft/Right 키보드 조절, Home/End 극한값 이동,
 * rAF 쓰로틀링을 통한 성능 최적화, 언마운트 시 리소스 정리를 캡슐화한다.
 *
 * @param initialWidth 초기 사이드바 너비 (기본값: 224px)
 * @returns 사이드바 리사이즈 상태 및 핸들러
 */
export function useSidebarResize(initialWidth: number = 224): UseSidebarResizeReturn {
  /** 좌측 사이드바 너비(px) */
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  /** 사이드바 리사이즈 진행 여부 */
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);

  /** 진행 중인 사이드바 리사이즈 정리 함수 */
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  /** 언마운트 진행 여부 */
  const isUnmountingRef = useRef(false);
  /** 사이드바 래퍼 DOM ref (리사이즈 중 직접 width 반영) */
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  /** 사이드바 리사이즈 핸들 ref (접근성 값 실시간 반영) */
  const sidebarResizeHandleRef = useRef<HTMLDivElement | null>(null);
  /** 최신 사이드바 너비 ref */
  const widthRef = useRef(initialWidth);
  /** 사이드바 리사이즈 rAF ID */
  const rafRef = useRef<number | null>(null);
  /** rAF 틱에서 반영할 사이드바 너비 */
  const pendingWidthRef = useRef<number | null>(null);

  /**
   * 사이드바 너비를 허용 범위로 보정한다.
   *
   * @param width 후보 너비
   * @returns 보정된 너비
   */
  const clampWidth = (width: number) =>
    Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));

  /** 사이드바 DOM 너비를 즉시 반영한다. */
  const applyWidth = useCallback((width: number) => {
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
   *
   * @returns 없음
   */
  const cleanupResize = () => {
    if (!resizeCleanupRef.current) return;
    resizeCleanupRef.current();
    resizeCleanupRef.current = null;
  };

  /**
   * 사이드바 리사이즈 시작 핸들러.
   *
   * @param e PointerDown 이벤트
   * @returns 없음
   */
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
    cleanupResize();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsSidebarResizing(true);

    /**
     * 리사이즈 중 대기 너비를 상태와 DOM에 반영한다.
     *
     * @returns 없음
     */
    const flushPendingWidth = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const nextWidth = pendingWidthRef.current;
      pendingWidthRef.current = null;
      if (nextWidth === null) {
        if (!isUnmountingRef.current) {
          setSidebarWidth((prev) => (prev === widthRef.current ? prev : widthRef.current));
        }
        return;
      }
      widthRef.current = nextWidth;
      applyWidth(nextWidth);
      if (!isUnmountingRef.current) {
        setSidebarWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
    };

    /**
     * pointermove 중 사이드바 너비를 갱신한다.
     *
     * @param ev PointerEvent
     * @returns 없음
     */
    const handleMove = (ev: PointerEvent) => {
      pendingWidthRef.current = clampWidth(startWidth + (ev.clientX - startX));
      if (rafRef.current !== null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const nextWidth = pendingWidthRef.current;
        pendingWidthRef.current = null;
        if (nextWidth === null) {
          return;
        }
        if (nextWidth === widthRef.current) {
          return;
        }
        widthRef.current = nextWidth;
        applyWidth(nextWidth);
      });
    };

    /**
     * 리사이즈 종료 시 리스너와 전역 상태를 정리한다.
     *
     * @returns 없음
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
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current = handleEnd;
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
   * @returns 없음
   */
  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth((prev) => clampWidth(prev - SIDEBAR_KEYBOARD_STEP));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth((prev) => clampWidth(prev + SIDEBAR_KEYBOARD_STEP));
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

  // sidebarWidth 변경 시 ref와 DOM 동기화
  useEffect(() => {
    widthRef.current = sidebarWidth;
    applyWidth(sidebarWidth);
  }, [sidebarWidth, applyWidth]);

  // 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (resizeCleanupRef.current) {
        resizeCleanupRef.current();
        resizeCleanupRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingWidthRef.current = null;
    };
  }, []);

  return {
    sidebarWidth,
    isSidebarResizing,
    sidebarContainerRef,
    sidebarResizeHandleRef,
    handleResizeStart,
    handleResizeKeyDown,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
  };
}
