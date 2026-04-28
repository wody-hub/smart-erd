import type { GanttTask } from './gantt-adapter';

/**
 * Returns task ids that own expandable WBS descendants inside the gantt tree.
 *
 * Milestones are excluded because they never have child branches.
 */
export function collectExpandableTaskIds(tasks: GanttTask[]): Array<string | number> {
  const parentIds = new Set<string>();

  tasks.forEach((task) => {
    if (task.kind === 'milestone') {
      return;
    }

    if (typeof task.parent === 'undefined' || task.parent === null) {
      return;
    }

    parentIds.add(String(task.parent));
  });

  return tasks
    .filter((task) => task.kind !== 'milestone' && parentIds.has(String(task.id)))
    .map((task) => task.id);
}
