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
    <header className="h-12 bg-header text-header-foreground flex items-center gap-4 px-4 shrink-0">
      <div className="min-w-0 flex flex-1 items-center gap-4">
        <div className="min-w-0 flex items-center gap-4">
          <h1 className="text-lg font-bold cursor-pointer whitespace-nowrap" onClick={onAppClick}>
            {appName}
          </h1>
          {breadcrumb}
        </div>

        {title && (
          <div className="min-w-0 flex-1 md:hidden">
            <span className="block truncate text-xs font-medium text-header-foreground/90">
              {title}
            </span>
          </div>
        )}
      </div>

      {title && (
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">{rightSlot}</div>
    </header>
  );
}
