import { useTranslation } from 'react-i18next';
import { getWorkspaceSectionLabel } from '@/lib/workspace-labels';
import type { WorkspaceContext } from '@/types/workspace';

interface WorkspaceBreadcrumbProps {
  /** 현재 화면의 workspace 컨텍스트 */
  context?: WorkspaceContext;
}

/** 팀/프로젝트/섹션 맥락을 상단 헤더에 노출하는 breadcrumb. */
export default function WorkspaceBreadcrumb({ context }: WorkspaceBreadcrumbProps) {
  const { t } = useTranslation();

  if (!context) {
    return null;
  }

  const items: string[] = [];

  if (context.team?.name) {
    items.push(context.team.name);
  }

  if (context.project?.name) {
    items.push(context.project.name);
  }

  items.push(t(getWorkspaceSectionLabel(context.section).key));

  const mobileItems = items.length > 2 ? items.slice(-2) : items;

  const renderItems = (values: string[]) =>
    values.map((item, index) => (
      <span key={`${item}-${index}`} className="min-w-0 truncate">
        {index > 0 && <span className="mr-2 text-header-muted/70">/</span>}
        {item}
      </span>
    ));

  return (
    <>
      <div className="hidden min-w-0 items-center gap-2 text-[13px] text-header-muted md:flex">
        {renderItems(items)}
      </div>
      <div className="min-w-0 flex items-center gap-2 text-[13px] text-header-muted md:hidden">
        {renderItems(mobileItems)}
      </div>
    </>
  );
}
