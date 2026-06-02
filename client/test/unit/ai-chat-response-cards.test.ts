import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import type { ReactElement, ReactNode } from 'react';
import AiAnswerCard from '../../src/components/ai/AiAnswerCard.js';
import AiSourceChips from '../../src/components/ai/AiSourceChips.js';
import type { AiChatResponse } from '../../src/types/ai-chat.js';

const aiChatTestTranslations = {
  aiChat: {
    answer: {
      confirmedFacts: '확인된 사실',
      interpretation: '해석',
      needsConfirmation: '확인이 필요합니다',
    },
    sourceChips: {
      label: '사용한 자료',
      currentScope: '현재 범위',
    },
    error: {
      title: 'AI 응답 오류',
      fallback: 'AI 응답을 만들지 못했습니다.',
    },
  },
};

if (!i18next.isInitialized) {
  await i18next.init({
    lng: 'ko',
    fallbackLng: 'ko',
    resources: { ko: { translation: aiChatTestTranslations } },
    interpolation: { escapeValue: false },
  });
} else {
  i18next.addResourceBundle('ko', 'translation', aiChatTestTranslations, true, true);
  await i18next.changeLanguage('ko');
}

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

function renderedElement(node: ReactNode): ReactElement<Record<string, unknown>> {
  const rendered = renderNode(node);
  if (!rendered || typeof rendered !== 'object' || !('props' in rendered)) {
    assert.fail('Expected rendered React element');
  }
  return rendered as ReactElement<Record<string, unknown>>;
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

function indexOfText(node: ReactNode, text: RegExp): number {
  const content = textContent(node);
  const match = text.exec(content);
  return match?.index ?? -1;
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
  const chips = AiSourceChips({ chips: response.sourceChips });
  const element = renderedElement(chips);
  const text = textContent(chips);

  assert.equal(element.props['aria-label'], '사용한 자료');
  assert.match(text, /Alpha Project\s*-\s*issues\s*12/);
  assert.doesNotMatch(String(element.props.className), /bg-gray|text-blue|bg-emerald|#[0-9A-Fa-f]/);
});

test('10-W0-06 answer card separates conclusion facts interpretation and confirmation sections', () => {
  const card = AiAnswerCard({ response });
  const text = textContent(card);

  assert.match(text, /Delayed issues need attention/);
  assert.match(text, /확인된 사실/);
  assert.match(text, /Delayed issues: 2/);
  assert.match(text, /해석/);
  assert.match(text, /API work is the main risk/);
  assert.match(text, /확인이 필요합니다/);
  assert.match(text, /Confirm the reporting period/);
  assert.ok(indexOfText(card, /Delayed issues need attention/) < indexOfText(card, /Alpha Project/));
  assert.ok(indexOfText(card, /Alpha Project/) < indexOfText(card, /확인된 사실/));
  assert.ok(indexOfText(card, /확인된 사실/) < indexOfText(card, /해석/));
  assert.ok(indexOfText(card, /해석/) < indexOfText(card, /확인이 필요합니다/));
});

test('10-W0-06 answer card does not fabricate empty fact sections', () => {
  const text = textContent(
    AiAnswerCard({
      response: {
        ...response,
        confirmedFacts: [],
        interpretation: '',
        needsConfirmation: ['Select a project before asking about project data.'],
      },
    }),
  );

  assert.doesNotMatch(text, /확인된 사실/);
  assert.match(text, /확인이 필요합니다/);
  assert.match(text, /Select a project before asking about project data/);
});

test('10-W0-06 error card exposes localized error state', () => {
  const errorCard = AiAnswerCard({
      response: {
        status: 'ERROR',
        conclusion: '',
        interpretation: '',
        confirmedFacts: [],
        needsConfirmation: [],
        sourceChips: [],
        error: 'AI 응답을 만들지 못했습니다.',
      },
    });
  const element = renderedElement(errorCard);
  const text = textContent(errorCard);

  assert.equal(element.props.role, 'alert');
  assert.match(text, /AI 응답을 만들지 못했습니다/);
});

test('10-W0-06 answer card never renders action proposal approval or delete controls', () => {
  const text = textContent(AiAnswerCard({ response }));

  assert.doesNotMatch(text, /approval|approve|preview|diff|execute|delete|destructive/i);
  assert.doesNotMatch(text, /승인|실행|삭제|미리보기/);
});
