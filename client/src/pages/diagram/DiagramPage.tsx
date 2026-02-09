import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ERDCanvas from '@/components/erd/ERDCanvas';
import useCanvasStore from '@/stores/useCanvasStore';
import { fetchDiagram, saveDiagram } from '@/api/diagramApi';
import { queryKeys } from '@/constants/query-keys';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import Spinner from '@/components/ui/spinner';

/**
 * 다이어그램 편집 페이지.
 *
 * URL 파라미터에서 teamId/projectId/diagramId를 추출하여
 * 다이어그램을 로드하고, 캔버스 편집 후 저장 기능을 제공한다.
 * Ctrl+S(Mac: Cmd+S) 단축키로 저장할 수 있다.
 */
export default function DiagramPage() {
  /** URL 파라미터: teamId, projectId, diagramId */
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();

  /** 헤더에 표시할 다이어그램 이름 */
  const [diagramName, setDiagramName] = useState('');

  const deserialize = useCanvasStore((s) => s.deserialize);
  const serialize = useCanvasStore((s) => s.serialize);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markClean = useCanvasStore((s) => s.markClean);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const {
    data: diagram,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.diagrams.detail(teamId!, projectId!, diagramId!),
    queryFn: () => fetchDiagram(teamId!, projectId!, diagramId!),
    enabled: !!teamId && !!projectId && !!diagramId,
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveDiagram(teamId!, projectId!, diagramId!, content),
    onSuccess: () => {
      markClean();
      toast.success('Diagram saved');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to save diagram')),
  });

  /** 다이어그램을 서버에 저장한다. 저장 중이면 중복 실행을 방지한다. */
  const handleSave = useCallback(() => {
    if (saveMutation.isPending) return;
    saveMutation.mutate(serialize());
  }, [saveMutation, serialize]);

  useEffect(() => {
    if (!diagram) return;
    setDiagramName(diagram.name);
    if (diagram.content) {
      deserialize(diagram.content);
    } else {
      setNodes([]);
      setEdges([]);
    }
    markClean();
  }, [diagram, deserialize, setNodes, setEdges, markClean]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  if (isError) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-destructive">Failed to load diagram. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Spinner text="Loading diagram..." />
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <Header
          diagramName={diagramName}
          onSave={handleSave}
          saving={saveMutation.isPending}
          isDirty={isDirty}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1">
            <ERDCanvas />
          </main>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
