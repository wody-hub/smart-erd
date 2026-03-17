import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { queryKeys } from '@/constants/query-keys';
import {
  createDictionarySet,
  deleteDictionarySet,
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

  const { data: dictionarySets = [], isLoading } = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId),
    queryFn: () => fetchDictionarySets(teamId),
    enabled: !!teamId,
  });

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
      setRenameDialogOpen(false);
      toast.success(t('dictionary.set.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.updateFailed'))),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: number) => deleteDictionarySet(teamId, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId) });
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

  return (
    <div className={cn(isFixedDialogMode && 'flex min-h-0 flex-1 flex-col')}>
      {fixedSetId ? (
        <div className="mb-4 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {t('diagram.edit.dictionaryContext', { name: fixedSetLabel ?? selectedSet?.name ?? '-' })}
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Select value={selectedSetId} onValueChange={setSelectedSetId}>
            <SelectTrigger className="w-[280px]">
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

          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('dictionary.set.newButton')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRenameDialogOpen(true)}
                disabled={!selectedSet || renameSetMutation.isPending}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {t('dictionary.set.renameButton')}
              </Button>
              <Button
                variant="outline"
                onClick={handleSetDefault}
                disabled={!selectedSet || selectedSet.isDefault || setDefaultMutation.isPending}
              >
                <Star className="h-4 w-4 mr-1" />
                {t('dictionary.set.setDefaultButton')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!selectedSet || deleteSetMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('dictionary.set.deleteButton')}
              </Button>
            </>
          )}
        </div>
      )}

      {selectedSetId ? (
        <Tabs
          defaultValue="words"
          className={cn(isFixedDialogMode && 'flex min-h-0 flex-1 flex-col')}
        >
          <TabsList>
            <TabsTrigger value="words">{t('dictionary.tabs.words')}</TabsTrigger>
            <TabsTrigger value="terms">{t('dictionary.tabs.terms')}</TabsTrigger>
            <TabsTrigger value="domains">{t('dictionary.tabs.domains')}</TabsTrigger>
          </TabsList>
          <TabsContent value="words" className={cn(isFixedDialogMode && 'mt-4')}>
            <WordTab canEdit={canEdit} setId={selectedSetId} />
          </TabsContent>
          <TabsContent value="terms" className={cn(isFixedDialogMode && 'mt-4')}>
            <TermTab canEdit={canEdit} setId={selectedSetId} />
          </TabsContent>
          <TabsContent value="domains" className={cn(isFixedDialogMode && 'mt-4')}>
            <DomainTab canEdit={canEdit} setId={selectedSetId} />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground">{t('dictionary.set.empty')}</p>
      )}

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
