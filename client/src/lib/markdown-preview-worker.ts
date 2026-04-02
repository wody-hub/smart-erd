import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const SANITIZE_POLICY = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'input', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    code: ['class'],
    input: ['type', 'checked', 'disabled'],
  },
} as const;

/** Worker 요청 메시지 (전체 body 렌더링 — 하위 호환). */
interface FullPreviewRequest {
  /** 요청 ID (debounce 후 최신 응답만 사용하기 위해) */
  id: number;
  /** markdown body */
  body: string;
}

/** Worker 요청 메시지 (section 단위 렌더링). */
interface SectionPreviewRequest {
  /** 요청 ID */
  id: number;
  /** section 식별자 */
  sectionId: string;
  /** section markdown 텍스트 */
  sectionText: string;
}

/** Worker 응답 메시지 (전체 body). */
interface FullPreviewResponse {
  /** 요청 ID */
  id: number;
  /** sanitized HTML */
  html: string;
}

/** Worker 응답 메시지 (section 단위). */
interface SectionPreviewResponse {
  /** 요청 ID */
  id: number;
  /** section 식별자 */
  sectionId: string;
  /** sanitized HTML */
  html: string;
}

/**
 * markdown 텍스트를 sanitized HTML로 렌더링한다.
 *
 * @param text markdown 텍스트
 * @returns sanitized HTML
 */
function renderAndSanitize(text: string): string {
  const rawHtml = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...SANITIZE_POLICY.allowedTags],
    ALLOWED_ATTR: Array.from(
      new Set(Object.values(SANITIZE_POLICY.allowedAttributes).flat()),
    ),
    ADD_ATTR: ['target', 'rel'],
  });
}

// Worker 모듈 로드 완료 신호 — type: 'module' Worker는 비동기 로드이므로
// 메인 스레드가 이 신호를 받기 전까지는 postMessage가 유실될 수 있다.
self.postMessage({ type: 'ready' });

self.addEventListener('message', (event: MessageEvent<FullPreviewRequest | SectionPreviewRequest>) => {
  const data = event.data;
  if ('sectionId' in data) {
    // section 단위 렌더링
    const html = renderAndSanitize(data.sectionText);
    const response: SectionPreviewResponse = { id: data.id, sectionId: data.sectionId, html };
    self.postMessage(response);
  } else {
    // 전체 body 렌더링 (기존 호환)
    const html = renderAndSanitize(data.body);
    const response: FullPreviewResponse = { id: data.id, html };
    self.postMessage(response);
  }
});
