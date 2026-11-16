import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEdgeLabelContainer } from '../../src/components/erd/edgeLabelContainer';

function createRoot(container: HTMLElement | null, current?: HTMLElement | null) {
  return {
    querySelector: (_selector: string) => container,
    contains: (node: Node) => node === current || node === container,
  } as unknown as ParentNode;
}

function createContainer(isConnected: boolean) {
  return { isConnected } as HTMLElement;
}

test('resolves a container that appears after an earlier null lookup', () => {
  const container = createContainer(true);
  const root = createRoot(container);

  assert.equal(resolveEdgeLabelContainer(root, null), container);
});

test('requeries when the previously resolved container is disconnected', () => {
  const previous = createContainer(false);
  const replacement = createContainer(true);

  assert.equal(resolveEdgeLabelContainer(createRoot(replacement), previous), replacement);
});

test('keeps the current container while it remains connected', () => {
  const current = createContainer(true);

  assert.equal(resolveEdgeLabelContainer(createRoot(null, current), current), current);
});

test('requeries when the React Flow root changes even if the old container stays connected', () => {
  const oldContainer = createContainer(true);
  const replacement = createContainer(true);

  assert.equal(resolveEdgeLabelContainer(createRoot(replacement), oldContainer), replacement);
});
