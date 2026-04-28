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

interface WbsDocumentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DiagramSummary[];
  loading: boolean;
  onConfirm: (documentId: number) => Promise<void> | void;
}

/**
 * WBS 문서 연결 대화상자.
 *
 * @param props dialog props
 * @returns dialog JSX
 */
export default function WbsDocumentLinkDialog({
  open,
  onOpenChange,
  documents,
  loading,
  onConfirm,
}: WbsDocumentLinkDialogProps) {
  const { t } = useTranslation();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');

  const selectedDocument = useMemo(
    () => documents.find((document) => String(document.id) === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const handleConfirm = async () => {
    if (!selectedDocumentId) {
      return;
    }
    await onConfirm(Number(selectedDocumentId));
    setSelectedDocumentId('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedDocumentId('');
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('wbs.details.linkDialog.title')}</DialogTitle>
          <DialogDescription>{t('wbs.details.linkDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select
            value={selectedDocumentId}
            onValueChange={setSelectedDocumentId}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('wbs.details.linkDialog.placeholder')} />
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

          {selectedDocument ? (
            <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
              {selectedDocument.summaryText ?? t('wbs.details.linkDialog.noSummary')}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.button.cancel')}
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!selectedDocumentId || loading}>
            {loading ? t('common.button.processing') : t('wbs.details.linkDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
