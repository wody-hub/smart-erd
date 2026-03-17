import { createContext, useContext } from 'react';
import { useErdDictionaryData } from './erdDictionaryData';

/** ERD 에디터 공유 데이터 컨텍스트 값 */
type ErdDictionaryContextValue = ReturnType<typeof useErdDictionaryData> & {
  /** 팀 ID (non-null 보장) */
  teamId: string;
  /** 사전 세트 ID (non-null 보장) */
  setId: string;
};

const ErdDictionaryContext = createContext<ErdDictionaryContextValue | null>(null);

/** ErdDictionaryProvider 컴포넌트 props */
interface ErdDictionaryProviderProps {
  /** 팀 ID (non-null) */
  teamId: string;
  /** 사전 세트 ID (non-null) */
  setId: string;
  /** 자식 요소 */
  children: React.ReactNode;
}

/**
 * ERD 에디터용 사전 데이터 Provider.
 *
 * DiagramPage 레벨에서 단 한 번만 ERD 전용 조회 쿼리를 실행하여
 * terms/domains를 캐싱하고, 하위 ERD 컴포넌트들이 Context를 통해 공유한다.
 * 이렇게 하면 TableNode × N개가 각각 useQuery observer를 생성하는 것을 방지한다.
 *
 * @param props.teamId   팀 ID
 * @param props.children 자식 요소
 */
export function ErdDictionaryProvider({ teamId, setId, children }: ErdDictionaryProviderProps) {
  const cache = useErdDictionaryData(teamId, setId);

  return (
    <ErdDictionaryContext.Provider value={{ teamId, setId, ...cache }}>
      {children}
    </ErdDictionaryContext.Provider>
  );
}

/**
 * ERD 사전 데이터 컨텍스트를 소비하는 훅.
 *
 * ErdDictionaryProvider 내부에서만 사용 가능하다.
 * teamId는 non-null이 보장되므로 teamId! 단언이 불필요하다.
 *
 * @returns teamId + ERD 전용 사전 조회 계약
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useErdDictionary(): ErdDictionaryContextValue {
  const ctx = useContext(ErdDictionaryContext);
  if (!ctx) {
    throw new Error('useErdDictionary must be used within ErdDictionaryProvider');
  }
  return ctx;
}
