/**
 * §6 Priorities P0–P4 and queue rules, computed from Task (never from Case tags).
 */
import { getWorkflowStageRule } from "./workflow-rules"
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
 * §6 sort rule: operational bucket first, then business priority, then
 * SLA/due time and queue age (createdAt). Never sort by "modified" alone.
 */
export function compareQueueOrder(a: Task, b: Task, nowMs = Date.now()) {
  const overdueA = isOverdue(a, nowMs), overdueB = isOverdue(b, nowMs)
  const bucket = (task: Task, overdue: boolean) => overdue ? task.mandatory || task.workflowRuleId ? 0 : 1 : task.priority === "P0" ? 2 : task.priority === "P1" ? 3 : 4
  const rank = bucket(a, overdueA) - bucket(b, overdueB)
  if (rank) return rank
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  if (priority) return priority
  const dueA = a.dueAt ? Date.parse(a.dueAt) : Infinity
  const dueB = b.dueAt ? Date.parse(b.dueAt) : Infinity
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

/** Stateless projections of canonical Task; no Calendar copies. */
export function getCaseWorkState(item: EngagementCase, tasks: Task[], nowMs = Date.now()) {
  const related = tasks.filter(task => task.caseId === item.id)
  const active = related.filter(isActive)
  return { effectiveNextTask: getNextTaskForCase(tasks, item.id, nowMs), activeTaskCount: active.length,
    overdueTaskCount: active.filter(task => isOverdue(task, nowMs)).length,
    previousCompletedTask: related.filter(task => task.status === "completed").sort((a,b) => Date.parse(b.completedAt ?? b.createdAt) - Date.parse(a.completedAt ?? a.createdAt))[0],
    missingNextAction: !getWorkflowStageRule(item.board, item.status)?.terminal && active.length === 0 }
}
export function selectTaskCalendar(tasks: Task[]) {
  return { dated: tasks.filter(task => Boolean(task.dueAt)), undated: tasks.filter(task => !task.dueAt), overdue: tasks.filter(task => isOverdue(task)) }
}
export function taskType(task: Task) { return task.type ?? (task.requiresCall ? "call" : "custom") }
export function selectTaskAnalytics(tasks: Task[], events: import("./entities").AuditEvent[], cases: EngagementCase[] = []) {
  return { rescheduleCount: tasks.reduce((sum,task) => sum + (task.rescheduleCount ?? 0),0), replacementCount: tasks.filter(task => task.previousTaskId).length,
    cancellationCount: tasks.filter(task => task.status === "cancelled").length, manualOverrideCount: new Set(events.filter(event => event.action === "override" || event.action === "task_override" || event.action === "workflow_task_skipped" || (["admin","team_leader","clinic_manager"].includes(event.actorRole??"") && ["task_reschedule","task_replace","task_cancel","task_reopen","task_reassign","task_reprioritize"].includes(event.action??""))).map(event=>event.correlationId??event.id)).size,
    overdueAfterReschedule: tasks.filter(task => task.rescheduleCount && isOverdue(task)).length,
    manualCreated: tasks.filter(task => task.source === "manual").length, workflowCreated: tasks.filter(task => task.source === "workflow").length,
    open: tasks.filter(isActive).length, completed: tasks.filter(task => task.status === "completed").length, failed: tasks.filter(task => task.status === "failed").length,
    missingNextAction: cases.filter(item=>getCaseWorkState(item,tasks).missingNextAction).length,
    byActor: events.filter(event => event.taskId).reduce<Record<string,number>>((map,event) => ({...map,[event.actorId]:(map[event.actorId]??0)+1}),{}) }
}
