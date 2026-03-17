import {
  buildColumnUpdatesFromTerm,
  useErdDictionaryData,
} from '@/components/erd/erdDictionaryData';

export { buildColumnUpdatesFromTerm };

/**
 * @deprecated ERD 경로에서는 `useErdDictionaryData` 또는 `useErdDictionary` 사용.
 *             기존 호출부 호환을 위해 유지하는 래퍼다.
 */
export function useDictionaryCache(teamId: string | undefined, setId: string | undefined) {
  return useErdDictionaryData(teamId, setId);
}
