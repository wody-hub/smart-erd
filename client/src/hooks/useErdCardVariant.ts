import useThemeStore from '@/stores/useThemeStore';
import { resolveErdCardVariant, type ErdCardVariant } from '@/lib/theme';

/**
 * 현재 테마에 대응하는 ERD 카드 변형을 반환한다.
 *
 * @returns 'classic' 또는 'ie'
 */
export function useErdCardVariant(): ErdCardVariant {
  return useThemeStore((state) => resolveErdCardVariant(state.theme));
}
