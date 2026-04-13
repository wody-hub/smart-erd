import * as Y from 'yjs';
import type { ScopeRef } from '@/collaboration/core/contracts/document-read-executor';
import type { SharedDocumentEngineUpdate } from '@/collaboration/core/contracts/shared-document-engine';
import type { YjsSharedDocumentEngine } from '@/collaboration/core/engines/yjs-shared-document-engine';

const ROOT_KEY = 'screenSpec';
const SCREENS_KEY = 'screens';
const INSTANCES_KEY = 'instances';
const LAYERS_KEY = 'layers';
const MASTERS_KEY = 'masters';

type AnyYType = Y.AbstractType<any>;

/**
 * shared document update에서 화면기획 affected scope 목록을 추출한다.
 *
 * @param engine 대상 Yjs shared document engine
 * @param update 적용된 shared document update
 * @returns update에서 추출한 affected scope 목록
 */
export function collectScreenSpecAffectedScopes(
  engine: YjsSharedDocumentEngine,
  update: SharedDocumentEngineUpdate,
): ScopeRef[] {
  const transaction = update.changeSet;
  if (!(transaction instanceof Y.Transaction)) {
    return [];
  }
  return collectScreenSpecAffectedScopesFromTransaction(engine.getDocument(), transaction);
}

/**
 * Yjs transaction에서 화면기획 affected scope 목록을 계산한다.
 *
 * @param doc 대상 Y.Doc
 * @param transaction 분석할 Yjs transaction
 * @returns transaction에서 추출한 affected scope 목록
 */
export function collectScreenSpecAffectedScopesFromTransaction(
  doc: Y.Doc,
  transaction: Y.Transaction,
): ScopeRef[] {
  const root = doc.getMap(ROOT_KEY);
  const screens = root.get(SCREENS_KEY);
  const instances = root.get(INSTANCES_KEY);
  const layers = root.get(LAYERS_KEY);
  const masters = root.get(MASTERS_KEY);

  if (
    !(screens instanceof Y.Map) ||
    !(instances instanceof Y.Map) ||
    !(layers instanceof Y.Map) ||
    !(masters instanceof Y.Map)
  ) {
    return [];
  }

  const affectedScopes = new Map<string, ScopeRef>();

  for (const [type, subs] of transaction.changed) {
    const changedType = type as AnyYType;

    if (isSameType(changedType, screens)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'screen', key);
      }
      continue;
    }
    if (isSameType(changedType, instances)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'instance', key);
      }
      continue;
    }
    if (isSameType(changedType, layers)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'layer', key);
      }
      continue;
    }
    if (isSameType(changedType, masters)) {
      for (const key of readChangedSubKeys(subs)) {
        addAffectedScope(affectedScopes, 'master', key);
      }
      continue;
    }

    const parent = changedType.parent;
    if (isSameType(parent, screens)) {
      addAffectedScope(affectedScopes, 'screen', readParentSub(changedType));
      continue;
    }
    if (isSameType(parent, instances)) {
      addAffectedScope(affectedScopes, 'instance', readParentSub(changedType));
      continue;
    }
    if (isSameType(parent, layers)) {
      addAffectedScope(affectedScopes, 'layer', readParentSub(changedType));
      continue;
    }
    if (isSameType(parent, masters)) {
      addAffectedScope(affectedScopes, 'master', readParentSub(changedType));
      continue;
    }

    if (parent instanceof Y.Map && isSameType(parent.parent, screens)) {
      addAffectedScope(affectedScopes, 'screen', readParentSub(parent));
      continue;
    }
    if (parent instanceof Y.Map && isSameType(parent.parent, instances)) {
      addAffectedScope(affectedScopes, 'instance', readParentSub(parent));
      continue;
    }
    if (parent instanceof Y.Map && isSameType(parent.parent, masters)) {
      addAffectedScope(affectedScopes, 'master', readParentSub(parent));
      continue;
    }
    if (
      parent instanceof Y.Array &&
      parent.parent instanceof Y.Map &&
      isSameType(parent.parent.parent, layers)
    ) {
      addAffectedScope(affectedScopes, 'layer', readParentSub(parent.parent));
    }
  }

  return [...affectedScopes.values()];
}

/**
 * changed sub key 집합에서 유효한 string key만 추출한다.
 *
 * @param subs Yjs changed sub key 집합
 * @returns 유효한 string key 목록
 */
function readChangedSubKeys(subs: Set<unknown>): string[] {
  const result: string[] = [];
  for (const sub of subs.keys()) {
    if (typeof sub === 'string' && sub.length > 0) {
      result.push(sub);
    }
  }
  return result;
}

/**
 * Yjs type의 parentSub 문자열을 읽는다.
 *
 * @param type parentSub를 읽을 Yjs type
 * @returns 유효한 parentSub 문자열 또는 null
 */
function readParentSub(type: AnyYType): string | null {
  return typeof type._item?.parentSub === 'string' && type._item.parentSub.length > 0
    ? type._item.parentSub
    : null;
}

/**
 * 두 Yjs type 참조가 같은 객체인지 비교한다.
 *
 * @param left 좌측 type
 * @param right 우측 type
 * @returns 동일 객체면 true
 */
function isSameType(left: unknown, right: unknown): boolean {
  return left === right;
}

/**
 * affected scope 맵에 고유 scope를 추가한다.
 *
 * @param affectedScopes 누적 affected scope 맵
 * @param kind 추가할 scope kind
 * @param id 추가할 scope id
 * @returns 없음
 */
function addAffectedScope(
  affectedScopes: Map<string, ScopeRef>,
  kind: ScopeRef['kind'],
  id: string | null,
): void {
  if (!id) {
    return;
  }
  affectedScopes.set(`${kind}:${id}`, {
    kind,
    id,
    mode: 'shared',
  });
}
