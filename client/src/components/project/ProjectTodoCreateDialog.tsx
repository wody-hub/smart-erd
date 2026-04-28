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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectTodoPriority, ProjectTodoStatus } from '@/types/project-todo';
import type { WbsItem } from '@/types/wbs';
import type { TodoEditorValues } from './project-todo-editor';

interface ProjectTodoCreateDialogProps {
  open: boolean;
  createValues: TodoEditorValues;
  createPending: boolean;
  allWbsItems: WbsItem[];
  onOpenChange: (open: boolean) => void;
  onChange: (updater: (current: TodoEditorValues) => TodoEditorValues) => void;
  onCreate: () => void;
}

export default function ProjectTodoCreateDialog({
  open,
  createValues,
  createPending,
  allWbsItems,
  onOpenChange,
  onChange,
  onCreate,
}: ProjectTodoCreateDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('myTasks.create.title')}</DialogTitle>
          <DialogDescription>{t('myTasks.create.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="create-todo-title">{t('myTasks.field.title')}</Label>
            <Input
              id="create-todo-title"
              value={createValues.title}
              onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-todo-description">{t('myTasks.field.description')}</Label>
            <Textarea
              id="create-todo-description"
              rows={4}
              value={createValues.description}
              onChange={(event) =>
                onChange((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('myTasks.field.status')}</Label>
              <Select
                value={createValues.status}
                onValueChange={(value) =>
                  onChange((current) => ({ ...current, status: value as ProjectTodoStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">{t('myTasks.statusValue.TODO')}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{t('myTasks.statusValue.IN_PROGRESS')}</SelectItem>
                  <SelectItem value="DONE">{t('myTasks.statusValue.DONE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('myTasks.field.priority')}</Label>
              <Select
                value={createValues.priority}
                onValueChange={(value) =>
                  onChange((current) => ({ ...current, priority: value as ProjectTodoPriority }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{t('myTasks.priorityValue.LOW')}</SelectItem>
                  <SelectItem value="MEDIUM">{t('myTasks.priorityValue.MEDIUM')}</SelectItem>
                  <SelectItem value="HIGH">{t('myTasks.priorityValue.HIGH')}</SelectItem>
                  <SelectItem value="CRITICAL">{t('myTasks.priorityValue.CRITICAL')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-todo-date">{t('myTasks.field.targetDate')}</Label>
              <Input
                id="create-todo-date"
                type="date"
                value={createValues.targetDate}
                onChange={(event) => onChange((current) => ({ ...current, targetDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-todo-progress">{t('myTasks.field.progressRate')}</Label>
              <Input
                id="create-todo-progress"
                type="number"
                min={0}
                max={100}
                value={createValues.progressRate}
                onChange={(event) =>
                  onChange((current) => ({ ...current, progressRate: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('myTasks.field.linkedWbs')}</Label>
            <Select
              value={createValues.linkedWbsItemId}
              onValueChange={(value) => onChange((current) => ({ ...current, linkedWbsItemId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('myTasks.wbs.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('myTasks.wbs.unlinked')}</SelectItem>
                {allWbsItems.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createPending}>
            {t('common.button.cancel')}
          </Button>
          <Button onClick={onCreate} disabled={createPending}>
            {createPending ? t('common.button.processing') : t('myTasks.action.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
