import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ErdDictionaryContext } from '@/components/erd/ErdDictionaryContext';
import { buildErdDictionaryView } from '@/components/erd/erdDictionaryData';
import { useErdLocalDictionary, type ErdLocalDictionaryStore } from './useErdLocalDictionary';

/** 로컬 사전 스코프 식별자 (context teamId/setId 자리표시자). */
export const ERD_LOCAL_DICTIONARY_SCOPE_ID = 'local';

/**
 * Provider가 생성한 단일 사전 스토어를 공유하는 내부 컨텍스트.
 *
 * 다이얼로그와 캔버스가 별개 `useState` 인스턴스를 만들지 않도록
 * 스토어 객체 전체를 값으로 제공한다.
 */
const ErdLocalStoreContext = createContext<ErdLocalDictionaryStore | null>(null);

/**
 * Provider 내부의 단일 사전 스토어를 반환한다.
 *
 * `ErdLocalDictionaryProvider` 서브트리 안에서만 호출해야 하며,
 * 외부에서 호출하면 에러를 던진다.
 *
 * @returns 단일 사전 스토어 객체
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useErdLocalDictionaryStore(): ErdLocalDictionaryStore {
  const store = useContext(ErdLocalStoreContext);
  if (store === null) {
    throw new Error('useErdLocalDictionaryStore must be used within ErdLocalDictionaryProvider');
  }
  return store;
}

/** ErdLocalDictionaryProvider props. */
interface ErdLocalDictionaryProviderProps {
  /** 자식 요소 */
  children: ReactNode;
}

/**
 * ERD 로컬 모드용 사전 Provider.
 *
 * 서버 조회 대신 로컬 저장소를 읽어 기존 `useErdDictionary()` 계약과
 * 동일한 모양으로 공급한다. `localWriter`가 있어 Quick 다이얼로그는
 * 서버 대신 로컬 분기로 동작한다.
 *
 * @param props.children 자식 요소
 * @returns Provider JSX
 */
export function ErdLocalDictionaryProvider({ children }: ErdLocalDictionaryProviderProps) {
  const store = useErdLocalDictionary();
  const view = useMemo(
    () => buildErdDictionaryView(store.terms, store.domains, store.words),
    [store.terms, store.domains, store.words],
  );

  const value = useMemo(
    () => ({
      teamId: ERD_LOCAL_DICTIONARY_SCOPE_ID,
      setId: ERD_LOCAL_DICTIONARY_SCOPE_ID,
      terms: store.terms,
      domains: store.domains,
      words: store.words,
      isDictionaryReady: true,
      isDictionaryFetching: false,
      dictionaryRevision: store.revision,
      ...view,
      localWriter: store.writer,
    }),
    [store, view],
  );

  return (
    <ErdLocalStoreContext.Provider value={store}>
      <ErdDictionaryContext.Provider value={value}>{children}</ErdDictionaryContext.Provider>
    </ErdLocalStoreContext.Provider>
  );
}
