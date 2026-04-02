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

/** Worker 요청 메시지. */
interface PreviewRequest {
  /** 요청 ID (debounce 후 최신 응답만 사용하기 위해) */
  id: number;
  /** markdown body */
  body: string;
}

/** Worker 응답 메시지. */
interface PreviewResponse {
  /** 요청 ID */
  id: number;
  /** sanitized HTML */
  html: string;
}

self.addEventListener('message', (event: MessageEvent<PreviewRequest>) => {
  const { id, body } = event.data;
  const rawHtml = marked.parse(body, { async: false }) as string;
  const html = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...SANITIZE_POLICY.allowedTags],
    ALLOWED_ATTR: Array.from(
      new Set(Object.values(SANITIZE_POLICY.allowedAttributes).flat()),
    ),
    ADD_ATTR: ['target', 'rel'],
  });
  const response: PreviewResponse = { id, html };
  self.postMessage(response);
});
