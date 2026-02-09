import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { fetchDiagrams, createDiagram, deleteDiagram, renameDiagram } from '@/api/diagramApi';
import type { DiagramSummary } from '@/types/diagram';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';

/**
 * 다이어그램 목록 페이지.
 *
 * 선택된 프로젝트의 다이어그램 목록, 생성, 삭제, 이름 변경 기능을 제공한다.
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /** 다이어그램 생성 다이얼로그 열림 상태 */
  const [dialogOpen, setDialogOpen] = useState(false);
  /** 삭제 확인 대상 다이어그램 ID (null이면 다이얼로그 닫힘) */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  /** 이름 변경 중인 다이어그램 ID (null이면 편집 모드 아님) */
  const [renamingId, setRenamingId] = useState<number | null>(null);
  /** 이름 변경 입력값 */
  const [renameValue, setRenameValue] = useState('');

  const diagramsQueryKey = queryKeys.diagrams.byProject(teamId!, projectId!);

  const { data: diagrams = [], isLoading } = useQuery({
    queryKey: diagramsQueryKey,
    queryFn: () => fetchDiagrams(teamId!, projectId!),
    enabled: !!teamId && !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createDiagram(teamId!, projectId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      toast.success('Diagram created');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create diagram')),
  });

  const deleteMutation = useMutation({
    mutationFn: (diagramId: number) => deleteDiagram(teamId!, projectId!, String(diagramId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      setDeleteTarget(null);
      toast.success('Diagram deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete diagram')),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      renameDiagram(teamId!, projectId!, String(id), name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: diagramsQueryKey });
      setRenamingId(null);
      toast.success('Diagram renamed');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to rename diagram')),
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
            Back to Projects
          </Button>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Diagrams</h2>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Diagram
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : diagrams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No diagrams yet. Create your first diagram.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Diagram
                </Button>
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
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelRename}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <CardTitle className="text-lg">{diagram.name}</CardTitle>
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => startRename(diagram, e)}
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
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Updated: {new Date(diagram.updatedAt).toLocaleDateString()}
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
        title="Create New Diagram"
        inputLabel="Diagram Name"
        placeholder="Enter diagram name"
        onCreate={(name) => createMutation.mutateAsync(name)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Diagram"
        description="Are you sure you want to delete this diagram?"
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
