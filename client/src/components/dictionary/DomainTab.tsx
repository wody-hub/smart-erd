import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Database, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import DomainFormDialog from '@/components/dictionary/DomainFormDialog';
import BulkUploadDialog from '@/components/dictionary/BulkUploadDialog';
import {
  createDomain,
  deleteDomain,
  downloadDomainDictionary,
  downloadDomainTemplate,
  fetchDomainsPage,
  updateDomain,
} from '@/api/domainApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { rankDictionarySearchResults } from '@/lib/dictionary-search-ranking';
import { usePaginatedSearch } from '@/hooks/usePaginatedSearch';
import type { Domain, DomainFormData } from '@/types/dictionary';

const PAGE_SIZE = 20;

/** DomainTab 컴포넌트의 props. */
interface DomainTabProps {
  /** 편집 가능 여부 (VIEWER일 때 false — 생성/수정/삭제/업로드 버튼 숨김) */
  canEdit?: boolean;
  /** 선택된 사전 세트 ID */
  setId: string;
}

/**
 * 도메인 사전 탭 컴포넌트.
 *
 * 도메인 목록 테이블과 생성/수정/삭제 기능을 제공한다.
 * 역할에 따라 CRUD/업로드 버튼을 조건부 렌더링한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns 도메인 사전 탭 JSX
 */
export default function DomainTab({ canEdit = true, setId }: DomainTabProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 폼 다이얼로그 열림 상태 */
  const [formOpen, setFormOpen] = useState(false);
  /** 수정 대상 도메인 (null이면 생성 모드) */
  const [editTarget, setEditTarget] = useState<Domain | null>(null);
  /** 삭제 확인 대상 도메인 ID */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  /** 일괄 업로드 다이얼로그 열림 상태 */
  const [uploadOpen, setUploadOpen] = useState(false);

  const { searchInput, setSearchInput, searchKeyword, page, setPage, adjustToTotalPages } =
    usePaginatedSearch({ resetKey: `${teamId ?? ''}:${setId}` });

  const {
    data: domainPageData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.dictionary.domainsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    queryFn: () => fetchDomainsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    enabled: !!teamId && !!setId,
    placeholderData: (previousData) => previousData,
  });
  const domains = useMemo(
    () =>
      rankDictionarySearchResults(domainPageData?.content ?? [], searchKeyword, (domain) => [
        domain.domainGroup,
        domain.domainClassification,
        domain.dataType,
        domain.physicalType,
        domain.description,
      ]),
    [domainPageData?.content, searchKeyword],
  );
  const totalElements = domainPageData?.totalElements ?? 0;
  const totalPages = domainPageData?.totalPages ?? 0;
  const isLastPage = domainPageData?.last ?? true;

  const createMutation = useMutation({
    mutationFn: (data: DomainFormData) => createDomain(teamId!, setId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      toast.success(t('dictionary.domain.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DomainFormData }) =>
      updateDomain(teamId!, setId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      toast.success(t('dictionary.domain.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (domainId: number) => deleteDomain(teamId!, setId, domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.domains(teamId!, setId) });
      setDeleteTarget(null);
      toast.success(t('dictionary.domain.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.domain.toast.deleteFailed'))),
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: () => downloadDomainTemplate(teamId!, setId),
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.templateFailed'))),
  });

  const downloadDictionaryMutation = useMutation({
    mutationFn: () => downloadDomainDictionary(teamId!, setId),
    onSuccess: () => toast.success(t('dictionary.export.domainDownloaded')),
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.export.domainFailed'))),
  });

  /**
   * 생성 버튼 클릭 핸들러.
   *
   * @returns 없음
   */
  const handleCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  /**
   * 수정 버튼 클릭 핸들러.
   *
   * @param domain 수정 대상 도메인
   * @returns 없음
   */
  const handleEdit = (domain: Domain) => {
    setEditTarget(domain);
    setFormOpen(true);
  };

  const isActionElementTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && target.closest('button') !== null;

  /**
   * 폼 제출 핸들러 (생성/수정 분기).
   *
   * @param data 폼 데이터
   * @returns 없음
   */
  const handleSubmit = async (data: DomainFormData) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  /**
   * 도메인 업로드 템플릿 다운로드 핸들러.
   *
   * @returns 없음
   */
  const handleTemplateDownload = () => {
    downloadTemplateMutation.mutate();
  };

  // 서버 totalPages 기반 페이지 범위 보정
  useEffect(() => {
    if (!domainPageData) return;
    adjustToTotalPages(domainPageData.totalPages);
  }, [domainPageData, adjustToTotalPages]);

  if (isLoading && !domainPageData) {
    return <Spinner text={t('common.loading')} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('dictionary.search.domainPlaceholder')}
            aria-label={t('dictionary.search.domainPlaceholder')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => downloadDictionaryMutation.mutate()}
            disabled={downloadDictionaryMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('dictionary.export.button')}
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={handleTemplateDownload}
                disabled={downloadTemplateMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('dictionary.upload.template')}
              </Button>
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                {t('dictionary.upload.button')}
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('dictionary.domain.form.createTitle')}
              </Button>
            </>
          )}
        </div>
      </div>

      {totalElements === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('dictionary.domain.table.empty')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => downloadDictionaryMutation.mutate()}
                disabled={downloadDictionaryMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('dictionary.export.button')}
              </Button>
              {canEdit && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('dictionary.domain.form.createTitle')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed min-w-[1500px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px] whitespace-nowrap">
                  {t('dictionary.domain.table.domainGroup')}
                </TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">
                  {t('dictionary.domain.table.domainClassification')}
                </TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.domain.table.logicalName')}
                </TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">
                  {t('dictionary.domain.table.dataType')}
                </TableHead>
                <TableHead className="w-[120px] whitespace-nowrap text-center">
                  {t('dictionary.domain.table.dataLength')}
                </TableHead>
                <TableHead className="w-[140px] whitespace-nowrap text-center">
                  {t('dictionary.domain.table.dataScale')}
                </TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.domain.table.physicalType')}
                </TableHead>
                <TableHead className="w-[360px] max-w-[360px]">
                  {t('dictionary.domain.table.description')}
                </TableHead>
                {canEdit && (
                  <TableHead className="w-[100px]">
                    {t('dictionary.domain.table.actions')}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow
                  key={domain.id}
                  className={
                    canEdit ? 'cursor-pointer transition-colors hover:bg-muted/50' : undefined
                  }
                  onClick={canEdit ? () => handleEdit(domain) : undefined}
                  onKeyDown={
                    canEdit
                      ? (e) => {
                          if (isActionElementTarget(e.target)) {
                            return;
                          }
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleEdit(domain);
                          }
                        }
                      : undefined
                  }
                  tabIndex={canEdit ? 0 : undefined}
                >
                  <TableCell className="whitespace-nowrap">
                    {domain.domainGroup ?? ''}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {domain.domainClassification ?? ''}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {domain.logicalName}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    {domain.dataType ?? ''}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {domain.dataLength ?? ''}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {domain.dataScale ?? ''}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    {domain.physicalType}
                  </TableCell>
                  <TableCell className="max-w-[360px] whitespace-normal break-words text-muted-foreground">
                    {domain.description ?? ''}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(domain);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={t('dictionary.domain.aria.editDomain', {
                            name: domain.logicalName,
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(domain.id);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={t('dictionary.domain.aria.deleteDomain', {
                            name: domain.logicalName,
                          })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalElements > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {t('dictionary.pagination.total', { count: totalElements })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0 || isFetching}
            >
              {t('common.button.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('dictionary.pagination.page', {
                current: totalPages === 0 ? 0 : page + 1,
                total: Math.max(totalPages, 1),
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={isLastPage || isFetching}
            >
              {t('common.button.next')}
            </Button>
          </div>
        </div>
      )}

      <DomainFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editTarget}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('dictionary.domain.delete.dialogTitle')}
        description={t('dictionary.domain.delete.dialogDescription')}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
        loading={deleteMutation.isPending}
      />

      <BulkUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        mode="domain"
        setId={setId}
      />
    </div>
  );
}
