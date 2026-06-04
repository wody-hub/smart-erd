import { Activity, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import i18next from 'i18next';
import { fetchProjectAiHistory, AI_HISTORY_DEFAULT_LIMIT } from '@/api/aiHistoryApi';
import Spinner from '@/components/ui/spinner';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import type { AiProjectHistoryItem } from '@/types/ai-history';

interface ProjectAiHistoryTabProps {
  teamId: string;
  projectId: string;
}

export interface ProjectAiHistoryListProps {
  items: AiProjectHistoryItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  hasMore?: boolean;
  limit?: number;
  locale?: string;
}

/**
 * 값이 있으면 표시하고, 없으면 공통 fallback을 반환한다.
 *
 * @param value 표시할 값
 * @returns 화면 표시용 문자열
 */
function displayValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : i18next.t('aiHistory.emptyValue');
}

/**
 * ISO 시간 문자열을 현재 locale에 맞는 짧은 날짜/시간으로 변환한다.
 *
 * @param value ISO 시간 문자열
 * @param locale 표시 locale
 * @returns 화면 표시용 시간 문자열
 */
function formatHistoryTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) {
    return i18next.t('aiHistory.emptyValue');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * history row에서 안정적인 React key를 만든다.
 *
 * @param item history 항목
 * @param index row index
 * @returns React key
 */
function historyItemKey(item: AiProjectHistoryItem, index: number): string {
  return item.proposalId ?? item.executionId ?? `${item.kind}-${index}`;
}

/**
 * 프로젝트 AI history 목록의 read-only 상태를 렌더링한다.
 *
 * @param props history 목록 렌더링 props
 * @returns 프로젝트 AI history 목록 JSX
 */
export function ProjectAiHistoryList({
  items,
  isLoading = false,
  errorMessage = null,
  hasMore = false,
  limit = AI_HISTORY_DEFAULT_LIMIT,
  locale = i18next.resolvedLanguage ?? i18next.language ?? 'ko',
}: ProjectAiHistoryListProps) {
  if (isLoading) {
    return (
      <section className="py-8" role="status" aria-label={i18next.t('aiHistory.loading')}>
        <Spinner text={i18next.t('aiHistory.loading')} />
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section
        className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{i18next.t('aiHistory.error')}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{errorMessage}</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-border/80 px-4 py-10 text-center">
        <Activity className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">
          {i18next.t('aiHistory.empty')}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {i18next.t('aiHistory.emptyDescription')}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label={i18next.t('aiHistory.title')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {i18next.t('aiHistory.resultCount', { count: items.length, limit })}
        </p>
        {hasMore ? (
          <p className="text-xs font-medium text-muted-foreground">
            {i18next.t('aiHistory.hasMore')}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-border/80">
        <table className="min-w-[72rem] w-full text-left text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-normal text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.status')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.action')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.target')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.requester')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.decision')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.created')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.decided')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.ids')}</th>
              <th className="px-3 py-2 font-semibold">{i18next.t('aiHistory.column.error')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {items.map((item, index) => (
              <tr key={historyItemKey(item, index)} className="align-top">
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">{displayValue(item.status)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {displayValue(item.riskLevel)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">
                      {displayValue(item.actionType)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {displayValue(item.provider)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <span className="font-medium text-foreground">
                      {displayValue(item.targetLabel)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {displayValue(item.targetType)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-foreground">{displayValue(item.requestedBy)}</td>
                <td className="px-3 py-2 text-foreground">{displayValue(item.decisionBy)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatHistoryTimestamp(item.createdAt, locale)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatHistoryTimestamp(item.decidedAt, locale)}
                </td>
                <td className="px-3 py-2 text-xs leading-5 text-muted-foreground">
                  <div>{displayValue(item.executionId)}</div>
                  <div>{displayValue(item.proposalId)}</div>
                  <div>{displayValue(item.promptVersion)}</div>
                </td>
                <td className="px-3 py-2">
                  {item.redactedErrorTitle ? (
                    <div className="max-w-xs space-y-1 text-xs leading-5 text-destructive">
                      <div className="font-medium">{item.redactedErrorTitle}</div>
                      {item.redactedErrorDetail ? <div>{item.redactedErrorDetail}</div> : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {displayValue(item.summary)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 프로젝트 허브의 read-only AI history 탭.
 *
 * @param props 프로젝트 AI history 탭 props
 * @returns 프로젝트 AI history 탭 JSX
 */
export default function ProjectAiHistoryTab({ teamId, projectId }: ProjectAiHistoryTabProps) {
  const historyQuery = useQuery({
    queryKey: queryKeys.aiHistory.project(teamId, projectId, AI_HISTORY_DEFAULT_LIMIT),
    queryFn: () => fetchProjectAiHistory(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{i18next.t('aiHistory.title')}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {i18next.t('aiHistory.description')}
        </p>
      </div>
      <ProjectAiHistoryList
        items={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        errorMessage={
          historyQuery.isError
            ? getErrorMessage(historyQuery.error, i18next.t('aiHistory.errorDescription'))
            : null
        }
        hasMore={historyQuery.data?.hasMore ?? false}
        limit={historyQuery.data?.limit ?? AI_HISTORY_DEFAULT_LIMIT}
      />
    </div>
  );
}
