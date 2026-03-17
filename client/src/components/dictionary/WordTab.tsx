import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookText, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import Spinner from '@/components/ui/spinner';
import BulkUploadDialog from '@/components/dictionary/BulkUploadDialog';
import WordFormDialog from '@/components/dictionary/WordFormDialog';
import {
  createWord,
  deleteWord,
  downloadWordTemplate,
  fetchWordsPage,
  updateWord,
} from '@/api/wordApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { rankDictionarySearchResults } from '@/lib/dictionary-search-ranking';
import { usePaginatedSearch } from '@/hooks/usePaginatedSearch';
import type { Word, WordFormData } from '@/types/dictionary';

const PAGE_SIZE = 20;

interface WordTabProps {
  canEdit?: boolean;
  setId: string;
}

export default function WordTab({ canEdit = true, setId }: WordTabProps) {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Word | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { searchInput, setSearchInput, searchKeyword, page, setPage, adjustToTotalPages } =
    usePaginatedSearch({ resetKey: `${teamId ?? ''}:${setId}:words` });

  const {
    data: wordPageData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.dictionary.wordsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    queryFn: () => fetchWordsPage(teamId!, setId, page, PAGE_SIZE, searchKeyword),
    enabled: !!teamId && !!setId,
    placeholderData: (previousData) => previousData,
  });

  const words = useMemo(
    () =>
      rankDictionarySearchResults(wordPageData?.content ?? [], searchKeyword, (word) => [
        word.physicalName,
        word.description,
      ]),
    [searchKeyword, wordPageData?.content],
  );
  const totalElements = wordPageData?.totalElements ?? 0;
  const totalPages = wordPageData?.totalPages ?? 0;
  const isLastPage = wordPageData?.last ?? true;

  const createMutation = useMutation({
    mutationFn: (data: WordFormData) => createWord(teamId!, setId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.words(teamId!, setId) });
      toast.success(t('dictionary.word.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.word.toast.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WordFormData }) =>
      updateWord(teamId!, setId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.words(teamId!, setId) });
      toast.success(t('dictionary.word.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.word.toast.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (wordId: number) => deleteWord(teamId!, setId, wordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.words(teamId!, setId) });
      setDeleteTarget(null);
      toast.success(t('dictionary.word.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.word.toast.deleteFailed'))),
  });

  const downloadTemplateMutation = useMutation({
    mutationFn: () => downloadWordTemplate(teamId!, setId),
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.upload.toast.templateFailed'))),
  });

  useEffect(() => {
    if (!wordPageData) return;
    adjustToTotalPages(wordPageData.totalPages);
  }, [wordPageData, adjustToTotalPages]);

  const handleSubmit = async (data: WordFormData) => {
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (isLoading && !wordPageData) {
    return <Spinner text={t('common.loading')} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('dictionary.search.wordPlaceholder')}
            aria-label={t('dictionary.search.wordPlaceholder')}
          />
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => downloadTemplateMutation.mutate()}
              disabled={downloadTemplateMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('dictionary.upload.template')}
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t('dictionary.upload.button')}
            </Button>
            <Button
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('dictionary.word.form.createTitle')}
            </Button>
          </div>
        )}
      </div>

      {totalElements === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">{t('dictionary.word.table.empty')}</p>
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplateMutation.mutate()}
                  disabled={downloadTemplateMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('dictionary.upload.template')}
                </Button>
                <Button variant="outline" onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('dictionary.upload.button')}
                </Button>
                <Button
                  onClick={() => {
                    setEditTarget(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dictionary.word.form.createTitle')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[1060px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.word.table.logicalName')}
                </TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">
                  {t('dictionary.word.table.physicalName')}
                </TableHead>
                <TableHead className="w-[520px] max-w-[520px]">
                  {t('dictionary.word.table.description')}
                </TableHead>
                {canEdit && (
                  <TableHead className="w-[100px]">{t('dictionary.word.table.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {words.map((word) => (
                <TableRow key={word.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {word.logicalName}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{word.physicalName}</TableCell>
                  <TableCell className="max-w-[520px] whitespace-normal break-words text-muted-foreground">
                    {word.description ?? ''}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditTarget(word);
                            setFormOpen(true);
                          }}
                          aria-label={t('dictionary.word.aria.editWord', {
                            name: word.logicalName,
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteTarget(word.id)}
                          aria-label={t('dictionary.word.aria.deleteWord', {
                            name: word.logicalName,
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

      <WordFormDialog
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
        title={t('dictionary.word.delete.dialogTitle')}
        description={t('dictionary.word.delete.dialogDescription')}
        onConfirm={() => {
          if (deleteTarget !== null) {
            deleteMutation.mutate(deleteTarget);
          }
        }}
        loading={deleteMutation.isPending}
      />

      <BulkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} mode="word" setId={setId} />
    </div>
  );
}
