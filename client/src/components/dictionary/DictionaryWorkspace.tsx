import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus, Pencil, Trash2, Star, Download, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DomainTab from '@/components/dictionary/DomainTab';
import TermTab from '@/components/dictionary/TermTab';
import WordTab from '@/components/dictionary/WordTab';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import TextInputDialog from '@/components/ui/text-input-dialog';
import Spinner from '@/components/ui/spinner';
import WorkspaceEmptyState from '@/components/workspace/WorkspaceEmptyState';
import { queryKeys } from '@/constants/query-keys';
import {
  createDictionarySet,
  deleteDictionarySet,
  downloadAllDictionary,
  fetchDictionarySets,
  setDefaultDictionarySet,
  updateDictionarySet,
} from '@/api/dictionarySetApi';
import { getErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import type { DictionarySet } from '@/types/dictionary';

/** DictionaryWorkspace 컴포넌트 props */
export interface DictionaryWorkspaceProps {
  /** 팀 ID */
  teamId: string;
  /** 편집 권한 여부 */
  canEdit: boolean;
  /** 고정 사전 세트 ID (다이얼로그 모드에서 사전 세트 고정 시) */
  fixedSetId?: string;
  /** 고정 사전 세트 표시 라벨 */
  fixedSetLabel?: string | null;
}

/**
 * 데이터 사전 본문 워크스페이스.
 *
 * 페이지와 다이얼로그가 동일한 단어/용어/도메인 관리 UI를 재사용할 수 있도록
 * 사전 세트 조회와 탭 본문을 묶어 제공한다.
 */
export default function DictionaryWorkspace({
  teamId,
  canEdit,
  fixedSetId,
  fixedSetLabel,
}: DictionaryWorkspaceProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  /** 현재 선택된 사전 세트 ID */
  const [selectedSetId, setSelectedSetId] = useState<string>(fixedSetId ?? '');
  /** 사전 세트 생성 다이얼로그 열림 여부 */
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  /** 사전 세트 이름 변경 다이얼로그 열림 여부 */
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  /** 사전 세트 삭제 확인 다이얼로그 열림 여부 */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const dictionarySetsQuery = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId),
    queryFn: () => fetchDictionarySets(teamId),
    enabled: !!teamId,
  });
  const { data: dictionarySets = [], isLoading, isError } = dictionarySetsQuery;

  useEffect(() => {
    if (fixedSetId) {
      setSelectedSetId(fixedSetId);
      return;
    }

    if (dictionarySets.length === 0) {
      setSelectedSetId('');
      return;
    }

    setSelectedSetId((prev) => {
      if (prev && dictionarySets.some((set) => String(set.id) === prev)) {
        return prev;
      }
      const defaultSet = dictionarySets.find((set) => set.isDefault);
      return String(defaultSet?.id ?? dictionarySets[0]!.id);
    });
  }, [dictionarySets, fixedSetId]);

  const invalidateDocumentQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.byTeam(teamId) });
  };

  const createSetMutation = useMutation({
    mutationFn: (name: string) => createDictionarySet(teamId, { name }),
    onSuccess: (createdSet) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId) });
      setSelectedSetId(String(createdSet.id));
      toast.success(t('dictionary.set.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.createFailed'))),
  });

  const renameSetMutation = useMutation({
    mutationFn: ({ setId, name }: { setId: number; name: string }) =>
      updateDictionarySet(teamId, setId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId) });
      invalidateDocumentQueries();
      setRenameDialogOpen(false);
      toast.success(t('dictionary.set.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.updateFailed'))),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: number) => deleteDictionarySet(teamId, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId) });
      invalidateDocumentQueries();
      setDeleteDialogOpen(false);
      toast.success(t('dictionary.set.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.deleteFailed'))),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (setId: number) => setDefaultDictionarySet(teamId, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId) });
      toast.success(t('dictionary.set.toast.defaultUpdated'));
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.set.toast.defaultUpdateFailed'))),
  });

  /** 전체 사전 일괄 엑셀 다운로드 뮤테이션 */
  const downloadAllMutation = useMutation({
    mutationFn: () => downloadAllDictionary(teamId, selectedSetId),
    onSuccess: () => toast.success(t('dictionary.export.allDownloaded')),
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.export.allFailed'))),
  });

  const selectedSet: DictionarySet | undefined = dictionarySets.find(
    (set) => String(set.id) === selectedSetId,
  );
  const isFixedDialogMode = !!fixedSetId;

  const handleSetDefault = () => {
    if (!selectedSet || selectedSet.isDefault) {
      return;
    }
    setDefaultMutation.mutate(selectedSet.id);
  };

  if (isLoading) {
    return <Spinner text={t('common.loading')} />;
  }

  if (isError) {
    return (
      <WorkspaceEmptyState
        icon={<AlertTriangle className="h-10 w-10" />}
        title={t('workspace.status.loadFailedTitle')}
        description={t('workspace.status.dictionaryLoadFailed')}
        tone="error"
        role="alert"
        action={
          <Button variant="outline" onClick={() => void dictionarySetsQuery.refetch()}>
            {t('workspace.status.retry')}
          </Button>
        }
      />
    );
  }

  const dictionaryTabs = selectedSetId ? (
    <Tabs
      defaultValue="words"
      className={cn('flex flex-col', isFixedDialogMode && 'min-h-0 flex-1')}
    >
      <TabsList className="mx-6 mt-6 w-fit">
        <TabsTrigger value="words">{t('dictionary.tabs.words')}</TabsTrigger>
        <TabsTrigger value="terms">{t('dictionary.tabs.terms')}</TabsTrigger>
        <TabsTrigger value="domains">{t('dictionary.tabs.domains')}</TabsTrigger>
      </TabsList>
      <div className="px-6 pb-6">
        <TabsContent value="words" className={cn('mt-4', isFixedDialogMode && 'min-h-0')}>
          <WordTab canEdit={canEdit} setId={selectedSetId} />
        </TabsContent>
        <TabsContent value="terms" className={cn('mt-4', isFixedDialogMode && 'min-h-0')}>
          <TermTab canEdit={canEdit} setId={selectedSetId} />
        </TabsContent>
        <TabsContent value="domains" className={cn('mt-4', isFixedDialogMode && 'min-h-0')}>
          <DomainTab canEdit={canEdit} setId={selectedSetId} />
        </TabsContent>
      </div>
    </Tabs>
  ) : (
    <div className="p-6">
      <WorkspaceEmptyState
        icon={<BookOpen className="h-10 w-10" />}
        title={t('workspace.dictionary.emptySetTitle')}
        description={t('dictionary.set.empty')}
        action={
          canEdit ? (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dictionary.set.newButton')}
            </Button>
          ) : undefined
        }
      />
    </div>
  );

  return (
    <div className={cn(isFixedDialogMode && 'flex min-h-0 flex-1 flex-col')}>
      {fixedSetId ? (
        <div className="surface-operational mb-4 rounded-xl px-4 py-3 text-sm text-ink-secondary">
          {t('diagram.edit.dictionaryContext', { name: fixedSetLabel ?? selectedSet?.name ?? '-' })}
        </div>
      ) : (
        <Card className="surface-operational mb-6 overflow-hidden border-brand-secondary/15 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">
                  {t('workspace.section.dictionary')}
                </p>
                <CardTitle className="mt-3 text-[1.3rem] font-semibold tracking-[-0.02em]">
                  {t('workspace.dictionary.setManagementTitle')}
                </CardTitle>
                <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
                  {t('workspace.dictionary.setManagementDescription')}
                </CardDescription>
              </div>
              <div className="w-full xl:max-w-sm">
                <div className="workspace-labeled-control min-w-0 bg-background/72 p-3.5">
                  <span className="workspace-control-label">{t('dictionary.set.placeholder')}</span>
                  <Select value={selectedSetId} onValueChange={setSelectedSetId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('dictionary.set.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {dictionarySets.map((set) => (
                        <SelectItem key={set.id} value={String(set.id)}>
                          {set.name}
                          {set.isDefault ? ` (${t('dictionary.set.defaultBadge')})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="border-t border-border/65 bg-brand-secondary/5 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4 text-primary" />
                    {t('dictionary.set.newButton')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRenameDialogOpen(true)}
                    disabled={!selectedSet || renameSetMutation.isPending}
                  >
                    <Pencil className="mr-1 h-4 w-4 text-brand-secondary" />
                    {t('dictionary.set.renameButton')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSetDefault}
                    disabled={!selectedSet || selectedSet.isDefault || setDefaultMutation.isPending}
                  >
                    <Star className="mr-1 h-4 w-4 text-brand-warm" />
                    {t('dictionary.set.setDefaultButton')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!selectedSet || deleteSetMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                    {t('dictionary.set.deleteButton')}
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                onClick={() => downloadAllMutation.mutate()}
                disabled={downloadAllMutation.isPending || !selectedSetId}
              >
                <Download className="mr-1 h-4 w-4 text-primary" />
                {downloadAllMutation.isPending
                  ? t('dictionary.export.allExporting')
                  : t('dictionary.export.allButton')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card
        className={cn(
          'surface-operational overflow-hidden border-border/85',
          isFixedDialogMode && 'flex min-h-0 flex-1 flex-col',
        )}
      >
        {dictionaryTabs}
      </Card>

      {!fixedSetId && (
        <>
          <CreateResourceDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            title={t('dictionary.set.createTitle')}
            inputLabel={t('dictionary.set.inputLabel')}
            placeholder={t('dictionary.set.placeholder')}
            onCreate={(name) => createSetMutation.mutateAsync(name)}
          />

          <TextInputDialog
            open={renameDialogOpen}
            onOpenChange={setRenameDialogOpen}
            title={t('dictionary.set.renameButton')}
            description={t('dictionary.set.prompt.rename')}
            inputLabel={t('dictionary.set.inputLabel')}
            defaultValue={selectedSet?.name ?? ''}
            confirmLabel={t('dictionary.set.renameButton')}
            onConfirm={(name) => {
              if (selectedSet && name !== selectedSet.name) {
                renameSetMutation.mutate({ setId: selectedSet.id, name });
              }
            }}
            loading={renameSetMutation.isPending}
          />

          <ConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title={t('dictionary.set.deleteButton')}
            description={t('dictionary.set.prompt.delete', { name: selectedSet?.name })}
            onConfirm={() => {
              if (selectedSet) {
                deleteSetMutation.mutate(selectedSet.id);
              }
            }}
            loading={deleteSetMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
