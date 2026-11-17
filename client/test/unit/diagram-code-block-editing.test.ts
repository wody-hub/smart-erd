import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CodeBlockEditingController,
  type CodeBlockEditingOptions,
} from '../../src/lib/diagram-code-block-editing.js';
import { generateTableBlock, type ProjectionSnapshot } from '../../src/lib/dsl-block-projection.js';
import type {
  CodeBlockCommit,
  CodeBlockCommitResult,
} from '../../src/lib/code-block-commit-contract.js';

/** 타이머와 문서 적용을 주입하여 실제 블록 계산기를 검증한다. */
function harness(commitOverride?: CodeBlockEditingOptions['commit']) {
  let now = 0,
    sequence = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const snapshot: ProjectionSnapshot = {
    revision: 1,
    dictionary: { terms: [], domains: [] },
    edges: [],
    nodes: [
      {
        id: 't',
        data: {
          label: 'users',
          columns: [{ id: 'c', name: 'value', type: 'INT', nullable: true }],
        },
      },
    ],
  };
  const commits: CodeBlockCommit[] = [];
  let rejection: Extract<CodeBlockCommitResult, { status: 'rejected' }>['reason'] | undefined;
  const controller = new CodeBlockEditingController({
    now: () => now,
    schedule: (run, delay) => {
      const id = ++sequence;
      timers.set(id, { at: now + delay, run });
      return () => {
        timers.delete(id);
      };
    },
    ready: () => true,
    snapshot: () => snapshot,
    fingerprint: () => 'd',
    uuid: () => `id-${++sequence}`,
    commit: (commit) => {
      commits.push(commit);
      if (commitOverride) return commitOverride(commit);
      if (rejection) return { status: 'rejected', commitId: commit.commitId, reason: rejection };
      for (const patch of commit.patches) {
        const data = snapshot.nodes[0].data;
        Object.assign(patch.target === 'table' ? data : data.columns[0], {
          [patch.field]: patch.nextValue,
        });
      }
      return {
        status: 'applied',
        commitId: commit.commitId,
        changedFields: commit.patches.length,
        noop: !commit.patches.length,
      };
    },
    changed: () => {},
    replaceText: (_id, text) => {
      visible = text;
    },
  });
  const block = generateTableBlock('t', snapshot);
  let visible = block.text;
  controller.add(block);
  return {
    controller,
    snapshot,
    commits,
    timers,
    block,
    reject: (reason: typeof rejection) => {
      rejection = reason;
    },
    visible: () => visible,
    edit: (text = block.text.replace('::INT', '::BIGINT')) => {
      visible = text;
      controller.edit('t', text);
    },
    tick: (ms: number) => {
      const end = now + ms;
      for (;;) {
        const item = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!item || item[1].at > end) break;
        now = item[1].at;
        timers.delete(item[0]);
        item[1].run();
      }
      now = end;
    },
  };
}

test('typing coalesces into one idle commit and establishes a history boundary', () => {
  const h = harness();
  h.edit();
  h.tick(400);
  h.edit(h.block.text.replace('::INT', '::TEXT'));
  h.tick(799);
  assert.equal(h.commits.length, 0);
  h.tick(1);
  assert.equal(h.commits.length, 1);
  assert.equal(h.controller.get('t')?.state.status, 'CLEAN');
  assert.equal(h.controller.history('t', 'undo'), 'document');
  h.controller.dispose();
});
test('IME defers leave and readiness loss cancels every timer while preserving text', () => {
  const h = harness();
  h.controller.event('t', 'composition-start');
  h.edit();
  h.controller.event('t', 'leave');
  h.tick(6000);
  assert.equal(h.commits.length, 0);
  h.controller.event('t', 'composition-end');
  assert.equal(h.commits.length, 1);
  h.edit(h.block.text.replace('::INT', '::TEXT'));
  h.controller.setReady(false);
  h.tick(6000);
  assert.equal(h.commits.length, 1);
  assert.equal(h.controller.get('t')?.state.status, 'BLOCKED');
  assert.match(h.visible(), /TEXT/);
  assert.equal(h.timers.size, 0);
  h.controller.dispose();
});
test('remote different field updates base but keeps dirty text; echo is a no-op', () => {
  const h = harness();
  h.edit();
  h.snapshot.nodes[0].data.label = 'remote';
  h.controller.remote(generateTableBlock('t', h.snapshot), []);
  assert.equal(h.visible(), h.block.text.replace('::INT', '::BIGINT'));
  assert.equal(h.controller.get('t')?.remotePending, true);
  h.tick(800);
  assert.deepEqual(
    h.commits[0].patches.map((p) => p.field),
    ['type'],
  );
  const text = h.visible();
  h.controller.remote(generateTableBlock('t', h.snapshot), [h.commits[0].commitId]);
  assert.equal(h.visible(), text);
  h.tick(6000);
  assert.equal(h.commits.length, 1);
  h.controller.dispose();
});
for (const choice of ['mine', 'remote'] as const)
  test(`same field conflict requires ${choice} choice`, () => {
    const h = harness();
    h.edit();
    h.snapshot.nodes[0].data.columns[0].type = 'TEXT';
    h.controller.remote(generateTableBlock('t', h.snapshot), []);
    assert.equal(h.controller.get('t')?.state.status, 'CONFLICT');
    h.tick(6000);
    assert.equal(h.commits.length, 0);
    h.controller.resolve('t', choice);
    h.tick(800);
    assert.equal(h.snapshot.nodes[0].data.columns[0].type, choice === 'mine' ? 'BIGINT' : 'TEXT');
    assert.equal(h.controller.get('t')?.state.status, 'CLEAN');
    h.controller.dispose();
  });
for (const reason of [
  'invalid',
  'dictionary-linked',
  'dictionary-changed',
  'missing-target',
  'not-ready',
  'conflict',
  'duplicate-name',
] as const)
  test(`dispatch ${reason} never loops`, () => {
    const h = harness();
    h.reject(reason);
    h.edit();
    h.tick(6000);
    assert.equal(h.commits.length, 1);
    assert.notEqual(h.controller.get('t')?.state.status, 'CLEAN');
    assert.match(h.visible(), /BIGINT/);
    h.controller.dispose();
  });
test('unsupported structure and invalid syntax stay local; text redo precedes document redo', () => {
  const h = harness();
  h.edit(h.block.text.replace('  value ::INT\n', ''));
  h.tick(1000);
  assert.equal(h.commits.length, 0);
  assert.equal(h.controller.get('t')?.state.status, 'UNSUPPORTED');
  assert.equal(h.controller.history('t', 'undo'), 'text');
  assert.equal(h.visible(), h.block.text);
  assert.equal(h.controller.history('t', 'redo'), 'text');
  assert.notEqual(h.visible(), h.block.text);
  h.edit(h.block.text.replace('::INT', '::!'));
  h.tick(1000);
  assert.equal(h.controller.get('t')?.state.status, 'INVALID');
  h.controller.dispose();
});

test('text undo after a second dirty edit stops at the last committed text and redo stays local', () => {
  const h = harness();
  h.edit();
  h.tick(800);
  const committed = h.visible();
  h.edit(committed.replace('BIGINT', 'TEXT'));
  assert.equal(h.controller.history('t', 'undo'), 'text');
  assert.equal(h.visible(), committed);
  assert.equal(h.controller.get('t')?.state.status, 'CLEAN');
  assert.equal(h.controller.history('t', 'redo'), 'text');
  assert.match(h.visible(), /TEXT/);
  h.controller.dispose();
});
test('conflict remains visible after IME ends and remote deletion cannot be resolved into recreation', () => {
  const h = harness();
  h.controller.event('t', 'composition-start');
  h.edit();
  h.snapshot.nodes[0].data.columns[0].type = 'TEXT';
  h.controller.remote(generateTableBlock('t', h.snapshot), []);
  h.controller.event('t', 'composition-end');
  assert.equal(h.controller.get('t')?.state.status, 'CONFLICT');
  h.snapshot.nodes = [];
  h.controller.remote(undefined, [], 't');
  h.controller.resolve('t', 'mine');
  h.controller.setReady(false);
  h.controller.setReady(true);
  h.tick(6000);
  assert.equal(h.controller.get('t')?.state.blockedReason, 'entity-removed');
  assert.equal(h.commits.length, 0);
  h.controller.dispose();
});

test('typing during COMMITTING remains dirty and the next delta starts from the acknowledged commit', async () => {
  let acknowledge!: (result: CodeBlockCommitResult) => void;
  const response = new Promise<CodeBlockCommitResult>((resolve) => {
    acknowledge = resolve;
  });
  let calls = 0;
  const h = harness((commit) => {
    calls++;
    return calls === 1
      ? response
      : {
          status: 'applied',
          commitId: commit.commitId,
          changedFields: commit.patches.length,
          noop: false,
        };
  });
  h.edit();
  h.tick(800);
  assert.equal(h.controller.get('t')?.state.status, 'COMMITTING');
  h.edit(h.block.text.replace('::INT', '::TEXT'));
  h.snapshot.nodes[0].data.columns[0].type = 'BIGINT';
  acknowledge({
    status: 'applied',
    commitId: h.commits[0].commitId,
    changedFields: 1,
    noop: false,
  });
  await response;
  await Promise.resolve();
  assert.equal(h.controller.get('t')?.state.status, 'DIRTY');
  assert.match(h.visible(), /TEXT/);
  h.tick(800);
  assert.equal(h.commits.length, 2);
  assert.equal(h.commits[1].patches[0].baseValue, 'BIGINT');
  assert.equal(h.commits[1].patches[0].nextValue, 'TEXT');
  h.controller.dispose();
});

test('a mixed own echo that lost the same field keeps the local value in conflict UI', () => {
  const h = harness();
  h.edit();
  h.tick(800);
  h.snapshot.nodes[0].data.columns[0].type = 'TEXT';
  assert.equal(
    h.controller.remote(generateTableBlock('t', h.snapshot), [h.commits[0].commitId]),
    true,
  );
  assert.equal(h.controller.get('t')?.state.status, 'CONFLICT');
  assert.match(h.visible(), /BIGINT/);
  assert.equal(h.controller.get('t')?.conflicts[0].localValue, 'BIGINT');
  h.controller.resolve('t', 'remote');
  assert.match(h.visible(), /TEXT/);
  h.controller.dispose();
});

test('remote NN after text undo drops redo instead of silently reverting nullable', () => {
  const h = harness();
  h.edit();
  h.controller.history('t', 'undo');
  h.snapshot.nodes[0].data.columns[0].nullable = false;
  h.controller.remote(generateTableBlock('t', h.snapshot), []);
  assert.equal(h.controller.get('t')!.redo.length, 0);
  assert.equal(h.controller.history('t', 'redo'), 'document');
  h.tick(1000);
  assert.equal(h.snapshot.nodes[0].data.columns[0].nullable, false);
  assert.equal(h.commits.length, 0);
  h.controller.dispose();
});
test('accepted dirty remote merge drops both text history stacks', () => {
  const h = harness();
  h.edit();
  h.edit(h.block.text.replace('INT', 'TEXT'));
  h.controller.history('t', 'undo');
  h.snapshot.nodes[0].data.columns[0].nullable = false;
  h.controller.remote(generateTableBlock('t', h.snapshot), []);
  assert.equal(h.controller.get('t')!.undo.length, 0);
  assert.equal(h.controller.get('t')!.redo.length, 0);
  h.tick(800);
  assert.equal(h.snapshot.nodes[0].data.columns[0].nullable, false);
  assert.deepEqual(
    h.commits[0].patches.map((p) => p.field),
    ['type'],
  );
  h.controller.dispose();
});
test('apply mine after a committed edit advances current field base without re-conflict', () => {
  const h = harness();
  h.edit();
  h.tick(800);
  h.controller.remote(generateTableBlock('t', h.snapshot), [h.commits[0].commitId]);
  h.edit(h.visible().replace('BIGINT', 'TEXT'));
  h.snapshot.nodes[0].data.columns[0].type = 'VARCHAR';
  h.controller.remote(generateTableBlock('t', h.snapshot), []);
  assert.equal(h.controller.get('t')!.state.status, 'CONFLICT');
  h.controller.resolve('t', 'mine');
  assert.notEqual(h.controller.get('t')!.state.status, 'CONFLICT');
  h.tick(800); // 이전 성공 커밋과의 최소 간격을 유지한다.
  assert.equal(h.commits.length, 2);
  assert.deepEqual(
    h.commits[1].patches.map((p) => [p.field, p.baseValue, p.nextValue]),
    [['type', 'VARCHAR', 'TEXT']],
  );
  assert.equal(h.controller.get('t')!.state.status, 'CLEAN');
  h.controller.dispose();
});
