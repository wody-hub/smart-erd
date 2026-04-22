import { useCallback, useEffect, useRef, useState } from 'react';
import { renderMarkdownPreview } from '@/lib/markdown';

/** Worker 응답 메시지. */
interface PreviewResponse {
  /** 요청 ID */
  id: number;
  /** sanitized HTML */
  html: string;
}

/** 프리뷰 debounce 지연 (ms). */
const PREVIEW_DEBOUNCE_MS = 300;

/**
 * markdown body를 Web Worker에서 비동기로 렌더링하는 훅.
 *
 * Worker 로드 실패 시 메인 스레드 fallback으로 동작한다.
 *
 * @param body markdown 본문
 * @returns sanitized preview HTML
 */
export function useMarkdownPreview(body: string): string {
  const [html, setHtml] = useState(() => renderMarkdownPreview(body));
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerFailedRef = useRef(false);

  useEffect(() => {
    if (workerFailedRef.current) {
      return;
    }
    try {
      const worker = new Worker(new URL('../lib/markdown-preview-worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.addEventListener('message', (event: MessageEvent<PreviewResponse>) => {
        if (event.data.id === requestIdRef.current) {
          setHtml(event.data.html);
        }
      });
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

  const requestPreview = useCallback((nextBody: string) => {
    const id = ++requestIdRef.current;
    if (workerRef.current && !workerFailedRef.current) {
      workerRef.current.postMessage({ id, body: nextBody });
    } else {
      setHtml(renderMarkdownPreview(nextBody));
    }
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      requestPreview(body);
      timerRef.current = null;
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [body, requestPreview]);

  return html;
}
