import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchBusinessOverview, updateBusinessOverview } from '@/api/projectApi';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Spinner from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { formatCurrency, formatProjectDate, isDateOrderValid, isDatePairValid } from '@/lib/format';
import type { UpdateBusinessOverviewPayload } from '@/types/project';

/** 사업 개요 탭 props. */
interface BusinessOverviewTabProps {
  /** 팀 ID */
  teamId: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 편집 권한 여부 */
  canEdit: boolean;
}

/** 사업 개요 편집 폼 상태. */
interface BusinessOverviewFormState {
  /** 발주사명 */
  clientCompany: string;
  /** 수주사명 */
  contractorCompany: string;
  /** 계약 금액 raw 문자열 */
  contractAmountRaw: string;
  /** 프로젝트 시작일 */
  startDate: string;
  /** 프로젝트 종료일 */
  endDate: string;
  /** 프로젝트 범위 */
  projectScope: string;
}

const INITIAL_FORM: BusinessOverviewFormState = {
  clientCompany: '',
  contractorCompany: '',
  contractAmountRaw: '',
  startDate: '',
  endDate: '',
  projectScope: '',
};

/** 요약 카드 props. */
interface SummaryCardProps {
  /** 카드 라벨 */
  label: string;
  /** 카드 값 */
  value: string | number;
  /** 값 단위 */
  unit?: string;
}

/**
 * 사업 개요 상단 요약 지표 카드를 렌더링한다.
 *
 * @param props 카드 props
 * @returns 요약 카드 JSX
 */
function SummaryCard({ label, value, unit }: SummaryCardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="rounded-xl border border-border bg-card p-4 shadow-operational"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/**
 * 프로젝트 사업 개요 탭을 렌더링한다.
 *
 * @param props 사업 개요 탭 props
 * @returns 사업 개요 탭 JSX
 */
export default function BusinessOverviewTab({
  teamId,
  projectId,
  canEdit,
}: BusinessOverviewTabProps) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<BusinessOverviewFormState>(INITIAL_FORM);

  const businessOverviewQuery = useQuery({
    queryKey: queryKeys.projects.businessOverview(teamId, projectId),
    queryFn: () => fetchBusinessOverview(teamId, projectId),
    enabled: Boolean(teamId) && Boolean(projectId),
  });
  const { data, isLoading, isError } = businessOverviewQuery;

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateBusinessOverviewPayload) =>
      updateBusinessOverview(teamId, projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.businessOverview(teamId, projectId),
      });
      setIsEditing(false);
      toast.success(t('businessOverview.save.success'));
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, t('businessOverview.save.failed')));
    },
  });

  /**
   * 편집 모드로 전환한다.
   */
  const handleEditStart = () => {
    setIsEditing(true);
  };

  /**
   * 편집을 취소하고 읽기 모드로 되돌린다.
   */
  const handleCancel = () => {
    setIsEditing(false);
  };

  /**
   * 사업 개요 편집 폼을 저장한다.
   *
   * @param event 폼 submit 이벤트
   */
  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amountRaw = form.contractAmountRaw.trim();
    let contractAmount: number | null = null;
    if (amountRaw !== '') {
      const parsedAmount = Number(amountRaw);
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
        toast.error(t('businessOverview.validation.invalidAmount'));
        return;
      }
      contractAmount = parsedAmount;
    }

    if (!isDatePairValid(form.startDate, form.endDate)) {
      toast.error(t('businessOverview.validation.datePair'));
      return;
    }
    if (!isDateOrderValid(form.startDate, form.endDate)) {
      toast.error(t('businessOverview.validation.dateOrder'));
      return;
    }

    saveMutation.mutate({
      clientCompany: normalizeNullableText(form.clientCompany),
      contractorCompany: normalizeNullableText(form.contractorCompany),
      contractAmount,
      projectStartDate: normalizeNullableDate(form.startDate),
      projectEndDate: normalizeNullableDate(form.endDate),
      projectScope: normalizeNullableText(form.projectScope),
    });
  };

  useEffect(() => {
    if (!isEditing || !data) {
      return;
    }
    setForm({
      clientCompany: data.clientCompany ?? '',
      contractorCompany: data.contractorCompany ?? '',
      contractAmountRaw: data.contractAmount != null ? String(data.contractAmount) : '',
      startDate: data.projectStartDate ?? '',
      endDate: data.projectEndDate ?? '',
      projectScope: data.projectScope ?? '',
    });
  }, [isEditing, data]);

  if (isLoading) {
    return <Spinner text={t('common.loading')} />;
  }

  if (isError || !data) {
    return (
      <div className="mt-6">
        <WorkspaceEmptyState
          icon={<AlertTriangle className="h-10 w-10" />}
          title={t('workspace.status.loadFailedTitle')}
          description={t('businessOverview.save.failed')}
          tone="error"
          role="alert"
          action={
            <Button variant="outline" onClick={() => void businessOverviewQuery.refetch()}>
              {t('workspace.status.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const isDataEmpty =
    data.clientCompany == null &&
    data.contractorCompany == null &&
    data.contractAmount == null &&
    data.projectStartDate == null &&
    data.projectEndDate == null &&
    data.projectScope == null;

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const progressRateValue =
    data.progressRate != null
      ? Number(data.progressRate.toFixed(1))
      : t('businessOverview.summary.notAvailable');
  const progressRateUnit = data.progressRate != null ? '%' : undefined;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
          {t('businessOverview.tab.title')}
        </h2>
        {canEdit && !isEditing && (
          <Button
            variant="outline"
            aria-label={t('businessOverview.editAriaLabel')}
            onClick={handleEditStart}
          >
            {t('businessOverview.editButton')}
          </Button>
        )}
      </div>

      {isDataEmpty && !isEditing && (
        <WorkspaceEmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title={t('businessOverview.emptyTitle')}
          description={t('businessOverview.emptyDescription')}
          action={
            canEdit ? (
              <Button onClick={handleEditStart}>{t('businessOverview.emptyCta')}</Button>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label={t('businessOverview.summary.memberCount')} value={data.memberCount} />
        <SummaryCard
          label={t('businessOverview.summary.documentCount')}
          value={data.documentCount}
        />
        <SummaryCard
          label={t('businessOverview.summary.progressRate')}
          value={progressRateValue}
          unit={progressRateUnit}
        />
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-overview-client-company">
                {t('businessOverview.field.clientCompany')}
              </Label>
              <Input
                id="business-overview-client-company"
                maxLength={200}
                value={form.clientCompany}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, clientCompany: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-overview-contractor-company">
                {t('businessOverview.field.contractorCompany')}
              </Label>
              <Input
                id="business-overview-contractor-company"
                maxLength={200}
                value={form.contractorCompany}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contractorCompany: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-overview-contract-amount">
                {t('businessOverview.field.contractAmount')}
              </Label>
              <Input
                id="business-overview-contract-amount"
                type="text"
                inputMode="numeric"
                value={form.contractAmountRaw}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contractAmountRaw: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-overview-project-start-date">
                {t('businessOverview.field.projectStartDate')}
              </Label>
              <Input
                id="business-overview-project-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startDate: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-overview-project-end-date">
                {t('businessOverview.field.projectEndDate')}
              </Label>
              <Input
                id="business-overview-project-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="business-overview-project-scope">
                {t('businessOverview.field.projectScope')}
              </Label>
              <Textarea
                id="business-overview-project-scope"
                rows={4}
                className="resize-none"
                value={form.projectScope}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, projectScope: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              {t('common.button.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('common.button.saving') : t('common.button.save')}
            </Button>
          </div>
        </form>
      ) : (
        !isDataEmpty && (
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.clientCompany')}
              </dt>
              <dd className="text-base text-foreground">
                {data.clientCompany ?? t('businessOverview.field.empty')}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.contractorCompany')}
              </dt>
              <dd className="text-base text-foreground">
                {data.contractorCompany ?? t('businessOverview.field.empty')}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.contractAmount')}
              </dt>
              <dd className="text-base text-foreground">
                {data.contractAmount != null
                  ? formatCurrency(data.contractAmount)
                  : t('businessOverview.field.empty')}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.projectStartDate')}
              </dt>
              <dd className="text-base text-foreground">
                {data.projectStartDate
                  ? formatProjectDate(data.projectStartDate, locale)
                  : t('businessOverview.field.empty')}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.projectEndDate')}
              </dt>
              <dd className="text-base text-foreground">
                {data.projectEndDate
                  ? formatProjectDate(data.projectEndDate, locale)
                  : t('businessOverview.field.empty')}
              </dd>
            </div>

            <div className="space-y-1 md:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t('businessOverview.field.projectScope')}
              </dt>
              <dd className="whitespace-pre-wrap text-base text-foreground">
                {data.projectScope ?? t('businessOverview.field.empty')}
              </dd>
            </div>
          </dl>
        )
      )}
    </div>
  );
}

/**
 * 텍스트 입력값을 null 허용 형태로 정규화한다.
 *
 * @param value 텍스트 입력값
 * @returns trim 결과가 빈 문자열이면 null, 아니면 trim 문자열
 */
function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 날짜 입력값을 null 허용 형태로 정규화한다.
 *
 * @param value 날짜 입력값
 * @returns 빈 문자열이면 null, 아니면 원본 문자열
 */
function normalizeNullableDate(value: string): string | null {
  return value || null;
}
