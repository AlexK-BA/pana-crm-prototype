/**
 * §6 Priorities P0–P4 and queue rules, computed from Task (never from Case tags).
 */
import type { EngagementCase, Task, TaskPriority } from "./entities"

const PRIORITY_ORDER: Record<TaskPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 }

export function isOverdue(task: Task, nowMs = Date.now()) {
  if (!task.dueAt) return false
  if (task.status === "completed" || task.status === "cancelled" || task.status === "failed") return false
  return new Date(task.dueAt).getTime() < nowMs
}

/** Planned → Ready transition once due_at arrives (§6 rule 1). */
export function effectiveStatus(task: Task, nowMs = Date.now()): Task["status"] {
  if (task.status === "completed" || task.status === "cancelled" || task.status === "failed") return task.status
  if (task.dueAt && new Date(task.dueAt).getTime() < nowMs) {
    return task.status === "planned" || task.status === "ready" ? "overdue" : task.status
  }
  if (task.status === "planned" && task.dueAt && new Date(task.dueAt).getTime() <= nowMs) return "ready"
  return task.status
}

export function overdueDurationMs(task: Task, nowMs = Date.now()) {
  if (!task.dueAt) return 0
  return Math.max(0, nowMs - new Date(task.dueAt).getTime())
}

/** Whether the task is currently workable (visible in the active queue). */
export function isActive(task: Task) {
  return task.status !== "completed" && task.status !== "cancelled" && task.status !== "failed"
}

/**
 * §6 sort rule: priority first, then overdue severity, then SLA/due time,
 * then queue age (createdAt). Never sort by "modified" alone.
 */
export function compareQueueOrder(a: Task, b: Task, nowMs = Date.now()) {
  const pa = PRIORITY_ORDER[a.priority]
  const pb = PRIORITY_ORDER[b.priority]
  if (pa !== pb) return pa - pb

  const overdueA = overdueDurationMs(a, nowMs)
  const overdueB = overdueDurationMs(b, nowMs)
  if (overdueA !== overdueB) return overdueB - overdueA

  const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
  const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
  if (dueA !== dueB) return dueA - dueB

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export interface QueueOptions {
  ownerId?: string
  unassignedOnly?: boolean
  clinicIds?: string[]
}

export function getQueue(allTasks: Task[], options: QueueOptions = {}, nowMs = Date.now()) {
  let tasks = allTasks.filter(isActive)
  if (options.ownerId) tasks = tasks.filter((t) => t.ownerId === options.ownerId)
  if (options.unassignedOnly) tasks = tasks.filter((t) => !t.ownerId)
  return [...tasks].sort((a, b) => compareQueueOrder(a, b, nowMs))
}

/** The single task that currently determines what should happen next in a case. */
export function getNextTaskForCase(allTasks: Task[], caseId: string, nowMs = Date.now()) {
  return allTasks
    .filter((task) => task.caseId === caseId && isActive(task))
    .sort((a, b) => compareQueueOrder(a, b, nowMs))[0]
}

/**
 * Keeps the kanban a board of cases, while allowing their active tasks to
 * determine the order inside a stage. Cases without actionable work stay at
 * the bottom instead of hiding overdue work among recently modified records.
 */
export function compareCaseWorkOrder(
  a: EngagementCase,
  b: EngagementCase,
  allTasks: Task[],
  nowMs = Date.now(),
) {
  const taskA = getNextTaskForCase(allTasks, a.id, nowMs)
  const taskB = getNextTaskForCase(allTasks, b.id, nowMs)
  if (taskA && taskB) return compareQueueOrder(taskA, taskB, nowMs)
  if (taskA) return -1
  if (taskB) return 1
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export function getQueueCounters(allTasks: Task[], nowMs = Date.now()) {
  const active = allTasks.filter(isActive)
  const overdue = active.filter((t) => isOverdue(t, nowMs))
  return {
    p0: active.filter((t) => t.priority === "P0").length,
    p1: active.filter((t) => t.priority === "P1").length,
    p2: active.filter((t) => t.priority === "P2").length,
    p3: active.filter((t) => t.priority === "P3").length,
    p4: active.filter((t) => t.priority === "P4").length,
    overdue: overdue.length,
    unassigned: active.filter((t) => !t.ownerId).length,
  }
}
