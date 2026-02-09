import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, ArrowLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  fetchDiagrams,
  createDiagram,
  deleteDiagram,
  renameDiagram,
  type DiagramSummary,
} from '@/api/diagramApi';
import { toast } from 'sonner';

/**
 * 다이어그램 목록 페이지.
 *
 * 선택된 프로젝트의 다이어그램 목록, 생성, 삭제, 이름 변경 기능을 제공한다.
 */
export default function DiagramsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  /** 다이어그램 목록을 조회한다. */
  const loadDiagrams = useCallback(async () => {
    if (!teamId || !projectId) return;
    try {
      const data = await fetchDiagrams(teamId, projectId);
      setDiagrams(data);
    } catch {
      toast.error('Failed to load diagrams');
    } finally {
      setLoading(false);
    }
  }, [teamId, projectId]);

  useEffect(() => {
    loadDiagrams();
  }, [loadDiagrams]);

  /** 다이어그램 생성 핸들러. 생성 후 목록을 갱신한다. */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !teamId || !projectId) return;
    setCreating(true);

    try {
      await createDiagram(teamId, projectId, newName.trim());
      setNewName('');
      setDialogOpen(false);
      await loadDiagrams();
      toast.success('Diagram created');
    } catch {
      toast.error('Failed to create diagram');
    } finally {
      setCreating(false);
    }
  };

  /** 다이어그램 삭제 핸들러. 확인 후 삭제하고 목록을 갱신한다. */
  const handleDelete = async (diagramId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!teamId || !projectId) return;
    if (!confirm('Are you sure you want to delete this diagram?')) return;

    try {
      await deleteDiagram(teamId, projectId, String(diagramId));
      await loadDiagrams();
      toast.success('Diagram deleted');
    } catch {
      toast.error('Failed to delete diagram');
    }
  };

  /** 이름 변경 모드를 시작한다. */
  const startRename = (diagram: DiagramSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(diagram.id);
    setRenameValue(diagram.name);
  };

  /** 이름 변경을 확정한다. */
  const confirmRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!teamId || !projectId || renamingId === null || !renameValue.trim()) return;

    try {
      await renameDiagram(teamId, projectId, String(renamingId), renameValue.trim());
      setRenamingId(null);
      await loadDiagrams();
      toast.success('Diagram renamed');
    } catch {
      toast.error('Failed to rename diagram');
    }
  };

  /** 이름 변경을 취소한다. */
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
            onClick={() => navigate(`/teams/${teamId}/projects`)}
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

          {loading ? (
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
                  onClick={() =>
                    navigate(`/teams/${teamId}/projects/${projectId}/diagrams/${diagram.id}`)
                  }
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
                              onClick={(e) => handleDelete(diagram.id, e)}
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

      {/* Create Diagram Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Diagram</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="diagram-name">Diagram Name</Label>
                <Input
                  id="diagram-name"
                  placeholder="Enter diagram name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
