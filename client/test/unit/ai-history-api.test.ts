import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_HISTORY_DEFAULT_LIMIT,
  fetchProjectAiHistory,
  setAiHistoryHttpClientForTesting,
} from '../../src/api/aiHistoryApi.js';
import { queryKeys } from '../../src/constants/query-keys.js';
import type { AiProjectHistoryResponse } from '../../src/types/ai-history.js';

test('11-W4-05 project AI history API uses project path and default limit', async () => {
  const response: AiProjectHistoryResponse = {
    items: [],
    limit: AI_HISTORY_DEFAULT_LIMIT,
    hasMore: false,
  };
  const calls: unknown[][] = [];
  const restore = setAiHistoryHttpClientForTesting({
    get: async (...args: unknown[]) => {
      calls.push(args);
      return { data: response };
    },
  });

  try {
    assert.deepEqual(await fetchProjectAiHistory('1', '2'), response);
    assert.equal(AI_HISTORY_DEFAULT_LIMIT, 50);
    assert.equal(calls[0]?.[0], '/teams/1/projects/2/ai-history');
    assert.deepEqual(calls[0]?.[1], { params: { limit: 50 } });
    assert.deepEqual(queryKeys.aiHistory.project('1', '2', 50), [
      'teams',
      '1',
      'projects',
      '2',
      'ai-history',
      50,
    ]);
  } finally {
    restore();
  }
});
