import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Word } from '@/types/dictionary';

interface WordComposerProps {
  words: Word[];
  selectedWordIds: string[];
  wordToAdd: string;
  onWordToAddChange: (value: string) => void;
  onAddWord: (wordId: string) => void;
  onRemoveWord: (wordId: string) => void;
  onClear: () => void;
  title: string;
  description: string;
  placeholder: string;
  addLabel: string;
  clearLabel: string;
  sequenceLabel: string;
  logicalPreviewLabel: string;
  physicalPreviewLabel: string;
  removeWordLabel: (logicalName: string) => string;
}

export default function WordComposer({
  words,
  selectedWordIds,
  wordToAdd,
  onWordToAddChange,
  onAddWord,
  onRemoveWord,
  onClear,
  title,
  description,
  placeholder,
  addLabel,
  clearLabel,
  sequenceLabel,
  logicalPreviewLabel,
  physicalPreviewLabel,
  removeWordLabel,
}: WordComposerProps) {
  const selectedWords = selectedWordIds
    .map((wordId) => words.find((word) => String(word.id) === wordId))
    .filter((word): word is Word => !!word);
  const availableWords = words.filter((word) => !selectedWordIds.includes(String(word.id)));
  const logicalPreview = selectedWords.map((word) => word.logicalName).join(' ');
  const physicalPreview = selectedWords.map((word) => word.physicalName).join('_');

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/40 p-3">
      <div className="space-y-1">
        <Label htmlFor="word-composer-select">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Select value={wordToAdd} onValueChange={onWordToAddChange}>
          <SelectTrigger id="word-composer-select" className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {availableWords.map((word) => (
              <SelectItem key={word.id} value={String(word.id)}>
                {word.logicalName} ({word.physicalName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAddWord(wordToAdd)}
          disabled={!wordToAdd}
        >
          {addLabel}
        </Button>
      </div>
      {selectedWords.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{sequenceLabel}</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
              {clearLabel}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedWords.map((word, index) => (
              <div
                key={word.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                <span className="text-muted-foreground">{index + 1}</span>
                <span>{word.logicalName}</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-mono text-[11px]">{word.physicalName}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onRemoveWord(String(word.id))}
                  aria-label={removeWordLabel(word.logicalName)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid gap-2 rounded-md border border-dashed border-border bg-background/70 p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="min-w-20 text-muted-foreground">{logicalPreviewLabel}</span>
              <span>{logicalPreview}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="min-w-20 text-muted-foreground">{physicalPreviewLabel}</span>
              <span className="font-mono">{physicalPreview}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
