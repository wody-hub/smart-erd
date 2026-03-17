import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Spinner 컴포넌트의 props. */
interface SpinnerProps {
  /** 추가 CSS 클래스 */
  className?: string;
  /** 스피너 옆에 표시할 텍스트 */
  text?: string;
}

/**
 * 로딩 스피너 컴포넌트.
 *
 * animate-spin 애니메이션이 적용된 Loader2 아이콘과 선택적 텍스트를 표시한다.
 *
 * @param props.className 추가 CSS 클래스
 * @param props.text      스피너 옆에 표시할 텍스트
 */
export default function Spinner({ className, text }: SpinnerProps) {
  return (
    <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
      <Loader2 className="h-5 w-5 animate-spin" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
