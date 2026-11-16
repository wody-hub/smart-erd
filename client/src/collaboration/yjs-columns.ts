import * as Y from 'yjs';
import { CANVAS_HISTORY_ORIGIN } from '@/constants/canvas-history';

/** 컬럼 본체와 표시 순서를 분리한 추가 스키마. 레거시 배열은 수정하지 않는다. */
export interface ColumnStorage {
  columnsById: Y.Map<Y.Map<unknown>>;
  columnOrder: Y.Array<string>;
}

/**
 * 신형 컬럼 본체를 순서대로 읽거나 레거시 배열로 폴백한다. 읽기는 문서를 변경하지 않는다.
 * @param table 테이블 Y.Map
 * @returns 중복/고아 순서를 정리한 컬럼 본체 목록
 */
export function readColumnYMaps(table: Y.Map<unknown>): Y.Map<unknown>[] {
  const bodies = table.get('columnsById');
  if (!(bodies instanceof Y.Map)) {
    const legacy = table.get('columns');
    return legacy instanceof Y.Array ? legacy.toArray() : [];
  }
  const order = table.get('columnOrder');
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of order instanceof Y.Array ? order.toArray() : []) {
    if (typeof id === 'string' && !seen.has(id) && bodies.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }
  ids.push(...[...bodies.keys()].filter((id) => !seen.has(id)).sort());
  return ids
    .map((id) => bodies.get(id))
    .filter((body): body is Y.Map<unknown> => body instanceof Y.Map);
}

/**
 * 현재 읽기 스키마에서 컬럼을 찾는다.
 * @param table 테이블
 * @param id 컬럼 ID
 * @returns 컬럼 본체 또는 undefined
 */
export function getColumnYMap(table: Y.Map<unknown>, id: string): Y.Map<unknown> | undefined {
  const bodies = table.get('columnsById');
  return bodies instanceof Y.Map
    ? bodies.get(id)
    : readColumnYMaps(table).find((body) => body.get('id') === id);
}

/**
 * 신규 테이블의 독립 본체 Map과 순서를 초기화한다. 레거시 본체와 공유하지 않는다.
 * @param table 대상 테이블
 * @param columns 초기 필드 스냅샷
 * @returns 없음
 */
export function initializeColumnStorage(
  table: Y.Map<unknown>,
  columns: Array<Record<string, unknown>>,
): void {
  const bodies = new Y.Map<Y.Map<unknown>>();
  const order = new Y.Array<string>();
  const seen = new Set<string>();
  for (const column of columns) {
    const id = column.id;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    bodies.set(
      id,
      new Y.Map(
        Object.keys(column)
          .sort()
          .map((key) => [key, column[key]] as [string, unknown]),
      ),
    );
    order.push([id]);
  }
  table.set('columnsById', bodies);
  table.set('columnOrder', order);
}

/**
 * 레거시 스냅샷과 공유 타입 ID로 결정적 마이그레이션 client ID를 만든다.
 * 일반 Yjs random uint32 ID와 겹치지 않는 상위 53-bit 공간을 사용한다.
 * @param value 정규화된 마이그레이션 입력
 * @returns 안전한 정수 client ID
 */
function migrationClientId(value: string): number {
  let hash = 14695981039346656037n;
  for (let index = 0; index < value.length; index += 1) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(index))) * 1099511628211n);
  }
  return Number((hash & ((1n << 52n) - 1n)) | (1n << 52n));
}

/**
 * 컬럼을 처음 쓸 때 레거시를 결정적으로 이관한다. 사용자 transaction 전에 호출한다.
 * 동일 레거시에서 시작한 피어들이 동일 struct를 생성하므로 동시 이관도 Map 교체가 없다.
 * 열린 transaction에서 최초 이관은 ERR_COLUMN_MIGRATION_IN_TRANSACTION으로 거부한다.
 * 구버전 쓰기 차단은 S5 프로토콜 게이트의 책임이다.
 * @param table attach된 대상 테이블
 * @returns 컬럼 저장소
 */
export function ensureColumnStorage(table: Y.Map<unknown>): ColumnStorage {
  if (!(table.get('columnsById') instanceof Y.Map)) {
    const doc = table.doc;
    if (doc?._transaction) {
      throw Object.assign(new Error('Column migration must run before opening a transaction'), {
        code: 'ERR_COLUMN_MIGRATION_IN_TRANSACTION',
      });
    }
    const tables = doc?.getMap<Y.Map<unknown>>('tables');
    const tableItem = table._item;
    const tableId = tableItem?.parentSub;
    if (
      !doc ||
      !tables ||
      !tableItem ||
      tableItem.parent !== tables ||
      typeof tableId !== 'string' ||
      tables.get(tableId) !== table
    )
      throw new Error('Column migration requires an attached table');
    // Reusing clock zero after a previous schema was removed cannot restore its structs.
    if (table._map.has('columnsById') || table._map.has('columnOrder')) {
      throw Object.assign(new Error('Column storage requires explicit schema recovery'), {
        code: 'ERR_COLUMN_STORAGE_INCONSISTENT',
      });
    }
    const legacy = table.get('columns');
    const columns = readColumnYMaps(table).map((body) =>
      Object.fromEntries([...body.keys()].sort().map((key) => [key, body.get(key)])),
    );
    const identity =
      legacy instanceof Y.Array
        ? Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(legacy, 0))
        : tableId;
    const clientId = migrationClientId(JSON.stringify(['erd-columns-v1', identity, columns]));
    if (doc.store.clients.has(clientId)) {
      throw Object.assign(new Error('Column migration client requires explicit schema recovery'), {
        code: 'ERR_COLUMN_STORAGE_INCONSISTENT',
      });
    }
    // Only this table's columns enter the seed. Keep client ID, clock zero and write
    // order compatible with the original replica-based migration protocol.
    const seed = new Y.Doc();
    try {
      seed.clientID = clientId;
      const seedTable = seed.getMap<unknown>('column-seed');
      seed.transact(() => initializeColumnStorage(seedTable, columns));
      // Item.write supports an ID parent reference. Retarget only the two schema
      // roots to the existing live table; descendants retain their seed parents.
      // The disposable seed is only encoded/destroyed after this adjustment.
      for (const key of ['columnsById', 'columnOrder']) {
        seedTable._map.get(key)!.parent = tableItem.id;
      }
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed), CANVAS_HISTORY_ORIGIN.SYSTEM_FALLBACK);
    } finally {
      seed.destroy();
    }
  }
  return {
    columnsById: table.get('columnsById') as Y.Map<Y.Map<unknown>>,
    columnOrder: table.get('columnOrder') as Y.Array<string>,
  };
}

/**
 * 존재하는 컬럼의 달라진 필드만 쓴다. 삭제된 본체는 재생성하지 않는다.
 * @param table 테이블
 * @param id 컬럼 ID
 * @param patch 필드 patch (undefined는 삭제)
 * @returns 본체 존재 여부
 */
export function patchColumnYMap(
  table: Y.Map<unknown>,
  id: string,
  patch: Record<string, unknown>,
): boolean {
  const { columnsById } = ensureColumnStorage(table);
  const body = columnsById.get(id);
  if (!body) return false;
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'id') continue;
    if (value === undefined) {
      if (body.has(key)) body.delete(key);
    } else if (!Object.is(body.get(key), value)) {
      body.set(key, value);
    }
  }
  return true;
}

/**
 * 쓰기 전에 순서의 중복/고아를 지우고 누락된 ID를 추가한다. 본체에는 쓰지 않는다.
 * @param table 테이블
 * @param order ID 순서
 * @returns 없음
 */
function normalizeColumnOrder(table: Y.Map<unknown>, order: Y.Array<string>): void {
  const ids = readColumnYMaps(table).map((body) => body.get('id') as string);
  const valid = new Set(ids);
  const seen = new Set<string>();
  for (let index = 0; index < order.length; ) {
    const id = order.get(index);
    if (!valid.has(id) || seen.has(id)) {
      order.delete(index, 1);
    } else {
      seen.add(id);
      index += 1;
    }
  }
  const missing = ids.filter((id) => !seen.has(id));
  if (missing.length > 0) order.push(missing);
}

/**
 * 새 ID의 본체와 순서를 추가한다. 기존 본체를 교체하지 않는다.
 * @param table 테이블
 * @param id 새 컬럼 ID
 * @param body attach되지 않은 본체
 * @param index 표시 인덱스
 * @returns 추가 여부
 */
export function insertColumnYMap(
  table: Y.Map<unknown>,
  id: string,
  body: Y.Map<unknown>,
  index = readColumnYMaps(table).length,
): boolean {
  const { columnsById, columnOrder } = ensureColumnStorage(table);
  if (columnsById.has(id)) return false;
  normalizeColumnOrder(table, columnOrder);
  const visibleIds = readColumnYMaps(table).map((column) => column.get('id') as string);
  const beforeId = visibleIds[Math.max(0, index)];
  const rawIndex =
    beforeId === undefined ? columnOrder.length : columnOrder.toArray().indexOf(beforeId);
  columnsById.set(id, body);
  columnOrder.insert(rawIndex < 0 ? columnOrder.length : rawIndex, [id]);
  return true;
}

/**
 * 컬럼을 삭제한다. 동시 본체 편집은 Yjs 삭제에 의해 함께 사라진다.
 * @param table 테이블
 * @param id 컬럼 ID
 * @returns 삭제 여부
 */
export function deleteTableColumn(table: Y.Map<unknown>, id: string): boolean {
  const { columnsById, columnOrder } = ensureColumnStorage(table);
  if (!columnsById.has(id)) return false;
  columnsById.delete(id);
  for (let index = columnOrder.length - 1; index >= 0; index -= 1) {
    if (columnOrder.get(index) === id) columnOrder.delete(index, 1);
  }
  return true;
}

/**
 * 표시 인덱스로 ID만 이동한다. 컬럼 본체는 attach 상태를 유지한다.
 * @param table 테이블
 * @param fromIndex 이동 전 표시 인덱스
 * @param toIndex 이동 후 표시 인덱스
 * @returns 이동 가능 여부
 */
export function moveTableColumn(
  table: Y.Map<unknown>,
  fromIndex: number,
  toIndex: number,
): boolean {
  const { columnOrder } = ensureColumnStorage(table);
  const ids = readColumnYMaps(table).map((body) => body.get('id') as string);
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  )
    return false;
  if (fromIndex === toIndex) return true;
  normalizeColumnOrder(table, columnOrder);
  const id = ids[fromIndex]!;
  for (let index = columnOrder.length - 1; index >= 0; index -= 1) {
    if (columnOrder.get(index) === id) columnOrder.delete(index, 1);
  }
  ids.splice(fromIndex, 1);
  const beforeId = ids[toIndex];
  const rawIndex =
    beforeId === undefined ? columnOrder.length : columnOrder.toArray().indexOf(beforeId);
  columnOrder.insert(rawIndex < 0 ? columnOrder.length : rawIndex, [id]);
  return true;
}
