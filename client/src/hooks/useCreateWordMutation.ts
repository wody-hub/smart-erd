import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createWord } from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { Word, WordFormData } from '@/types/dictionary';

/** translation.json에서 추출한 번역 키 (flat dot-notation) */
type FlatKeys = import('i18next').ParseKeys<'translation'>;

/** useCreateWordMutation 옵션 */
interface UseCreateWordMutationOptions {
  /** 팀 ID */
  teamId: string;
  /** 사전 세트 ID */
  setId: string;
  /** 생성 성공 시 호출할 콜백 */
  onSuccess?: () => void;
  /** 성공 토스트 i18n 키 */
  successMessageKey?: FlatKeys;
  /** 실패 토스트 i18n 키 */
  errorMessageKey?: FlatKeys;
}

/**
 * 단어 생성 뮤테이션을 제공하는 공통 훅.
 *
 * 낙관적 캐시 업데이트 + invalidation + 토스트 알림을 캡슐화한다.
 * TermFormDialog와 QuickTermDialog에서 공통으로 사용한다.
 *
 * @param options 팀/세트 식별자 및 콜백
 * @returns useMutation 결과
 */
export function useCreateWordMutation({
  teamId,
  setId,
  onSuccess,
  successMessageKey = 'dictionary.word.toast.created',
  errorMessageKey = 'dictionary.word.toast.createFailed',
}: UseCreateWordMutationOptions) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: WordFormData) => createWord(teamId, setId, data),
    onSuccess: async (word) => {
      queryClient.setQueryData<Word[]>(
        queryKeys.dictionary.words(teamId, setId),
        (current = []) => {
          if (current.some((item) => item.id === word.id)) {
            return current;
          }
          return [...current, word];
        },
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.words(teamId, setId) });
      toast.success(t(successMessageKey));
      onSuccess?.();
    },
    onError: (err) => toast.error(getErrorMessage(err, t(errorMessageKey))),
  });
}
