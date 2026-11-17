import type { editor, IPosition } from 'monaco-editor';
import type { DslProjection, TableBlock, TextPatchBatch } from '@/lib/dsl-block-projection';

/** Monaco와 메모리 모델이 공유하는 최소 읽기 전용 투영 적용 인터페이스. */
export interface ProjectionModel {
  /** 최초 수화에만 사용하는 초기값 설정. */
  setValue: (text: string) => void;
  /** 줄바꿈 시퀀스를 강제한다(0: LF, 1: CRLF). 패치 오프셋은 LF 기준 텍스트에서 계산된다. */
  setEOL: (sequence: editor.EndOfLineSequence) => void;
  /** UTF-16 오프셋을 행·열로 변환한다. */
  getPositionAt: (offset: number) => IPosition;
  /** 행·열을 UTF-16 오프셋으로 변환한다. */
  getOffsetAt: (position: IPosition) => number;
  /** 이전 모델 좌표의 비중첩 편집 묶음을 적용한다. */
  applyEdits: (edits: editor.IIdentifiedSingleEditOperation[]) => unknown;
}

/** Monaco `EndOfLineSequence.LF` 값. */
const LF_EOL = 0 as editor.EndOfLineSequence;

/** 방향을 유지한 선택 양 끝과 viewport 상단의 UTF-16 위치. */
export interface ProjectionViewOffsets {
  /** 선택 시작점 (역방향 선택도 유지). */
  anchor: number;
  /** 활성 커서 끝점. */
  active: number;
  /** viewport 맨 위에 보이는 행의 시작점. */
  top: number;
  /** 해당 행 위에서 잘린 픽셀 높이. */
  pixelOffset: number;
}

/** 엔티티 ID와 해당 범위 안의 문자 오프셋. */
interface EntityAnchor {
  /** 소속 테이블 ID. */
  tableId?: string;
  /** 컬럼 행이면 컬럼 ID. */
  columnId?: string;
  /** 다음 테이블 직전 구분 LF에 고정한 위치. */
  separator?: boolean;
  /** 선택한 엔티티 범위 내 UTF-16 오프셋. */
  offset: number;
  /** 삭제 시 인접 생존 블록을 찾기 위한 기존 블록 인덱스. */
  index: number;
}

/**
 * 최초 마운트에서만 전용 모델을 초기화한다.
 * @param model 전용 Monaco 모델
 * @param text 현재 수화 텍스트
 * @returns 없음
 */
export function initializeLiveProjectionModel(model: ProjectionModel, text: string): void {
  model.setValue(text);
  // Windows UA 등에서 Monaco 기본 EOL이 CRLF가 되면 모델 오프셋이 LF 기준 패치 오프셋과 어긋난다.
  model.setEOL(LF_EOL);
}

/**
 * 절대 위치를 엔티티 ID와 범위 안 오프셋으로 고정한다.
 * @param blocks 이전 블록 목록
 * @param offset 이전 UTF-16 위치
 * @returns 엔티티 기준 위치
 */
function captureAnchor(blocks: TableBlock[], offset: number): EntityAnchor {
  let index = blocks.findIndex((block) => offset < block.tableRange.end);
  if (index < 0) index = blocks.length - 1;
  const block = blocks[index];
  if (!block) return { offset: 0, index: 0 };
  if (offset < block.tableRange.start) {
    return {
      tableId: block.tableId,
      separator: true,
      offset: offset - block.tableRange.start,
      index,
    };
  }
  const column = block.columnRanges.find((range) => offset >= range.start && offset <= range.end);
  return {
    tableId: block.tableId,
    columnId: column?.columnId,
    offset: Math.max(0, offset - (column ?? block.tableRange).start),
    index,
  };
}

/**
 * 같은 엔티티를 복구하며 삭제된 대상은 가장 가까운 기존 생존 블록으로 이동한다.
 * @param anchor 이전 엔티티 위치
 * @param previous 이전 블록 순서
 * @param next 다음 블록 목록
 * @returns 새 절대 위치와 삭제 이동 여부
 */
function restoreAnchor(
  anchor: EntityAnchor,
  previous: TableBlock[],
  next: TableBlock[],
): { offset: number; relocated: number } {
  const table = next.find((block) => block.tableId === anchor.tableId);
  const column = anchor.columnId
    ? table?.columnRanges.find((range) => range.columnId === anchor.columnId)
    : undefined;
  if (table && (!anchor.columnId || column)) {
    if (anchor.separator) {
      return { offset: Math.max(0, table.tableRange.start + anchor.offset), relocated: 0 };
    }
    const range = column ?? table.tableRange;
    return { offset: Math.min(range.end, range.start + anchor.offset), relocated: 0 };
  }
  if (!anchor.tableId) return { offset: next[0]?.tableRange.start ?? 0, relocated: 0 };
  const survivors = new Map(next.map((block) => [block.tableId, block]));
  let nearest = table;
  let distance = Infinity;
  previous.forEach((block, index) => {
    const candidate = survivors.get(block.tableId);
    const delta = Math.abs(index - anchor.index);
    if (candidate && delta < distance) {
      nearest = candidate;
      distance = delta;
    }
  });
  return {
    offset: (nearest ?? next[Math.min(anchor.index, next.length - 1)])?.tableRange.start ?? 0,
    relocated: 1,
  };
}

/** 블록·컬럼의 ID와 절대 범위가 달라졌는지 검사한다. */
export function liveProjectionRangesChanged(previous: TableBlock[], next: TableBlock[]): boolean {
  return (
    previous !== next &&
    (previous.length !== next.length ||
      previous.some((block, index) => {
        const after = next[index];
        return (
          block.tableId !== after.tableId ||
          JSON.stringify([block.tableRange, block.columnRanges]) !==
            JSON.stringify([after.tableRange, after.columnRanges])
        );
      }))
  );
}

/**
 * 단위 B 패치를 한 applyEdits로 적용하고 선택·스크롤의 의미상 위치를 복원한다.
 * 초기화 이후 setValue·전체 모델 범위 치환을 합성하지 않는다.
 * @param model 전용 읽기 모델
 * @param previous 모델에 이미 반영된 투영
 * @param batch 다음 버전의 패치와 엔티티 범위
 * @param view 변경 전 선택과 viewport
 * @returns 변경 후 선택·viewport 및 삭제 대상별 이동 횟수
 */
export function applyLiveProjectionBatch(
  model: ProjectionModel,
  previous: DslProjection,
  batch: TextPatchBatch & { blockMetadata: TableBlock[] },
  view: ProjectionViewOffsets,
): ProjectionViewOffsets & { relocatedTargets: number } {
  if (previous.revision !== batch.baseRevision || batch.nextRevision <= batch.baseRevision) {
    throw new Error('Projection revision mismatch');
  }
  if (!batch.patches.length && !liveProjectionRangesChanged(previous.blocks, batch.blockMetadata))
    return { ...view, relocatedTargets: 0 };
  let boundary = previous.text.length;
  for (const patch of [...batch.patches].reverse()) {
    if (
      !Number.isInteger(patch.start) ||
      !Number.isInteger(patch.end) ||
      patch.start < 0 ||
      patch.end < patch.start ||
      patch.end > boundary
    )
      throw new Error('Invalid projection patch range');
    boundary = patch.start;
  }
  // 투영 텍스트의 오프셋은 LF 기준이므로 적용 직전에도 모델 EOL을 보장한다(이미 LF면 변경 없음).
  model.setEOL(LF_EOL);
  const anchors = [view.anchor, view.active, view.top].map((offset) =>
    captureAnchor(previous.blocks, offset),
  );
  const edits = batch.patches.map((patch) => {
    const start = model.getPositionAt(patch.start);
    const end = model.getPositionAt(patch.end);
    return {
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      },
      text: patch.text,
      forceMoveMarkers: true,
    };
  });
  if (edits.length) model.applyEdits(edits);
  const [anchor, active, top] = anchors.map((value) =>
    restoreAnchor(value, previous.blocks, batch.blockMetadata),
  );
  return {
    anchor: anchor.offset,
    active: active.offset,
    top: top.offset,
    pixelOffset: view.pixelOffset,
    relocatedTargets: anchor.relocated + active.relocated + top.relocated,
  };
}

/**
 * 임의 ID를 Monaco가 정규화해도 손실 없는 CSS 식별 토큰으로 바꾼다.
 * 색상·스타일 규칙 없이 엔티티 식별에만 사용한다.
 * @param id 원본 엔티티 ID
 * @returns 코드 포인트를 구분한 식별 토큰
 */
function projectionEntityToken(id: string): string {
  return Array.from(id, (character) => character.codePointAt(0)!.toString(16)).join('-');
}

/**
 * 블록·컬럼마다 안정된 엔티티 설명을 가진 Monaco decoration을 만든다.
 * @param blocks 현재 전체 범위
 * @returns 스타일 변경 없이 ID만 부착하는 decoration 목록
 */
export function buildLiveProjectionDecorations(
  blocks: TableBlock[],
): editor.IModelDeltaDecoration[] {
  return blocks.flatMap((block) => [
    {
      range: {
        startLineNumber: block.tableRange.startLine,
        startColumn: block.tableRange.startColumn,
        endLineNumber: block.tableRange.endLine,
        endColumn: block.tableRange.endColumn,
      },
      options: {
        className: `erd-projection-table-${projectionEntityToken(block.tableId)}`,
        stickiness: 1,
      },
    },
    ...block.columnRanges.map((range) => ({
      range: {
        startLineNumber: range.startLine,
        startColumn: range.startColumn,
        endLineNumber: range.endLine,
        endColumn: range.endColumn,
      },
      options: {
        className: `erd-projection-column-${projectionEntityToken(block.tableId)}--${projectionEntityToken(range.columnId ?? '')}`,
        stickiness: 1,
      },
    })),
  ]);
}

/** decoration에 영향을 주는 ID와 행·열만 비교한다(문자 오프셋 이동은 Monaco가 추적). */
function decorationLayout(block: TableBlock): string {
  return JSON.stringify([
    block.tableId,
    ...[block.tableRange, ...block.columnRanges].map((range) => [
      'columnId' in range ? range.columnId : undefined,
      range.startLine,
      range.startColumn,
      range.endLine,
      range.endColumn,
    ]),
  ]);
}

/**
 * 블록별 collection을 유지해 변경되거나 행 좌표가 이동한 블록만 갱신한다.
 * @param createCollection Monaco collection 생성 함수
 * @returns 블록 갱신 및 전체 정리 함수
 */
export function createLiveProjectionDecorationUpdater(
  createCollection: (
    items: editor.IModelDeltaDecoration[],
  ) => Pick<editor.IEditorDecorationsCollection, 'set' | 'clear'>,
) {
  const entries = new Map<
    string,
    { block: TableBlock; layout: string; collection: ReturnType<typeof createCollection> }
  >();
  return {
    /** 변경 블록만 만들고 삭제된 블록의 decoration을 해제한다. */
    update(blocks: TableBlock[]) {
      const surviving = new Set<string>();
      for (const block of blocks) {
        surviving.add(block.tableId);
        const entry = entries.get(block.tableId);
        if (entry?.block === block) continue;
        const layout = decorationLayout(block);
        if (!entry) {
          entries.set(block.tableId, {
            block,
            layout,
            collection: createCollection(buildLiveProjectionDecorations([block])),
          });
        } else {
          // 행 추가·삭제로 뒤 블록이 이동한 경우에도 최종 좌표를 명시해 경계 stickiness에 의존하지 않는다.
          if (entry.block.text !== block.text || entry.layout !== layout)
            entry.collection.set(buildLiveProjectionDecorations([block]));
          entry.block = block;
          entry.layout = layout;
        }
      }
      for (const [id, entry] of entries) {
        if (!surviving.has(id)) {
          entry.collection.clear();
          entries.delete(id);
        }
      }
    },
    /** 패널 수명이 끝나면 모든 collection을 정리한다. */
    clear() {
      for (const entry of entries.values()) entry.collection.clear();
      entries.clear();
    },
  };
}
