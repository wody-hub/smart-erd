import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiagramSummary } from '@/types/diagram';
import type { TodoDocumentVisibility } from '@/types/project-todo';

interface ProjectTodoDocumentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DiagramSummary[];
  loading: boolean;
  onConfirm: (documentId: number, visibility: TodoDocumentVisibility) => Promise<void> | void;
}

/**
 * TODO 문서 연결 대화상자.
 *
 * @param props dialog props
 * @returns dialog JSX
 */
export default function ProjectTodoDocumentLinkDialog({
  open,
  onOpenChange,
  documents,
  loading,
  onConfirm,
}: ProjectTodoDocumentLinkDialogProps) {
  const { t } = useTranslation();
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [visibility, setVisibility] = useState<TodoDocumentVisibility>('PRIVATE');

  const selectedDocument = useMemo(
    () => documents.find((document) => String(document.id) === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const handleConfirm = async () => {
    if (!selectedDocumentId) {
      return;
    }
    await onConfirm(Number(selectedDocumentId), visibility);
    setSelectedDocumentId('');
    setVisibility('PRIVATE');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedDocumentId('');
          setVisibility('PRIVATE');
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('myTasks.documents.linkDialog.title')}</DialogTitle>
          <DialogDescription>{t('myTasks.documents.linkDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            value={selectedDocumentId}
            onValueChange={setSelectedDocumentId}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('myTasks.documents.linkDialog.documentPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {documents.map((document) => (
                <SelectItem
                  key={document.id}
                  value={String(document.id)}
                  secondaryText={document.summaryText ?? undefined}
                >
                  {document.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={visibility}
            onValueChange={(nextValue) => setVisibility(nextValue as TodoDocumentVisibility)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('myTasks.documents.visibilityLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRIVATE">{t('myTasks.documents.visibility.private')}</SelectItem>
              <SelectItem value="PROJECT_SHARED">
                {t('myTasks.documents.visibility.projectShared')}
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedDocument ? (
            <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              {selectedDocument.summaryText ?? t('myTasks.documents.linkDialog.noSummary')}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.button.cancel')}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!selectedDocumentId || loading}>
            {loading ? t('common.button.processing') : t('myTasks.documents.linkDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
