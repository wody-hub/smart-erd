import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
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
import { ROUTES } from '@/constants/routes';
import { queryKeys } from '@/constants/query-keys';
import { useTeamRole } from '@/hooks/useTeamRole';
import {
  createDictionarySet,
  deleteDictionarySet,
  fetchDictionarySets,
  setDefaultDictionarySet,
  updateDictionarySet,
} from '@/api/dictionarySetApi';
import { getErrorMessage } from '@/lib/api-error';
import type { DictionarySet } from '@/types/dictionary';

/**
 * 데이터 사전 페이지.
 *
 * 사전 세트를 선택한 뒤 도메인/용어 탭을 세트 스코프로 관리한다.
 */
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);

  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  /** 이름 변경 다이얼로그 열림 상태 */
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  /** 삭제 확인 다이얼로그 열림 상태 */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: dictionarySets = [], isLoading } = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId!),
    queryFn: () => fetchDictionarySets(teamId!),
    enabled: !!teamId,
  });

  useEffect(() => {
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
  }, [dictionarySets]);

  const createSetMutation = useMutation({
    mutationFn: (name: string) => createDictionarySet(teamId!, { name }),
    onSuccess: (createdSet) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId!) });
      setSelectedSetId(String(createdSet.id));
      toast.success(t('dictionary.set.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.createFailed'))),
  });

  const renameSetMutation = useMutation({
    mutationFn: ({ setId, name }: { setId: number; name: string }) =>
      updateDictionarySet(teamId!, setId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId!) });
      setRenameDialogOpen(false);
      toast.success(t('dictionary.set.toast.updated'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.updateFailed'))),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: number) => deleteDictionarySet(teamId!, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId!) });
      setDeleteDialogOpen(false);
      toast.success(t('dictionary.set.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('dictionary.set.toast.deleteFailed'))),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (setId: number) => setDefaultDictionarySet(teamId!, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dictionary.sets(teamId!) });
      toast.success(t('dictionary.set.toast.defaultUpdated'));
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, t('dictionary.set.toast.defaultUpdateFailed'))),
  });

  const selectedSet: DictionarySet | undefined = dictionarySets.find(
    (set) => String(set.id) === selectedSetId,
  );

  const handleSetDefault = () => {
    if (!selectedSet || selectedSet.isDefault) return;
    setDefaultMutation.mutate(selectedSet.id);
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('dictionary.backToProjects')}
          </Button>

          <h2 className="text-2xl font-bold mb-4">{t('dictionary.title')}</h2>

          {isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : (
            <>
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
                      disabled={
                        !selectedSet || selectedSet.isDefault || setDefaultMutation.isPending
                      }
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

              {selectedSetId ? (
                <Tabs defaultValue="words">
                  <TabsList>
                    <TabsTrigger value="words">{t('dictionary.tabs.words')}</TabsTrigger>
                    <TabsTrigger value="terms">{t('dictionary.tabs.terms')}</TabsTrigger>
                    <TabsTrigger value="domains">{t('dictionary.tabs.domains')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="words">
                    <WordTab canEdit={canEdit} setId={selectedSetId} />
                  </TabsContent>
                  <TabsContent value="terms">
                    <TermTab canEdit={canEdit} setId={selectedSetId} />
                  </TabsContent>
                  <TabsContent value="domains">
                    <DomainTab canEdit={canEdit} setId={selectedSetId} />
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-sm text-muted-foreground">{t('dictionary.set.empty')}</p>
              )}
            </>
          )}
        </div>
      </main>

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
          if (selectedSet) deleteSetMutation.mutate(selectedSet.id);
        }}
        loading={deleteSetMutation.isPending}
      />
    </div>
  );
}
