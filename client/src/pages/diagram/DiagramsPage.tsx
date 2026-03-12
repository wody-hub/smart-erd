import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  fetchDiagrams,
  createDiagram,
  deleteDiagram,
  renameDiagram,
  updateDiagramDictionaryContext,
} from '@/api/diagramApi';
import { fetchDictionarySets } from '@/api/dictionarySetApi';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiagramSummary } from '@/types/diagram';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import { useTeamRole } from '@/hooks/useTeamRole';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';

/**
 * 다이어그램 목록 페이지.
 *
 * 선택된 프로젝트의 다이어그램 목록, 생성, 삭제, 이름 변경 기능을 제공한다.
 * 역할에 따라 생성/삭제/이름 변경 버튼을 조건부 렌더링한다.
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  /** 다이어그램 생성 다이얼로그 열림 상태 */
  const [dialogOpen, setDialogOpen] = useState(false);
  /** 삭제 확인 대상 다이어그램 ID (null이면 다이얼로그 닫힘) */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  /** 이름 변경 중인 다이어그램 ID (null이면 편집 모드 아님) */
  const [renamingId, setRenamingId] = useState<number | null>(null);
  /** 이름 변경 입력값 */
  const [renameValue, setRenameValue] = useState('');
  /** 생성 시 사용할 다이어그램 사전 컨텍스트 ID */
  const [createDictionaryContextId, setCreateDictionaryContextId] = useState('');

  const { canEdit } = useTeamRole(teamId);

  const diagramsQueryKey = queryKeys.diagrams.byProject(teamId!, projectId!);

  const { data: dictionarySets = [] } = useQuery({
    queryKey: queryKeys.dictionary.sets(teamId!),
    queryFn: () => fetchDictionarySets(teamId!),
    enabled: !!teamId,
  });

  useEffect(() => {
    if (dictionarySets.length === 0) {
      setCreateDictionaryContextId('');
      return;
    }
    const defaultSet = dictionarySets.find((set) => set.isDefault);
    setCreateDictionaryContextId((prev) => {
      if (prev && dictionarySets.some((set) => String(set.id) === prev)) {
        return prev;
      }
      return String(defaultSet?.id ?? dictionarySets[0]!.id);
    });
  }, [dictionarySets]);

  const { data: diagrams = [], isLoading } = useQuery({
    queryKey: diagramsQueryKey,
    queryFn: () => fetchDiagrams(teamId!, projectId!),
    enabled: !!teamId && !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createDiagram(teamId!, projectId!, name, Number(createDictionaryContextId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      toast.success(t('diagram.toast.created'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.createFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (diagramId: number) => deleteDiagram(teamId!, projectId!, String(diagramId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      setDeleteTarget(null);
      toast.success(t('diagram.toast.deleted'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.deleteFailed'))),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      renameDiagram(teamId!, projectId!, String(id), name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      setRenamingId(null);
      toast.success(t('diagram.toast.renamed'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('diagram.toast.renameFailed'))),
  });

  const updateDiagramSetMutation = useMutation({
    mutationFn: ({ diagramId, dictionarySetId }: { diagramId: number; dictionarySetId: number }) =>
      updateDiagramDictionaryContext(teamId!, projectId!, String(diagramId), dictionarySetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      toast.success(t('diagram.toast.dictionaryContextUpdated'));
    },
    onError: (err) =>
      toast.error(getErrorMessage(err, t('diagram.toast.dictionaryContextUpdateFailed'))),
  });

  /** 다이어그램 이름 변경을 시작한다. @param diagram 대상 다이어그램 @param e 마우스 이벤트 (전파 차단용) */
  const startRename = (diagram: DiagramSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(diagram.id);
    setRenameValue(diagram.name);
  };

  /** 다이어그램 이름 변경을 확정한다. @param e 마우스 이벤트 (전파 차단용) */
  const confirmRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (renamingId === null || !renameValue.trim()) return;
    renameMutation.mutate({ id: renamingId, name: renameValue.trim() });
  };

  /** 다이어그램 이름 변경을 취소한다. @param e 마우스 이벤트 (전파 차단용) */
  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(null);
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate(ROUTES.PROJECTS(teamId!))}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('diagram.list.backToProjects')}
          </Button>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{t('diagram.list.title')}</h2>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Select value={createDictionaryContextId} onValueChange={setCreateDictionaryContextId}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t('diagram.list.selectDictionaryContext')} />
                  </SelectTrigger>
                  <SelectContent>
                    {dictionarySets.map((set) => (
                      <SelectItem key={set.id} value={String(set.id)}>
                        {set.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setDialogOpen(true)} disabled={!createDictionaryContextId}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('diagram.list.newButton')}
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <Spinner text={t('common.loading')} />
          ) : diagrams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t('diagram.list.empty')}</p>
                {canEdit && (
                  <Button onClick={() => setDialogOpen(true)} disabled={!createDictionaryContextId}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('diagram.list.createButton')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {diagrams.map((diagram) => (
                <Card
                  key={diagram.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => navigate(ROUTES.DIAGRAM(teamId!, projectId!, diagram.id))}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      {renamingId === diagram.id ? (
                        <div
                          className="flex items-center gap-1 flex-1 mr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            aria-label={t('diagram.aria.renameDiagram', { name: diagram.name })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                confirmRename(e as unknown as React.MouseEvent);
                              if (e.key === 'Escape')
                                cancelRename(e as unknown as React.MouseEvent);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={confirmRename}
                            aria-label={t('common.aria.confirmRename')}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelRename}
                            aria-label={t('common.aria.cancelRename')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <CardTitle className="text-lg">{diagram.name}</CardTitle>
                          {canEdit && (
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => startRename(diagram, e)}
                                aria-label={t('diagram.aria.renameDiagram', {
                                  name: diagram.name,
                                })}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(diagram.id);
                                }}
                                aria-label={t('diagram.aria.deleteDiagram', {
                                  name: diagram.name,
                                })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {canEdit && dictionarySets.length > 0 && (
                      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={
                            diagram.dictionarySetId != null ? String(diagram.dictionarySetId) : ''
                          }
                          onValueChange={(value) =>
                            updateDiagramSetMutation.mutate({
                              diagramId: diagram.id,
                              dictionarySetId: Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder={t('diagram.list.selectDictionaryContext')} />
                          </SelectTrigger>
                          <SelectContent>
                            {dictionarySets.map((set) => (
                              <SelectItem key={set.id} value={String(set.id)}>
                                {set.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('diagram.list.updatedAt', {
                        date: new Date(diagram.updatedAt).toLocaleDateString(
                          i18n.resolvedLanguage ?? i18n.language,
                        ),
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t('diagram.create.dialogTitle')}
        inputLabel={t('diagram.create.inputLabel')}
        placeholder={t('diagram.create.placeholder')}
        onCreate={(name) => createMutation.mutateAsync(name)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('diagram.delete.dialogTitle')}
        description={t('diagram.delete.dialogDescription')}
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
