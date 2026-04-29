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

/**
 * Applies deterministic open/closed state to expandable Gantt branches.
 *
 * Rendering all branch states in one React update avoids imperative per-branch
 * toggles that can leave the chart in an intermediate layout.
 */
export function applyExpandedTaskState(
  tasks: GanttTask[],
  expandedTaskIds: ReadonlySet<string>,
): GanttTask[] {
  const expandableTaskIds = new Set(
    collectExpandableTaskIds(tasks).map((taskId) => String(taskId)),
  );

  return tasks.map((task) => {
    if (!expandableTaskIds.has(String(task.id))) {
      return task;
    }

    return {
      ...task,
      open: expandedTaskIds.has(String(task.id)),
    };
  });
}
