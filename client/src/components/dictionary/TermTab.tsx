import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, FileText, Upload, Download } from 'lucide-react';
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
import TermFormDialog from '@/components/dictionary/TermFormDialog';
import BulkUploadDialog from '@/components/dictionary/BulkUploadDialog';
import {
  fetchTermsPage,
  createTerm,
  updateTerm,
  deleteTerm,
  downloadTermTemplate,
} from '@/api/termApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { usePaginatedSearch } from '@/hooks/usePaginatedSearch';
import type { Term, TermFormData } from '@/types/dictionary';

const PAGE_SIZE = 20;

/** TermTab 컴포넌트의 props. */
interface TermTabProps {
  /** 편집 가능 여부 (VIEWER일 때 false — 생성/수정/삭제/업로드 버튼 숨김) */
  canEdit?: boolean;
  /** 선택된 사전 세트 ID */
  setId: string;
}

/**
 * 용어 사전 탭 컴포넌트.
 *
 * 용어 목록 테이블과 생성/수정/삭제 기능을 제공한다.
 * 역할에 따라 CRUD/업로드 버튼을 조건부 렌더링한다.
 *
 * @param props.canEdit 편집 가능 여부
 * @returns 용어 사전 탭 JSX
 */
export default function TermTab({ canEdit = true, setId }: TermTabProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 폼 다이얼로그 열림 상태 */
  const [formOpen, setFormOpen] = useState(false);
  /** 수정 대상 용어 (null이면 생성 모드) */
  const [editTarget, setEditTarget] = useState<Term | null>(null);
  /** 삭제 확인 대상 용어 ID */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  /** 일괄 업로드 다이얼로그 열림 상태 */
  const [uploadOpen, setUploadOpen] = useState(false);

  const { searchInput, setSearchInput, searchKeyword, page, setPage, adjustToTotalPages } =
    usePaginatedSearch({ resetKey: `${teamId ?? ''}:${setId}` });

  const {
    data: termPageData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.dictionary.termsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    queryFn: () => fetchTermsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    enabled: !!teamId && !!setId,
    placeholderData: (previousData) => previousData,
  });
  const terms = termPageData?.content ?? [];
  const totalElements = termPageData?.totalElements ?? 0;
  const totalPages = termPageData?.totalPages ?? 0;
  const isLastPage = termPageData?.last ?? true;

  const createMutation = useMutation({
    mutationFn: (data: TermFormData) => createTerm(teamId!, setId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId!, setId) });
      toast.success(t('dictionary.term.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.term.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TermFormData }) =>
      updateTerm(teamId!, setId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId!, setId) });
      toast.success(t('dictionary.term.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.term.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (termId: number) => deleteTerm(teamId!, setId, termId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.terms(teamId!, setId) });
      setDeleteTarget(null);
      toast.success(t('dictionary.term.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.term.toast.deleteFailed'))),
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: () => downloadTermTemplate(teamId!, setId),
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.templateFailed'))),
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
   * @param term 수정 대상 용어
   * @returns 없음
   */
  const handleEdit = (term: Term) => {
    setEditTarget(term);
    setFormOpen(true);
  };

  /**
   * 폼 제출 핸들러 (생성/수정 분기).
   *
   * @param data 폼 데이터
   * @returns 없음
   */
  const handleSubmit = async (data: TermFormData) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  /**
   * 용어 업로드 템플릿 다운로드 핸들러.
   *
   * @returns 없음
   */
  const handleTemplateDownload = () => {
    downloadTemplateMutation.mutate();
  };

  // 서버 totalPages 기반 페이지 범위 보정
  useEffect(() => {
    if (!termPageData) return;
    adjustToTotalPages(termPageData.totalPages);
  }, [termPageData, adjustToTotalPages]);

  if (isLoading && !termPageData) {
    return <Spinner text={t('common.loading')} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('dictionary.search.termPlaceholder')}
            aria-label={t('dictionary.search.termPlaceholder')}
          />
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2">
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
              {t('dictionary.term.form.createTitle')}
            </Button>
          </div>
        )}
      </div>

      {totalElements === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('dictionary.term.table.empty')}</p>
            {canEdit && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('dictionary.term.form.createTitle')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed min-w-[1260px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] whitespace-nowrap">
                  {t('dictionary.term.table.logicalName')}
                </TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.term.table.physicalName')}
                </TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.term.table.domain')}
                </TableHead>
                <TableHead className="w-[520px] max-w-[520px]">
                  {t('dictionary.term.table.description')}
                </TableHead>
                {canEdit && (
                  <TableHead className="w-[100px]">{t('dictionary.term.table.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {term.logicalName}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{term.physicalName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {term.domainLogicalName ?? t('dictionary.term.table.noDomain')}
                  </TableCell>
                  <TableCell className="max-w-[520px] whitespace-normal break-words text-muted-foreground">
                    {term.description ?? ''}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(term)}
                          aria-label={t('dictionary.term.aria.editTerm', {
                            name: term.logicalName,
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteTarget(term.id)}
                          aria-label={t('dictionary.term.aria.deleteTerm', {
                            name: term.logicalName,
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

      <TermFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editTarget}
        setId={setId}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('dictionary.term.delete.dialogTitle')}
        description={t('dictionary.term.delete.dialogDescription')}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
        loading={deleteMutation.isPending}
      />

      <BulkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} mode="term" setId={setId} />
    </div>
  );
}
