import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPACT_TABLE_RENDERING_NODE_LIMIT,
  resolveCompactTableRenderingMode,
  resolveInteractiveCompactTableMode,
  resolvePreviewCompactTableMode,
  selectCompactOverviewColumns,
} from '../../src/components/erd/CompactTableRenderingContext.js';

test('resolveCompactTableRenderingMode 는 대형 ERD 와 낮은 zoom 에서도 compact 렌더링을 끈다', () => {
  assert.equal(
    resolveCompactTableRenderingMode(COMPACT_TABLE_RENDERING_NODE_LIMIT + 1, 0.4),
    'off',
  );
});

test('compact table 렌더링은 직접 compact 입력이 들어와도 컬럼을 축약하지 않는다', () => {
  const columns = [{ id: 'id' }, { id: 'name' }, { id: 'createdAt' }];
  const connectedColumnIds = new Set(['name']);

  assert.equal(
    resolveInteractiveCompactTableMode('compact', {
      selected: false,
      isEditing: false,
      fkMode: false,
      expanded: false,
    }),
    'off',
  );
  assert.equal(resolvePreviewCompactTableMode('aggressive'), 'off');
  assert.deepEqual(selectCompactOverviewColumns(columns, connectedColumnIds), columns);
});
