import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function useDiagramRejectedCommandToast(): () => void {
  const { t } = useTranslation();

  return useCallback(() => {
    toast.warning(
      t('diagram.toast.commandRejected', {
        defaultValue: '변경을 적용하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.',
      }),
    );
  }, [t]);
}
