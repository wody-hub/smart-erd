import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  ClipboardList,
  Compass,
  FileText,
  FolderOpen,
  GitFork,
  Layers3,
  ListTree,
  Map,
  Sparkles,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES, type GuideEntrySource } from '@/constants/routes';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import useAuthStore from '@/stores/useAuthStore';

type GuideActionVariant = 'default' | 'outline' | 'ghost';
type GuideActionStyle = 'buttons' | 'inline' | 'inline-reveal';
type ProjectHubTab = 'documents' | 'overview' | 'wbs' | 'gantt' | 'myTasks' | 'staffing' | 'issues';

interface GuideActionItem {
  label: string;
  to?: string;
  state?: unknown;
  sectionId?: string;
  variant?: GuideActionVariant;
}

interface GuideCardItem {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: GuideActionItem[];
}

interface GuideStepItem {
  step: string;
  title: string;
  description: string;
  actions?: GuideActionItem[];
}

interface GuideSectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: GuideActionItem[];
}

interface GuideCardProps extends GuideCardItem {
  cardClassName?: string;
  iconClassName?: string;
  actionStyle?: GuideActionStyle;
}

interface GuideContextMeta {
  message: string;
  action: GuideActionItem;
}

const GUIDE_HEADER_SELECTOR = '[data-guide-header]';
const GUIDE_PAGE_ROOT_SELECTOR = '[data-guide-page-root]';
const GUIDE_SCROLL_SPACER_SELECTOR = '[data-guide-scroll-spacer]';
const GUIDE_SECTION_TOP_GAP_PX = 16;

function getGuideLandingOffset(): number {
  const header = document.querySelector<HTMLElement>(GUIDE_HEADER_SELECTOR);
  return Math.ceil((header?.getBoundingClientRect().height ?? 0) + GUIDE_SECTION_TOP_GAP_PX);
}

function ensureGuideScrollSlack(targetTop: number, landingOffset: number): void {
  const pageRoot = document.querySelector<HTMLElement>(GUIDE_PAGE_ROOT_SELECTOR);
  const spacer = pageRoot?.querySelector<HTMLElement>(GUIDE_SCROLL_SPACER_SELECTOR);
  if (!spacer) {
    return;
  }

  spacer.style.height = '0px';

  const desiredScrollTop = Math.max(0, targetTop - landingOffset);
  const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const missingSlack = Math.max(0, desiredScrollTop - maxScrollTop);

  spacer.style.height = missingSlack > 0 ? `${Math.ceil(missingSlack) + 1}px` : '0px';
}

function scrollToSection(
  id: string,
  options: { behavior?: ScrollBehavior; updateHash?: boolean } = {},
): void {
  const target = document.getElementById(id);
  if (!target) {
    return;
  }

  if (options.updateHash) {
    const nextHash = `#${encodeURIComponent(id)}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const landingOffset = getGuideLandingOffset();
  const targetTop = target.getBoundingClientRect().top + window.scrollY;

  ensureGuideScrollSlack(targetTop, landingOffset);

  window.scrollTo({
    top: Math.max(0, targetTop - landingOffset),
    behavior: reduceMotion ? 'auto' : (options.behavior ?? 'smooth'),
  });
}

function GuideActionButtons({ actions }: { actions?: GuideActionItem[] }) {
  if (!actions?.length) {
    return null;
  }

  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-2">
      {actions.map((action) =>
        action.to ? (
          <Button
            key={`${action.label}-${action.to}`}
            size="sm"
            variant={action.variant ?? 'outline'}
            asChild
          >
            <Link to={action.to} state={action.state}>
              {action.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : action.sectionId ? (
          <Button
            key={`${action.label}-${action.sectionId}`}
            size="sm"
            variant={action.variant ?? 'outline'}
            onClick={() => scrollToSection(action.sectionId!, { updateHash: true })}
          >
            {action.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null,
      )}
    </div>
  );
}

function GuideActionLinks({
  actions,
  reveal = false,
}: {
  actions?: GuideActionItem[];
  reveal?: boolean;
}) {
  if (!actions?.length) {
    return null;
  }

  const containerClassName = reveal
    ? 'mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-primary/90 transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100'
    : 'mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2';

  return (
    <div className={containerClassName}>
      {actions.map((action) =>
        action.to ? (
          <Link
            key={`${action.label}-${action.to}`}
            className="inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
            to={action.to}
            state={action.state}
          >
            {action.label}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        ) : action.sectionId ? (
          <button
            key={`${action.label}-${action.sectionId}`}
            className="inline-flex items-center text-left text-sm font-medium text-primary transition-colors hover:text-primary/80"
            type="button"
            onClick={() => scrollToSection(action.sectionId!, { updateHash: true })}
          >
            {action.label}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </button>
        ) : null,
      )}
    </div>
  );
}

function GuideSectionHeader({ eyebrow, title, description, actions }: GuideSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="max-w-[62ch]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-sans text-[clamp(1.45rem,3.6vw,2.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[clamp(1.65rem,3.2vw,2.2rem)] sm:leading-[1.08]">
          {title}
        </h2>
        <p className="mt-2.5 text-[0.96rem] leading-[1.58] text-muted-foreground sm:mt-3 sm:text-base sm:leading-7">
          {description}
        </p>
      </div>
      <div className="shrink-0">
        <GuideActionButtons actions={actions} />
      </div>
    </div>
  );
}

function GuideCard({
  icon: Icon,
  title,
  description,
  actions,
  cardClassName,
  iconClassName,
  actionStyle = 'inline',
}: GuideCardProps) {
  const primaryActions = actionStyle === 'buttons' ? actions : actions?.slice(0, 1);

  return (
    <Card
      className={`surface-display group h-full overflow-hidden border-border/90 ${cardClassName ?? ''}`}
    >
      <CardContent className="flex h-full flex-col gap-3.5 p-4 sm:gap-4 sm:p-6">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-border/80 bg-card/85 text-primary shadow-operational sm:h-11 sm:w-11 sm:rounded-2xl ${iconClassName ?? ''}`}
        >
          <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
        </span>
        <div className="flex-1 space-y-1.5 sm:space-y-2">
          <h3 className="font-sans text-[1rem] font-semibold leading-[1.35] tracking-[-0.02em] text-foreground sm:text-[1.1rem] sm:leading-6">
            {title}
          </h3>
          <p className="text-[0.94rem] leading-[1.55] text-muted-foreground sm:text-[0.98rem] sm:leading-6">
            {description}
          </p>
        </div>
        {actionStyle === 'buttons' ? (
          <GuideActionButtons actions={primaryActions} />
        ) : actionStyle === 'inline-reveal' ? (
          <GuideActionLinks actions={primaryActions} reveal />
        ) : (
          <GuideActionLinks actions={primaryActions} />
        )}
      </CardContent>
    </Card>
  );
}

function GuideStepCard({ step, title, description, actions }: GuideStepItem) {
  return (
    <Card className="surface-display group h-full overflow-hidden border-border/90">
      <CardContent className="flex h-full flex-col gap-3.5 p-4 sm:gap-4 sm:p-6">
        <span className="inline-flex w-fit rounded-full border border-primary/16 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary sm:tracking-[0.14em]">
          {step}
        </span>
        <div className="flex-1 space-y-1.5 sm:space-y-2">
          <h3 className="font-sans text-[1rem] font-semibold leading-[1.35] tracking-[-0.02em] text-foreground sm:text-[1.1rem] sm:leading-6">
            {title}
          </h3>
          <p className="text-[0.94rem] leading-[1.55] text-muted-foreground sm:text-[0.98rem] sm:leading-6">
            {description}
          </p>
        </div>
        <GuideActionLinks actions={actions?.slice(0, 1)} reveal />
      </CardContent>
    </Card>
  );
}

function GuideSectionShell({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-[1.6rem] border border-border/75 px-4 py-5 sm:rounded-[2rem] sm:px-6 sm:py-7 lg:px-8 ${className ?? ''}`}
    >
      {children}
    </section>
  );
}

function GuideHeroList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 grid gap-2.5 text-sm text-muted-foreground sm:mt-5 sm:gap-3 sm:text-[0.96rem]">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card/55 px-3 py-2.5"
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="leading-[1.55]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 공개 제품 가이드 페이지.
 *
 * 팀, 프로젝트, 문서 허브, 사전 허브의 상위 흐름을 정적 콘텐츠로 안내한다.
 * 인증 없이 열리며, 현재 로그인 여부에 따라 진입 CTA만 다르게 노출한다.
 */
export default function GuidePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isAuthenticated = Boolean(accessToken || refreshToken);
  const searchParams = new URLSearchParams(location.search);
  const guideSource = searchParams.get('source') as GuideEntrySource | null;
  const contextTeamId = searchParams.get('teamId') ?? undefined;
  const contextProjectId = searchParams.get('projectId') ?? undefined;

  useEffect(() => {
    const targetId = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
    if (!targetId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToSection(targetId, { behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [location.hash]);

  const loginAction: GuideActionItem = {
    label: t('guide.actions.login'),
    to: ROUTES.LOGIN,
  };
  const signupAction: GuideActionItem = {
    label: t('guide.actions.signup'),
    to: ROUTES.SIGNUP,
    variant: 'outline',
  };
  const teamsAction: GuideActionItem = isAuthenticated
    ? {
        label: t('guide.actions.openTeams'),
        to: ROUTES.TEAMS,
      }
    : loginAction;
  const projectsAction: GuideActionItem =
    isAuthenticated && contextTeamId
      ? {
          label: t('guide.actions.openProjects'),
          to: ROUTES.PROJECTS(contextTeamId),
        }
      : teamsAction;
  const dictionaryAction: GuideActionItem =
    isAuthenticated && contextTeamId
      ? {
          label: t('guide.actions.openDictionary'),
          to: ROUTES.DICTIONARY(contextTeamId),
        }
      : teamsAction;

  const buildProjectTabAction = (
    tab: ProjectHubTab,
    label: string,
    fallback: GuideActionItem = projectsAction,
  ): GuideActionItem =>
    isAuthenticated && contextTeamId && contextProjectId
      ? {
          label,
          to: ROUTES.DIAGRAMS(contextTeamId, contextProjectId),
          state: tab === 'documents' ? undefined : { initialTab: tab },
        }
      : fallback;

  const projectHubAction = buildProjectTabAction('overview', t('guide.actions.openProjectHub'));
  const documentHubAction = buildProjectTabAction('documents', t('guide.actions.openDocumentHub'));
  const overviewAction = buildProjectTabAction('overview', t('guide.actions.openOverview'));
  const wbsAction = buildProjectTabAction('wbs', t('guide.actions.openWbs'));
  const ganttAction = buildProjectTabAction('gantt', t('guide.actions.openGantt'));
  const myTasksAction = buildProjectTabAction('myTasks', t('guide.actions.openMyTasks'));
  const staffingAction = buildProjectTabAction('staffing', t('guide.actions.openStaffing'));
  const issuesAction = buildProjectTabAction('issues', t('guide.actions.openIssues'));
  const quickStartAction: GuideActionItem = {
    label: t('guide.actions.reviewQuickStart'),
    sectionId: 'guide-quick-start',
  };
  const dslDetailAction: GuideActionItem = {
    label: t('guide.actions.viewDslDetail'),
    sectionId: 'erd-dsl',
  };
  const loginReturnAction: GuideActionItem = {
    label: t('guide.context.return.login'),
    to: ROUTES.LOGIN,
  };
  const resolveContextAction = (
    action: GuideActionItem,
    authenticatedLabel: string,
  ): GuideActionItem =>
    isAuthenticated ? { ...action, label: authenticatedLabel } : loginReturnAction;

  const contextMeta: GuideContextMeta | null = (() => {
    switch (guideSource) {
      case 'login':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.login'),
          }),
          action: {
            label: t('guide.context.return.login'),
            to: ROUTES.LOGIN,
          },
        };
      case 'signup':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.signup'),
          }),
          action: {
            label: t('guide.context.return.signup'),
            to: ROUTES.SIGNUP,
          },
        };
      case 'teams':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.teams'),
          }),
          action: resolveContextAction(teamsAction, t('guide.context.return.teams')),
        };
      case 'projects':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.projects'),
          }),
          action:
            contextTeamId != null
              ? resolveContextAction(
                  {
                    to: ROUTES.PROJECTS(contextTeamId),
                    label: t('guide.context.return.projects'),
                  },
                  t('guide.context.return.projects'),
                )
              : resolveContextAction(teamsAction, t('guide.context.return.teams')),
        };
      case 'documents':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.documents'),
          }),
          action: resolveContextAction(documentHubAction, t('guide.context.return.documents')),
        };
      case 'overview':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.overview'),
          }),
          action: resolveContextAction(overviewAction, t('guide.context.return.overview')),
        };
      case 'wbs':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.wbs'),
          }),
          action: resolveContextAction(wbsAction, t('guide.context.return.wbs')),
        };
      case 'gantt':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.gantt'),
          }),
          action: resolveContextAction(ganttAction, t('guide.context.return.gantt')),
        };
      case 'staffing':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.staffing'),
          }),
          action: resolveContextAction(staffingAction, t('guide.context.return.staffing')),
        };
      case 'issues':
        return {
          message: t('guide.context.openedFrom', {
            source: t('guide.context.sources.issues'),
          }),
          action: resolveContextAction(issuesAction, t('guide.context.return.issues')),
        };
      default:
        return null;
    }
  })();

  const sectionLinks = [
    { id: 'guide-product', label: t('guide.nav.product') },
    { id: 'guide-quick-start', label: t('guide.nav.quickStart') },
    { id: 'guide-workspace-map', label: t('guide.nav.workspaceMap') },
    { id: 'guide-project-hub', label: t('guide.nav.projectHub') },
    { id: 'guide-document-hub', label: t('guide.nav.documentHub') },
    { id: 'guide-dictionary', label: t('guide.nav.dictionary') },
    { id: 'guide-confusions', label: t('guide.nav.confusions') },
    { id: 'erd-dsl', label: t('guide.nav.dslDetail') },
  ];

  const productCards: GuideCardItem[] = [
    {
      icon: Users,
      title: t('guide.product.cards.teamShared.title'),
      description: t('guide.product.cards.teamShared.description'),
      actions: [teamsAction],
    },
    {
      icon: FolderOpen,
      title: t('guide.product.cards.projectFocused.title'),
      description: t('guide.product.cards.projectFocused.description'),
      actions: [projectsAction],
    },
    {
      icon: Layers3,
      title: t('guide.product.cards.documentDriven.title'),
      description: t('guide.product.cards.documentDriven.description'),
      actions: [documentHubAction, dslDetailAction],
    },
  ];

  const quickStartSteps: GuideStepItem[] = [
    {
      step: '01',
      title: t('guide.quickStart.step1.title'),
      description: t('guide.quickStart.step1.description'),
      actions: isAuthenticated ? [teamsAction] : [loginAction, signupAction],
    },
    {
      step: '02',
      title: t('guide.quickStart.step2.title'),
      description: t('guide.quickStart.step2.description'),
      actions: [teamsAction],
    },
    {
      step: '03',
      title: t('guide.quickStart.step3.title'),
      description: t('guide.quickStart.step3.description'),
      actions: [projectHubAction],
    },
    {
      step: '04',
      title: t('guide.quickStart.step4.title'),
      description: t('guide.quickStart.step4.description'),
      actions: [documentHubAction, dslDetailAction],
    },
  ];

  const workspaceMapCards: GuideCardItem[] = [
    {
      icon: Users,
      title: t('guide.workspaceMap.team.title'),
      description: t('guide.workspaceMap.team.description'),
      actions: [teamsAction],
    },
    {
      icon: FolderOpen,
      title: t('guide.workspaceMap.project.title'),
      description: t('guide.workspaceMap.project.description'),
      actions: [projectsAction],
    },
    {
      icon: FileText,
      title: t('guide.workspaceMap.documentHub.title'),
      description: t('guide.workspaceMap.documentHub.description'),
      actions: [documentHubAction],
    },
    {
      icon: BookOpen,
      title: t('guide.workspaceMap.dictionary.title'),
      description: t('guide.workspaceMap.dictionary.description'),
      actions: [dictionaryAction],
    },
  ];

  const projectHubCards: GuideCardItem[] = [
    {
      icon: ClipboardList,
      title: t('guide.projectHub.overview.title'),
      description: t('guide.projectHub.overview.description'),
      actions: [overviewAction],
    },
    {
      icon: ListTree,
      title: t('guide.projectHub.wbs.title'),
      description: t('guide.projectHub.wbs.description'),
      actions: [wbsAction],
    },
    {
      icon: Map,
      title: t('guide.projectHub.gantt.title'),
      description: t('guide.projectHub.gantt.description'),
      actions: [ganttAction],
    },
    {
      icon: Workflow,
      title: t('guide.projectHub.myTasks.title'),
      description: t('guide.projectHub.myTasks.description'),
      actions: [myTasksAction],
    },
    {
      icon: UsersRound,
      title: t('guide.projectHub.staffing.title'),
      description: t('guide.projectHub.staffing.description'),
      actions: [staffingAction],
    },
    {
      icon: CircleAlert,
      title: t('guide.projectHub.issues.title'),
      description: t('guide.projectHub.issues.description'),
      actions: [issuesAction],
    },
  ];

  const documentHubCards: GuideCardItem[] = [
    {
      icon: Layers3,
      title: t('guide.documentHub.erd.title'),
      description: t('guide.documentHub.erd.description'),
      actions: [documentHubAction, dslDetailAction],
    },
    {
      icon: FileText,
      title: t('guide.documentHub.markdown.title'),
      description: t('guide.documentHub.markdown.description'),
      actions: [documentHubAction],
    },
    {
      icon: Sparkles,
      title: t('guide.documentHub.screenSpec.title'),
      description: t('guide.documentHub.screenSpec.description'),
      actions: [documentHubAction],
    },
  ];

  const dictionaryCards: GuideCardItem[] = [
    {
      icon: BookOpen,
      title: t('guide.dictionary.sets.title'),
      description: t('guide.dictionary.sets.description'),
      actions: [dictionaryAction],
    },
    {
      icon: GitFork,
      title: t('guide.dictionary.assets.title'),
      description: t('guide.dictionary.assets.description'),
      actions: [dictionaryAction],
    },
    {
      icon: Workflow,
      title: t('guide.dictionary.binding.title'),
      description: t('guide.dictionary.binding.description'),
      actions: [dictionaryAction],
    },
  ];

  const confusionCards: GuideCardItem[] = [
    {
      icon: Compass,
      title: t('guide.confusions.flow.title'),
      description: t('guide.confusions.flow.description'),
      actions: [quickStartAction],
    },
    {
      icon: FolderOpen,
      title: t('guide.confusions.projectVsDocument.title'),
      description: t('guide.confusions.projectVsDocument.description'),
      actions: [projectHubAction],
    },
    {
      icon: BookOpen,
      title: t('guide.confusions.dictionaryContext.title'),
      description: t('guide.confusions.dictionaryContext.description'),
      actions: [dictionaryAction],
    },
    {
      icon: Workflow,
      title: t('guide.confusions.todoPrivacy.title'),
      description: t('guide.confusions.todoPrivacy.description'),
      actions: [myTasksAction, wbsAction],
    },
    {
      icon: CircleAlert,
      title: t('guide.confusions.dsl.title'),
      description: t('guide.confusions.dsl.description'),
      actions: [dslDetailAction, documentHubAction],
    },
  ];

  const heroHighlights = [
    t('guide.hero.highlightFlow'),
    t('guide.hero.highlightNaming'),
    t('guide.hero.highlightPublic'),
  ];
  const visibleSectionLinks = isMobile
    ? sectionLinks.filter((sectionLink) =>
        ['guide-product', 'guide-quick-start', 'guide-project-hub', 'erd-dsl'].includes(
          sectionLink.id,
        ),
      )
    : sectionLinks;

  const detailPrimaryAction = isAuthenticated ? documentHubAction : loginAction;
  const heroPrimaryActions = isAuthenticated
    ? [
        {
          label: t('guide.hero.primaryAuthenticated'),
          to: ROUTES.TEAMS,
          variant: 'default' as const,
        },
        {
          label: t('guide.hero.secondaryAuthenticated'),
          sectionId: 'guide-quick-start',
          variant: 'outline' as const,
        },
      ]
    : [
        {
          label: t('guide.hero.primaryGuest'),
          to: ROUTES.LOGIN,
          variant: 'default' as const,
        },
        {
          label: t('guide.hero.secondaryGuest'),
          to: ROUTES.SIGNUP,
          variant: 'outline' as const,
        },
      ];
  const sectionRailLinks = visibleSectionLinks.slice(0, isMobile ? 4 : visibleSectionLinks.length);

  return (
    <div className="workspace-shell min-h-screen bg-background">
      <header
        data-guide-header
        className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t('guide.header.label')}
            </p>
            <h1 className="mt-1 font-sans text-base font-semibold tracking-[-0.03em] text-foreground sm:text-lg">
              {t('common.appName')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="hidden sm:inline-flex"
              variant="ghost"
              size="sm"
              onClick={() => scrollToSection('guide-quick-start', { updateHash: true })}
            >
              {t('guide.header.quickStart')}
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link to={ROUTES.TEAMS}>{t('guide.hero.primaryAuthenticated')}</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to={ROUTES.LOGIN}>{t('guide.hero.primaryGuest')}</Link>
                </Button>
                <Button asChild>
                  <Link to={ROUTES.SIGNUP}>{t('guide.hero.secondaryGuest')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
        <div
          data-guide-page-root
          className="mx-auto flex w-full max-w-6xl flex-col gap-7 sm:gap-10"
        >
          <section className="surface-display surface-display--documents overflow-hidden rounded-[1.6rem] border-border/90 sm:rounded-[2rem]">
            <div className="grid gap-5 p-4 sm:gap-6 sm:p-6 md:p-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] xl:gap-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
                    {t('guide.hero.eyebrow')}
                  </p>
                  {contextMeta && (
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-card/72 px-3 py-1.5 text-[12px] text-muted-foreground">
                      <span className="font-medium text-foreground">{contextMeta.message}</span>
                      {contextMeta.action.to ? (
                        <Link
                          className="inline-flex items-center font-medium text-primary transition-colors hover:text-primary/80"
                          to={contextMeta.action.to}
                          state={contextMeta.action.state}
                        >
                          {contextMeta.action.label}
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
                <h2 className="mt-2.5 max-w-[15ch] font-sans text-[clamp(1.72rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:mt-3 sm:max-w-[15ch] sm:text-[clamp(1.9rem,4.5vw,3rem)] sm:leading-[1.04]">
                  {t('guide.hero.title')}
                </h2>
                <p className="mt-3 max-w-[52ch] text-[0.99rem] leading-[1.7] text-muted-foreground sm:mt-4 sm:max-w-[58ch] sm:text-[1.04rem] sm:leading-8">
                  {t('guide.hero.description')}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-2.5">
                  {heroPrimaryActions.map((action) =>
                    action.to ? (
                      <Button key={action.label} asChild variant={action.variant}>
                        <Link to={action.to}>
                          {action.label}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        key={action.label}
                        variant={action.variant}
                        onClick={() =>
                          scrollToSection(action.sectionId!, {
                            updateHash: true,
                          })
                        }
                      >
                        {action.label}
                      </Button>
                    ),
                  )}
                </div>

                <GuideHeroList items={isMobile ? heroHighlights.slice(0, 2) : heroHighlights} />
              </div>

              <Card className="surface-operational h-full overflow-hidden rounded-[1.4rem] border-border/85 sm:rounded-[1.75rem]">
                <CardContent className="flex h-full flex-col gap-4 p-4 sm:gap-5 sm:p-6">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
                      {t('guide.hero.snapshotEyebrow')}
                    </p>
                    <h3 className="mt-2 font-sans text-[1.2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[1.35rem] sm:leading-[1.12]">
                      {t('guide.hero.snapshotTitle')}
                    </h3>
                    <p className="mt-2.5 text-[0.96rem] leading-[1.58] text-muted-foreground sm:mt-3 sm:text-[0.98rem] sm:leading-7">
                      {t('guide.hero.snapshotDescription')}
                    </p>
                  </div>

                  <div className="space-y-2.5 sm:space-y-3">
                    {[
                      {
                        title: t('guide.hero.snapshotTeam.title'),
                        body: t('guide.hero.snapshotTeam.description'),
                      },
                      {
                        title: t('guide.hero.snapshotProject.title'),
                        body: t('guide.hero.snapshotProject.description'),
                      },
                      {
                        title: t('guide.hero.snapshotDocument.title'),
                        body: t('guide.hero.snapshotDocument.description'),
                      },
                    ].map((item, index) => (
                      <div
                        key={item.title}
                        className="rounded-[1.15rem] border border-border/80 bg-card/88 p-3 shadow-operational sm:rounded-2xl sm:p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary sm:h-8 sm:w-8">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.88rem] font-semibold leading-[1.35] text-foreground sm:text-[0.95rem]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[0.9rem] leading-[1.5] text-muted-foreground sm:text-[0.95rem] sm:leading-6">
                              {item.body}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 border-t border-border/70 pt-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-secondary/80">
                        {t('guide.header.quickStart')}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {sectionRailLinks.map((sectionLink) => (
                          <button
                            key={sectionLink.id}
                            className="flex items-center justify-between rounded-2xl border border-border/65 bg-card/78 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                            type="button"
                            onClick={() =>
                              scrollToSection(sectionLink.id, {
                                updateHash: true,
                              })
                            }
                          >
                            <span>{sectionLink.label}</span>
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <GuideActionLinks
                      actions={[isAuthenticated ? teamsAction : loginAction, quickStartAction]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <GuideSectionShell
            id="guide-product"
            className="surface-display surface-display--projects space-y-5 sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.product.eyebrow')}
              title={t('guide.product.title')}
              description={t('guide.product.description')}
              actions={[teamsAction, quickStartAction]}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {productCards.map((card, index) => (
                <GuideCard
                  key={card.title}
                  {...card}
                  actionStyle="inline-reveal"
                  cardClassName={index === 0 ? 'md:col-span-3 xl:col-span-1' : undefined}
                />
              ))}
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-quick-start"
            className="space-y-5 bg-[linear-gradient(180deg,hsl(var(--background)/0.26),hsl(var(--card)/0.82))] sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.quickStart.eyebrow')}
              title={t('guide.quickStart.title')}
              description={t('guide.quickStart.description')}
              actions={[isAuthenticated ? teamsAction : signupAction]}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickStartSteps.map((step) => (
                <GuideStepCard key={step.step} {...step} />
              ))}
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-workspace-map"
            className="surface-display surface-display--teams space-y-5 sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.workspaceMap.eyebrow')}
              title={t('guide.workspaceMap.title')}
              description={t('guide.workspaceMap.description')}
              actions={[teamsAction]}
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.34fr)_minmax(0,1fr)]">
              <div className="surface-operational rounded-[1.4rem] border-border/75 p-4 sm:p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {t('guide.workspaceMap.eyebrow')}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[0.96rem]">
                  {t('guide.workspaceMap.description')}
                </p>
                <GuideActionLinks actions={[teamsAction]} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {workspaceMapCards.map((card) => (
                  <GuideCard key={card.title} {...card} actionStyle="inline-reveal" />
                ))}
              </div>
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-project-hub"
            className="space-y-5 bg-[linear-gradient(180deg,hsl(var(--secondary)/0.76),hsl(var(--background)/0.92))] sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.projectHub.eyebrow')}
              title={t('guide.projectHub.title')}
              description={t('guide.projectHub.description')}
              actions={[projectHubAction]}
            />
            <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.3fr)_minmax(0,1fr)]">
              <div className="rounded-[1.4rem] border border-border/75 bg-background/55 p-4 sm:p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {t('guide.projectHub.eyebrow')}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[0.96rem]">
                  {t('guide.projectHub.description')}
                </p>
                <GuideActionLinks actions={[projectHubAction]} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {projectHubCards.map((card, index) => (
                  <GuideCard
                    key={card.title}
                    {...card}
                    actionStyle="inline-reveal"
                    iconClassName="bg-primary/8"
                    cardClassName={index === 0 ? 'md:col-span-2 xl:col-span-3' : undefined}
                  />
                ))}
              </div>
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-document-hub"
            className="surface-display surface-display--documents space-y-5 sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.documentHub.eyebrow')}
              title={t('guide.documentHub.title')}
              description={t('guide.documentHub.description')}
              actions={[documentHubAction, dslDetailAction]}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {documentHubCards.map((card) => (
                <GuideCard key={card.title} {...card} actionStyle="inline-reveal" />
              ))}
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-dictionary"
            className="surface-display surface-display--dictionary space-y-5 sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.dictionary.eyebrow')}
              title={t('guide.dictionary.title')}
              description={t('guide.dictionary.description')}
              actions={[dictionaryAction]}
            />
            <div className="grid gap-4 md:grid-cols-3">
              {dictionaryCards.map((card) => (
                <GuideCard key={card.title} {...card} actionStyle="inline-reveal" />
              ))}
            </div>
          </GuideSectionShell>

          <GuideSectionShell
            id="guide-confusions"
            className="space-y-5 bg-[linear-gradient(180deg,hsl(var(--background)/0.12),hsl(var(--secondary)/0.5))] sm:space-y-6"
          >
            <GuideSectionHeader
              eyebrow={t('guide.confusions.eyebrow')}
              title={t('guide.confusions.title')}
              description={t('guide.confusions.description')}
              actions={[quickStartAction, dslDetailAction]}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {confusionCards.map((card) => (
                <GuideCard key={card.title} {...card} actionStyle="inline-reveal" />
              ))}
            </div>
          </GuideSectionShell>

          <section
            id="erd-dsl"
            className="surface-display overflow-hidden rounded-[1.6rem] border-border/90 sm:rounded-[2rem]"
          >
            <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {t('guide.detailCallout.eyebrow')}
                </p>
                <h2 className="mt-2 font-sans text-[clamp(1.65rem,3.2vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
                  {t('guide.detailCallout.title')}
                </h2>
                <p className="mt-2.5 max-w-[60ch] text-[0.93rem] leading-[1.5] text-muted-foreground sm:mt-3 sm:text-base sm:leading-7">
                  {t('guide.detailCallout.description')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => scrollToSection('guide-confusions', { updateHash: true })}
                >
                  {t('guide.detailCallout.secondary')}
                </Button>
                {contextMeta?.action.to && (
                  <Button variant="outline" asChild>
                    <Link to={contextMeta.action.to} state={contextMeta.action.state}>
                      {contextMeta.action.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant={detailPrimaryAction.variant ?? 'default'} asChild>
                  <Link to={detailPrimaryAction.to!} state={detailPrimaryAction.state}>
                    {detailPrimaryAction.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <div aria-hidden="true" data-guide-scroll-spacer className="h-0" />
        </div>
      </main>
    </div>
  );
}
