import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement, ReactNode } from 'react';
import AiAnswerCard from '../../src/components/ai/AiAnswerCard.js';
import AiSourceChips from '../../src/components/ai/AiSourceChips.js';
import type { AiChatResponse } from '../../src/types/ai-chat.js';

function renderNode(node: ReactNode): ReactNode {
  if (!node || typeof node !== 'object' || !('type' in node) || !('props' in node)) {
    return node;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function') {
    const renderComponent = element.type as unknown as (props: typeof element.props) => ReactNode;
    return renderNode(renderComponent(element.props));
  }
  return {
    ...element,
    props: {
      ...element.props,
      children: Array.isArray(element.props.children)
        ? element.props.children.map(renderNode)
        : renderNode(element.props.children),
    },
  };
}

function textContent(node: ReactNode): string {
  const rendered = renderNode(node);
  if (typeof rendered === 'string' || typeof rendered === 'number') {
    return String(rendered);
  }
  if (Array.isArray(rendered)) {
    return rendered.map(textContent).join(' ');
  }
  if (!rendered || typeof rendered !== 'object' || !('props' in rendered)) {
    return '';
  }
  const element = rendered as ReactElement<{ children?: ReactNode }>;
  return textContent(element.props.children);
}

const response: AiChatResponse = {
  status: 'ANSWER',
  conclusion: 'Delayed issues need attention.',
  interpretation: 'API work is the main risk.',
  confirmedFacts: ['Delayed issues: 2', 'WBS risk count: 1'],
  needsConfirmation: ['Confirm the reporting period.'],
  sourceChips: [{ projectName: 'Alpha Project', tool: 'issues', count: 12 }],
};

test('10-W0-06 source chips render project tool and count labels', () => {
  const text = textContent(AiSourceChips({ chips: response.sourceChips }));

  assert.match(text, /Alpha Project\s*-\s*issues\s*12/);
});

test('10-W0-06 answer card separates conclusion facts interpretation and confirmation sections', () => {
  const text = textContent(AiAnswerCard({ response }));

  assert.match(text, /Delayed issues need attention/);
  assert.match(text, /확인된 사실/);
  assert.match(text, /Delayed issues: 2/);
  assert.match(text, /해석/);
  assert.match(text, /API work is the main risk/);
  assert.match(text, /확인이 필요합니다/);
  assert.match(text, /Confirm the reporting period/);
});

test('10-W0-06 error card exposes localized error state', () => {
  const text = textContent(
    AiAnswerCard({
      response: {
        status: 'ERROR',
        conclusion: '',
        interpretation: '',
        confirmedFacts: [],
        needsConfirmation: [],
        sourceChips: [],
        error: 'AI 응답을 만들지 못했습니다.',
      },
    }),
  );

  assert.match(text, /AI 응답을 만들지 못했습니다/);
});

test('10-W0-06 answer card never renders action proposal approval or delete controls', () => {
  const text = textContent(AiAnswerCard({ response }));

  assert.doesNotMatch(text, /approval|approve|preview|diff|execute|delete|destructive/i);
  assert.doesNotMatch(text, /승인|실행|삭제|미리보기/);
});
