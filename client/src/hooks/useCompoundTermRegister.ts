import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { createTerm, fetchTerms } from '@/api/termApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { buildColumnUpdatesFromTerm } from '@/hooks/useDictionaryCache';
import { useErdDictionary } from '@/components/erd/ErdDictionaryContext';
import useCanvasStore from '@/stores/useCanvasStore';
import type { CompoundResolution } from '@/types/dictionary';

/**
 * 복합 용어 자동 등록 훅.
 *
 * 복합 용어 선택 시 사전에 새 Term을 자동 등록하고 컬럼에 매핑한다.
 * 409(중복) 발생 시 기존 용어를 조회하여 매핑하는 폴백 로직을 포함한다.
 *
 * @param nodeId 대상 노드 ID
 * @returns registerCompound 함수
 */
export function useCompoundTermRegister(nodeId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { teamId, setId, findDomainById } = useErdDictionary();
  const updateColumn = useCanvasStore((s) => s.updateColumn);

  /** 복합 용어 자동 등록 mutation */
  const autoRegisterMutation = useMutation({
    mutationFn: (data: { logicalName: string; physicalName: string; domainId?: number | null }) =>
      createTerm(teamId, setId, {
        logicalName: data.logicalName,
        physicalName: data.physicalName,
        domainId: data.domainId ?? null,
      }),
  });

  /**
   * 복합 용어를 사전에 등록하고 컬럼에 매핑한다.
   *
   * @param colId      컬럼 ID
   * @param resolution 복합 해석 결과
   */
  const registerCompound = (colId: string, resolution: CompoundResolution) => {
    autoRegisterMutation.mutate(
      {
        logicalName: resolution.query,
        physicalName: resolution.physicalName,
        domainId: resolution.domainId,
      },
      {
        onSuccess: (term) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId, setId) });
          updateColumn(nodeId, colId, buildColumnUpdatesFromTerm(term, findDomainById));
          toast.success(t('erd.autocomplete.compoundRegistered'));
        },
        onError: async (err) => {
          if (isAxiosError(err) && err.response?.status === 409) {
            const freshTerms = await queryClient.fetchQuery({
              queryKey: queryKeys.dictionary.terms(teamId, setId),
              queryFn: () => fetchTerms(teamId, setId),
            });
            const existing = freshTerms.find((t) => t.logicalName === resolution.query);
            if (existing) {
              updateColumn(nodeId, colId, buildColumnUpdatesFromTerm(existing, findDomainById));
              toast.success(t('erd.autocomplete.compoundExisting'));
            } else {
              toast.info(t('erd.autocomplete.compoundRetry'));
            }
          } else {
            toast.error(getErrorMessage(err, t('erd.autocomplete.compoundFailed')));
          }
        },
      },
    );
  };

  return registerCompound;
}
