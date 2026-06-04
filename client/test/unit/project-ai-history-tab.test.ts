import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import type { ReactElement, ReactNode } from 'react';
import { ProjectAiHistoryList } from '../../src/components/project/ProjectAiHistoryTab.js';
import type { AiProjectHistoryItem } from '../../src/types/ai-history.js';

const aiHistoryTranslations = {
  aiHistory: {
    title: 'AI History',
    loading: 'AI history를 불러오는 중...',
    empty: '아직 AI history가 없습니다',
    emptyDescription: 'AI 제안 또는 승인 판단이 발생하면 이 탭에 표시됩니다.',
    error: 'AI history를 불러오지 못했습니다',
    resultCount: '{{count}}건 표시 중 · 최대 {{limit}}건',
    hasMore: '더 많은 이력이 있습니다',
    emptyValue: '-',
    column: {
      status: '상태 / 위험도',
      action: '액션 / Provider',
      target: '대상',
      requester: '요청자',
      decision: '판단자',
      created: '생성',
      decided: '판단',
      ids: 'ID',
      error: '요약 / 오류',
    },
  },
};

if (!i18next.isInitialized) {
  await i18next.init({
    lng: 'ko',
    fallbackLng: 'ko',
    resources: { ko: { translation: aiHistoryTranslations } },
    interpolation: { escapeValue: false },
  });
} else {
  i18next.addResourceBundle('ko', 'translation', aiHistoryTranslations, true, true);
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

function countElementsByType(node: ReactNode, type: string): number {
  const rendered = renderNode(node);
  if (Array.isArray(rendered)) {
    return rendered.reduce((count, child) => count + countElementsByType(child, type), 0);
  }
  if (!rendered || typeof rendered !== 'object' || !('props' in rendered)) {
    return 0;
  }
  const element = rendered as ReactElement<{ children?: ReactNode }>;
  const current = element.type === type ? 1 : 0;
  return current + countElementsByType(element.props.children, type);
}

function historyItem(overrides: Partial<AiProjectHistoryItem> = {}): AiProjectHistoryItem {
  return {
    kind: 'proposal',
    executionId: 'exec-1',
    proposalId: 'proposal-1',
    provider: 'codex',
    promptVersion: 'v1',
    actionType: 'issue.create',
    riskLevel: 'LOW',
    status: 'EXECUTED',
    targetType: 'issue',
    targetId: 'ISS-1',
    targetLabel: 'Risk issue',
    summary: 'Created issue proposal',
    requestedBy: 'requester-1',
    decisionBy: 'manager-1',
    createdAt: '2026-06-04T01:00:00Z',
    decidedAt: '2026-06-04T01:05:00Z',
    redactedErrorTitle: null,
    redactedErrorDetail: null,
    activityAt: '2026-06-04T01:05:00Z',
    ...overrides,
  };
}

test('11-W4-05 project AI history list renders loading empty and error states', () => {
  assert.match(textContent(ProjectAiHistoryList({ items: [], isLoading: true })), /불러오는 중/);
  assert.match(textContent(ProjectAiHistoryList({ items: [] })), /아직 AI history가 없습니다/);
  assert.match(
    textContent(ProjectAiHistoryList({ items: [], errorMessage: '권한이 없습니다' })),
    /권한이 없습니다/,
  );
});

test('11-W4-05 project AI history list renders sanitized read-only rows', () => {
  const list = ProjectAiHistoryList({
    items: [
      historyItem(),
      historyItem({
        executionId: 'exec-2',
        proposalId: 'proposal-2',
        actionType: 'todo.update',
        status: 'REJECTED',
        targetLabel: 'Personal TODO',
        redactedErrorTitle: 'Unsupported action',
        redactedErrorDetail: 'Future executor required',
      }),
    ],
    hasMore: true,
    limit: 50,
    locale: 'ko',
  });
  const text = textContent(list);

  assert.match(text, /EXECUTED/);
  assert.match(text, /issue\.create/);
  assert.match(text, /Risk issue/);
  assert.match(text, /requester-1/);
  assert.match(text, /manager-1/);
  assert.match(text, /proposal-1/);
  assert.match(text, /Unsupported action/);
  assert.match(text, /Future executor required/);
  assert.match(text, /더 많은 이력이 있습니다/);
  assert.equal(countElementsByType(list, 'button'), 0);
  assert.doesNotMatch(text, /승인|취소|Approve|Cancel|payload|rawPrompt|stdout/);
});
