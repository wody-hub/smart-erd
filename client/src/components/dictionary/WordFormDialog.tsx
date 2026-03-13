import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Word, WordFormData } from '@/types/dictionary';

interface WordFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WordFormData) => Promise<void>;
  initialData?: Word | null;
}

export default function WordFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: WordFormDialogProps) {
  const { t } = useTranslation();
  const [logicalName, setLogicalName] = useState('');
  const [physicalName, setPhysicalName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (open) {
      setLogicalName(initialData?.logicalName ?? '');
      setPhysicalName(initialData?.physicalName ?? '');
      setDescription(initialData?.description ?? '');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ logicalName, physicalName, description: description || undefined });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('dictionary.word.form.editTitle') : t('dictionary.word.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('dictionary.word.form.editDescription')
              : t('dictionary.word.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="word-logicalName">{t('dictionary.word.form.logicalName')}</Label>
            <Input
              id="word-logicalName"
              value={logicalName}
              onChange={(e) => setLogicalName(e.target.value)}
              placeholder={t('dictionary.word.form.logicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="word-physicalName">{t('dictionary.word.form.physicalName')}</Label>
            <Input
              id="word-physicalName"
              value={physicalName}
              onChange={(e) => setPhysicalName(e.target.value)}
              placeholder={t('dictionary.word.form.physicalNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="word-description">{t('dictionary.word.form.description')}</Label>
            <Input
              id="word-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dictionary.word.form.descriptionPlaceholder')}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.button.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !logicalName.trim() || !physicalName.trim()}
            >
              {submitting
                ? t('common.button.processing')
                : isEdit
                  ? t('common.button.save')
                  : t('common.button.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
