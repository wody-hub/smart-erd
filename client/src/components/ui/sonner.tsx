import { Toaster as Sonner } from 'sonner';

/**
 * Sonner 토스트 알림 래퍼 컴포넌트.
 *
 * 우측 상단에 토스트를 표시하며, 프로젝트 CSS 변수 기반 테마를 적용한다.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      duration={5000}
      toastOptions={{
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }}
    />
  );
}
