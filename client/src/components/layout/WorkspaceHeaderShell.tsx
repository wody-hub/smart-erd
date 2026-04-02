interface WorkspaceHeaderShellProps {
  /** 좌측 앱명 클릭 핸들러 */
  onAppClick: () => void;
  /** 앱명 */
  appName: string;
  /** 좌측 breadcrumb */
  breadcrumb?: React.ReactNode;
  /** 중앙 제목 */
  title?: string;
  /** 우측 액션/유틸 */
  rightSlot?: React.ReactNode;
}

/** 공통 workspace 헤더 뼈대. 좌측 맥락, 중앙 제목, 우측 유틸을 나눈다. */
export default function WorkspaceHeaderShell({
  onAppClick,
  appName,
  breadcrumb,
  title,
  rightSlot,
}: WorkspaceHeaderShellProps) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-header-muted/20 bg-header/95 px-4 py-2 text-header-foreground backdrop-blur max-md:flex-wrap max-md:items-start lg:px-5">
      <div className="min-w-0 flex flex-1 items-center gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <h1
            className="cursor-pointer whitespace-nowrap font-sans text-[1.02rem] font-semibold tracking-[-0.03em]"
            role="button"
            tabIndex={0}
            onClick={onAppClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAppClick();
              }
            }}
          >
            {appName}
          </h1>
          {breadcrumb}
        </div>

        {title && (
          <div className="min-w-0 flex-1 md:hidden">
            <span className="block truncate text-xs font-medium tracking-[-0.01em] text-header-foreground/90">
              {title}
            </span>
          </div>
        )}
      </div>

      {title && (
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <span className="truncate text-sm font-medium tracking-[-0.01em]">{title}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3 max-md:w-full max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:pb-1">
        {rightSlot}
      </div>
    </header>
  );
}
