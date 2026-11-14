/**
 * erd-local 초안(localStorage `smart-erd-erd-local-draft`)용 시드 생성기.
 *
 * - 테이블당 컬럼 8~12개 (PK 1 + FK 컬럼 + 일반 컬럼)
 * - 엣지는 테이블 수의 약 1.2배, 격자상 인접 테이블끼리만 연결(지역성)
 * - 결정적(seeded PRNG)이므로 같은 크기면 항상 같은 그래프가 나온다.
 */

/** 격자 한 칸의 가로 간격(px). 실측 테이블 폭(약 520px) + 여백 — 노드가 겹치지 않도록 */
const GRID_STEP_X = 640;
/** 격자 한 칸의 세로 간격(px). 컬럼 12개 테이블 높이(약 350~400px) + 여백 */
const GRID_STEP_Y = 560;
/** 테이블 대비 엣지 비율 */
const EDGE_RATIO = 1.2;

/**
 * mulberry32 PRNG.
 *
 * @param seed 정수 시드
 * @returns 0 이상 1 미만 난수를 돌려주는 함수
 */
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 일반 컬럼 후보 (이름, 타입) */
const PLAIN_COLUMNS = [
  ['name', 'VARCHAR(100)'],
  ['code', 'VARCHAR(30)'],
  ['status', 'VARCHAR(20)'],
  ['amount', 'DECIMAL(15,2)'],
  ['quantity', 'INTEGER'],
  ['description', 'TEXT'],
  ['use_yn', 'CHAR(1)'],
  ['sort_order', 'INTEGER'],
  ['remark', 'VARCHAR(500)'],
  ['created_at', 'TIMESTAMP'],
  ['updated_at', 'TIMESTAMP'],
  ['created_by', 'VARCHAR(50)'],
];

/**
 * 시나리오 이름("S200")에서 테이블 수를 읽는다.
 *
 * @param name 시나리오 이름
 * @returns 테이블 수
 */
export function parseScenarioSize(name) {
  const match = /^S(\d+)$/.exec(name);
  if (!match) throw new Error(`Invalid scenario name: ${name} (expected S<number>)`);
  return Number(match[1]);
}

/**
 * erd-local 초안 JSON을 생성한다.
 *
 * @param tableCount 테이블 수
 * @param seed       PRNG 시드
 * @returns `{ json, nodes, edges, meta }` — json은 localStorage에 넣을 문자열
 */
export function buildErdLocalSeed(tableCount, seed = 20260614) {
  const rng = createRng(seed ^ tableCount);
  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(tableCount)));
  const targetEdgeCount = Math.round(tableCount * EDGE_RATIO);

  /** 인덱스 i 테이블의 격자 좌표 */
  const cellOf = (i) => ({ row: Math.floor(i / gridColumns), col: i % gridColumns });
  /** 격자 좌표 → 인덱스 (범위 밖이면 -1) */
  const indexOf = (row, col) =>
    row < 0 || col < 0 || col >= gridColumns || row * gridColumns + col >= tableCount
      ? -1
      : row * gridColumns + col;

  /** 각 테이블이 FK로 참조할 부모 후보(인덱스가 더 작은 인접 셀)를 모은다. */
  const parentCandidates = (child) => {
    const { row, col } = cellOf(child);
    const offsets = [
      [0, -1],
      [-1, 0],
      [-1, -1],
      [-1, 1],
      [0, -2],
      [-2, 0],
    ];
    return offsets
      .map(([dr, dc]) => indexOf(row + dr, col + dc))
      .filter((index) => index >= 0 && index < child);
  };

  /** [child, parent] 쌍 목록 */
  const pairs = [];
  const pairKeys = new Set();
  const addPair = (child, parent) => {
    const key = `${child}:${parent}`;
    if (pairKeys.has(key)) return false;
    pairKeys.add(key);
    pairs.push([child, parent]);
    return true;
  };
  // 1) 모든 테이블(0번 제외)에 부모 1개
  for (let child = 1; child < tableCount; child += 1) {
    const candidates = parentCandidates(child);
    if (candidates.length === 0) continue;
    addPair(child, candidates[Math.floor(rng() * candidates.length)]);
  }
  // 2) 목표 개수까지 두 번째 부모 추가 (시도 횟수 제한)
  let attempts = 0;
  while (pairs.length < targetEdgeCount && attempts < tableCount * 20) {
    attempts += 1;
    const child = 1 + Math.floor(rng() * Math.max(1, tableCount - 1));
    const candidates = parentCandidates(child);
    if (candidates.length === 0) continue;
    addPair(child, candidates[Math.floor(rng() * candidates.length)]);
  }

  /** child 인덱스 → 부모 인덱스 목록 */
  const parentsByChild = new Map();
  for (const [child, parent] of pairs) {
    const list = parentsByChild.get(child) ?? [];
    list.push(parent);
    parentsByChild.set(child, list);
  }

  const nodes = [];
  const edges = [];
  const headerColors = ['default', 'supporting', 'attention'];
  for (let i = 0; i < tableCount; i += 1) {
    const nodeId = `t${i}`;
    const { row, col } = cellOf(i);
    const parents = parentsByChild.get(i) ?? [];
    const totalColumns = Math.max(8 + Math.floor(rng() * 5), 1 + parents.length + 4); // 8~12
    const columns = [{ id: `${nodeId}c0`, name: 'id', type: 'BIGINT', pk: true, nullable: false }];
    parents.forEach((parent, index) => {
      columns.push({
        id: `${nodeId}c${index + 1}`,
        name: `t${parent}_id`,
        type: 'BIGINT',
        fk: true,
        nullable: false,
      });
    });
    let plainIndex = 0;
    while (columns.length < totalColumns) {
      const [name, type] = PLAIN_COLUMNS[plainIndex % PLAIN_COLUMNS.length];
      columns.push({
        id: `${nodeId}c${columns.length}`,
        name: plainIndex < PLAIN_COLUMNS.length ? name : `${name}_${plainIndex}`,
        type,
        nullable: true,
      });
      plainIndex += 1;
    }
    nodes.push({
      id: nodeId,
      type: 'table',
      position: { x: col * GRID_STEP_X, y: row * GRID_STEP_Y },
      data: {
        label: `tbl_${i}`,
        logicalTableName: `테이블${i}`,
        headerColor: headerColors[i % headerColors.length],
        columns,
      },
    });
    parents.forEach((parent, index) => {
      const sourceHandle = `t${parent}-t${parent}c0-source-right`;
      const targetHandle = `${nodeId}-${nodeId}c${index + 1}-target-left`;
      edges.push({
        id: `e-${sourceHandle}-${targetHandle}`,
        source: `t${parent}`,
        target: nodeId,
        sourceHandle,
        targetHandle,
        type: 'erdRelation',
        data: { relationType: index === 0 ? 'identifying' : 'non-identifying' },
      });
    });
  }

  const columnCounts = nodes.map((node) => node.data.columns.length);
  const json = JSON.stringify({ nodes, edges, groups: [] });
  return {
    json,
    nodes,
    edges,
    meta: {
      tables: nodes.length,
      edges: edges.length,
      edgeRatio: Number((edges.length / Math.max(1, nodes.length)).toFixed(3)),
      columnsMin: Math.min(...columnCounts),
      columnsMax: Math.max(...columnCounts),
      columnsTotal: columnCounts.reduce((sum, count) => sum + count, 0),
      jsonBytes: Buffer.byteLength(json),
      seed,
    },
  };
}
