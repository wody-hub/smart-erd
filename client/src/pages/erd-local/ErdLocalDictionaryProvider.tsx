import { useMemo, type ReactNode } from 'react';
import { ErdDictionaryContext } from '@/components/erd/ErdDictionaryContext';
import { buildErdDictionaryView } from '@/components/erd/erdDictionaryData';
import { useErdLocalDictionary } from './useErdLocalDictionary';

/** 로컬 사전 스코프 식별자 (context teamId/setId 자리표시자). */
export const ERD_LOCAL_DICTIONARY_SCOPE_ID = 'local';

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

  return <ErdDictionaryContext.Provider value={value}>{children}</ErdDictionaryContext.Provider>;
}
