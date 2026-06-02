import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKeys } from '../../src/constants/query-keys.js';
import {
  getAiProviderAvailabilityPresentation,
  isAiProviderAvailability,
} from '../../src/types/ai-provider.js';

test('getAiProviderAvailabilityPresentation maps available runtime to ready tone', () => {
  assert.deepEqual(getAiProviderAvailabilityPresentation('AVAILABLE'), {
    labelKey: 'aiProvider.availability.available',
    tone: 'ready',
  });
});

test('getAiProviderAvailabilityPresentation keeps unknown runtime unavailable', () => {
  assert.deepEqual(getAiProviderAvailabilityPresentation('UNKNOWN'), {
    labelKey: 'aiProvider.availability.unknown',
    tone: 'muted',
  });
});

test('isAiProviderAvailability accepts only backend availability states', () => {
  assert.equal(isAiProviderAvailability('CODEX_NOT_LOGGED_IN'), true);
  assert.equal(isAiProviderAvailability('UNKNOWN'), false);
});

test('ai provider query keys are stable and isolated from project resources', () => {
  assert.deepEqual(queryKeys.aiProvider.status(), ['ai-provider', 'status']);
  assert.deepEqual(queryKeys.aiProvider.execution('exec-1'), [
    'ai-provider',
    'executions',
    'exec-1',
  ]);
});

test('ai chat query keys are stable and isolated from provider executions', () => {
  assert.deepEqual(queryKeys.aiChat.send(), ['ai-chat', 'send']);
  assert.deepEqual(queryKeys.aiChat.metadata('thread-1'), ['ai-chat', 'metadata', 'thread-1']);
  assert.notDeepEqual(queryKeys.aiChat.send(), queryKeys.aiProvider.status());
});
