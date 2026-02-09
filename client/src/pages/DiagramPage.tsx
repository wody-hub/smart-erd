import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import ERDCanvas from '@/components/erd/ERDCanvas';
import useCanvasStore from '@/stores/useCanvasStore';
import { fetchDiagram, saveDiagram } from '@/api/diagramApi';

/**
 * 다이어그램 편집 페이지.
 *
 * URL 파라미터에서 teamId/projectId/diagramId를 추출하여
 * 다이어그램을 로드하고, 캔버스 편집 후 저장 기능을 제공한다.
 * Ctrl+S(Mac: Cmd+S) 단축키로 저장할 수 있다.
 */
export default function DiagramPage() {
  const { teamId, projectId, diagramId } = useParams<{
    teamId: string;
    projectId: string;
    diagramId: string;
  }>();

  const [diagramName, setDiagramName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const deserialize = useCanvasStore((s) => s.deserialize);
  const serialize = useCanvasStore((s) => s.serialize);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const markClean = useCanvasStore((s) => s.markClean);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  /** 다이어그램을 API에서 로드하고 캔버스에 복원한다. */
  useEffect(() => {
    if (!teamId || !projectId || !diagramId) return;

    const load = async () => {
      try {
        const data = await fetchDiagram(teamId, projectId, diagramId);
        setDiagramName(data.name);
        if (data.content) {
          deserialize(data.content);
        } else {
          setNodes([]);
          setEdges([]);
        }
        markClean();
        setLoaded(true);
      } catch {
        console.error('Failed to load diagram');
      }
    };

    load();
  }, [teamId, projectId, diagramId, deserialize, setNodes, setEdges, markClean]);

  /** 다이어그램을 API에 저장한다. */
  const handleSave = useCallback(async () => {
    if (!teamId || !projectId || !diagramId || saving) return;
    setSaving(true);

    try {
      const content = serialize();
      await saveDiagram(teamId, projectId, diagramId, content);
      markClean();
    } catch {
      console.error('Failed to save diagram');
    } finally {
      setSaving(false);
    }
  }, [teamId, projectId, diagramId, saving, serialize, markClean]);

  /** Ctrl+S / Cmd+S 단축키로 저장한다. */
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

  if (!loaded) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <Header diagramName={diagramName} onSave={handleSave} saving={saving} isDirty={isDirty} />
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
