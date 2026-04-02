import { useCallback, useEffect, useRef, useState } from 'react';
import { renderMarkdownPreview } from '@/lib/markdown';
import { computeSectionBoundaries } from '@/lib/markdown-section-index';
import { SectionPreviewCache } from '@/lib/markdown-section-preview-cache';

/** section 단위 Worker 응답 메시지. */
interface SectionPreviewResponse {
  /** 요청 ID */
  id: number;
  /** section 식별자 */
  sectionId: string;
  /** sanitized HTML */
  html: string;
}

/** 전체 body Worker 응답 메시지 (하위 호환). */
interface FullPreviewResponse {
  /** 요청 ID */
  id: number;
  /** sanitized HTML */
  html: string;
}

/** 프리뷰 debounce 지연 (ms). */
const PREVIEW_DEBOUNCE_MS = 300;

/**
 * section-aware 증분 프리뷰 훅.
 *
 * 변경된 section만 Worker에 재렌더링 요청하고 나머지 section은 캐시된 HTML을 유지한다.
 * section 구조 변경(heading 추가/삭제) 시 전체 재렌더링 fallback.
 *
 * @param body markdown 본문
 * @returns sanitized preview HTML (전체 section 조합)
 */
export function useMarkdownSectionPreview(body: string): string {
  const [html, setHtml] = useState(() => renderMarkdownPreview(body));
  const workerRef = useRef<Worker | null>(null);
  const workerFailedRef = useRef(false);
  /** Worker 모듈 로드 완료 여부 (type: 'module' Worker는 비동기 로드) */
  const workerReadyRef = useRef(false);
  /** Worker ready 전 대기 중인 요청 큐 */
  const pendingQueueRef = useRef<Array<{ id: number; sectionId: string; sectionText: string }>>(
    [],
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef(new SectionPreviewCache());
  const prevBodyRef = useRef<string>('');
  /** section별 최신 requestId 추적 (Pitfall 4 방어) */
  const requestIdMapRef = useRef(new Map<string, number>());
  /** 전역 requestId 카운터 */
  const requestIdCounterRef = useRef(0);

  useEffect(() => {
    if (workerFailedRef.current) {
      return;
    }
    try {
      const worker = new Worker(
        new URL('../lib/markdown-preview-worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.addEventListener(
        'message',
        (event: MessageEvent<SectionPreviewResponse | FullPreviewResponse | { type: 'ready' }>) => {
          const data = event.data;
          // Worker 모듈 로드 완료 신호 처리
          if ('type' in data && data.type === 'ready') {
            workerReadyRef.current = true;
            // 대기 중인 요청 전송
            for (const req of pendingQueueRef.current) {
              worker.postMessage(req);
            }
            pendingQueueRef.current = [];
            return;
          }
          if ('sectionId' in data) {
            // section 단위 응답: requestId가 최신인지 검증
            const expectedId = requestIdMapRef.current.get(data.sectionId);
            if (expectedId !== data.id) {
              return; // 이전 요청의 응답 — 무시
            }
            cacheRef.current.setHtml(data.sectionId, data.html);
            setHtml(cacheRef.current.buildFullHtml());
          } else {
            // 전체 body 응답 (fallback 시) — 직접 반영
            setHtml(data.html);
          }
        },
      );
      worker.addEventListener('error', () => {
        workerFailedRef.current = true;
        worker.terminate();
        workerRef.current = null;
      });
      workerRef.current = worker;
    } catch {
      workerFailedRef.current = true;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /**
   * section 단위 프리뷰를 요청한다.
   *
   * @param nextBody 새 markdown body
   */
  const requestSectionPreview = useCallback((nextBody: string) => {
    const cache = cacheRef.current;
    const prevBody = prevBodyRef.current;
    prevBodyRef.current = nextBody;

    const newBoundaries = computeSectionBoundaries(nextBody);
    const newIds = newBoundaries.map((b) => b.id);

    // section 순서 변경 감지 → 전체 재렌더링
    const orderChanged = cache.updateSectionOrder(newIds);

    if (orderChanged) {
      cache.invalidateAll();
    }

    // Worker 사용 불가 시 메인 스레드 fallback
    if (!workerRef.current || workerFailedRef.current) {
      for (const boundary of newBoundaries) {
        const sectionText = nextBody.slice(boundary.startOffset, boundary.endOffset);
        cache.setHtml(boundary.id, renderMarkdownPreview(sectionText));
      }
      setHtml(cache.buildFullHtml());
      return;
    }

    // 변경된 section 식별
    const prevBoundaries = prevBody ? computeSectionBoundaries(prevBody) : [];
    const prevTextMap = new Map<string, string>();
    for (const b of prevBoundaries) {
      prevTextMap.set(b.id, prevBody.slice(b.startOffset, b.endOffset));
    }

    /** 재렌더링 대상 section ID 목록 */
    const sectionsToRender: Array<{ id: string; text: string }> = [];

    for (const boundary of newBoundaries) {
      const sectionText = nextBody.slice(boundary.startOffset, boundary.endOffset);
      const prevText = prevTextMap.get(boundary.id);

      // 순서 변경 or 새 section or 내용 변경 → 재렌더링 대상
      if (orderChanged || prevText === undefined || prevText !== sectionText) {
        sectionsToRender.push({ id: boundary.id, text: sectionText });
      }
    }

    // 재렌더링할 section이 없으면 캐시 그대로 반환
    if (sectionsToRender.length === 0) {
      setHtml(cache.buildFullHtml());
      return;
    }

    // section별 Worker 요청 (Pitfall 4: section별 requestId 관리)
    const worker = workerRef.current;
    for (const section of sectionsToRender) {
      const id = ++requestIdCounterRef.current;
      requestIdMapRef.current.set(section.id, id);
      const msg = { id, sectionId: section.id, sectionText: section.text };
      if (workerReadyRef.current) {
        worker.postMessage(msg);
      } else {
        // Worker 모듈 로드 미완료 — 큐에 저장하고 메인 스레드 fallback 즉시 반영
        pendingQueueRef.current.push(msg);
        cacheRef.current.setHtml(section.id, renderMarkdownPreview(section.text));
      }
    }
    // Worker 미준비 시 메인 스레드 fallback 결과를 즉시 반영
    if (!workerReadyRef.current && sectionsToRender.length > 0) {
      setHtml(cacheRef.current.buildFullHtml());
    }
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      requestSectionPreview(body);
      timerRef.current = null;
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [body, requestSectionPreview]);

  return html;
}
