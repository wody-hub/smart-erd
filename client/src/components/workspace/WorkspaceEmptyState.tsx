import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 워크스페이스 빈 상태 컴포넌트 props. */
interface WorkspaceEmptyStateProps {
  /** 중앙 아이콘 */
  icon: React.ReactNode;
  /** 제목 */
  title: string;
  /** 설명 텍스트 */
  description?: string;
  /** 액션 버튼 슬롯 */
  action?: React.ReactNode;
  /** 색조 (기본/에러) */
  tone?: 'default' | 'error';
  /** ARIA role */
  role?: 'status' | 'alert';
}

/**
 * 워크스페이스 빈 상태 안내를 렌더링한다.
 *
 * @param props 빈 상태 props
 * @returns 빈 상태 카드 JSX
 */
export default function WorkspaceEmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
  role = 'status',
}: WorkspaceEmptyStateProps) {
  return (
    <Card className="surface-display overflow-hidden">
      <CardContent
        className="flex flex-col items-center justify-center py-14 text-center"
        role={role}
      >
        <div
          className={cn(
            'mb-5 rounded-full border p-4 shadow-operational',
            tone === 'error'
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-brand-secondary/15 bg-brand-secondary/10 text-brand-secondary',
          )}
        >
          {icon}
        </div>
        <h3 className="font-sans text-[1.7rem] font-semibold tracking-[-0.035em] text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
