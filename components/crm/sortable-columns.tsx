"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/crm/language-context"

const COLUMN_PREFIX = "column:"

const isColumn = (id: unknown) => String(id).startsWith(COLUMN_PREFIX)

// Column droppables are huge, so keyboard navigation must ignore them or it jumps to the column box instead of the next item.
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { droppableContainers } = args.context
  const itemsOnly = {
    get: (id: Parameters<typeof droppableContainers.get>[0]) => droppableContainers.get(id),
    getEnabled: () => droppableContainers.getEnabled().filter(container => !isColumn(container.id)),
  } as typeof droppableContainers
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: itemsOnly } })
}

const collisionDetection: CollisionDetection = args => {
  const hits = pointerWithin(args)
  if (!hits.length) {
    return closestCorners({ ...args, droppableContainers: args.pointerCoordinates ? args.droppableContainers : args.droppableContainers.filter(container => !isColumn(container.id)) })
  }
  const itemHits = hits.filter(hit => !String(hit.id).startsWith(COLUMN_PREFIX))
  return itemHits.length ? itemHits : hits
}

interface SortableColumnsProps {
  id: string
  /** columnId → ordered item ids currently shown in that column */
  columns: Record<string, string[]>
  reorderDisabled?: boolean
  onReorder: (columnId: string, orderedIds: string[]) => void
  /** Called when an item is dropped on another column. The caller decides whether to apply it. */
  onMove?: (itemId: string, fromColumnId: string, toColumnId: string) => void
  renderOverlay: (itemId: string) => ReactNode
  children: ReactNode
}

export function SortableColumns({ id, columns, reorderDisabled, onReorder, onMove, renderOverlay, children }: SortableColumnsProps) {
  const { tr } = useLanguage()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  )
  const findColumn = (itemId: string) => Object.keys(columns).find(columnId => columns[columnId].includes(itemId))

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const itemId = String(active.id), overId = String(over.id)
    const from = findColumn(itemId)
    const overIsColumn = overId.startsWith(COLUMN_PREFIX)
    const to = overIsColumn ? overId.slice(COLUMN_PREFIX.length) : findColumn(overId)
    if (!from || !to || !(to in columns)) return
    if (from !== to) {
      if (reorderDisabled) return
      return onMove?.(itemId, from, to)
    }
    if (reorderDisabled || itemId === overId) return
    const ids = columns[from]
    const fromIndex = ids.indexOf(itemId), toIndex = overIsColumn ? ids.length - 1 : ids.indexOf(overId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
    onReorder(from, arrayMove(ids, fromIndex, toIndex))
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: tr(
        "Aby zmienić kolejność, naciśnij spację, użyj strzałek w górę i w dół, a następnie spację, aby upuścić.",
        "Чтобы изменить порядок, нажмите пробел, стрелками вверх и вниз выберите место и снова нажмите пробел.",
      ) } }}
    >
      {children}
      <DragOverlay dropAnimation={null}>{activeId ? <div className="rounded-md shadow-lg">{renderOverlay(activeId)}</div> : null}</DragOverlay>
    </DndContext>
  )
}

export function SortableColumn({ columnId, ids, className, overClassName, ariaLabel, children }: {
  columnId: string
  ids: string[]
  className?: string
  overClassName?: string
  ariaLabel?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_PREFIX + columnId })
  return (
    <SortableContext id={columnId} items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} role={ariaLabel ? "group" : undefined} aria-label={ariaLabel} className={cn(className, isOver && overClassName)}>{children}</div>
    </SortableContext>
  )
}

export function SortableItem({ id, disabled, handleLabel, children }: {
  id: string
  disabled?: boolean
  handleLabel: string
  children: (handle: ReactNode) => ReactNode
}) {
  const { tr } = useLanguage()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      title={tr("Przeciągnij, aby zmienić kolejność (priorytet się nie zmienia)", "Перетащите, чтобы изменить порядок (приоритет не меняется)")}
      className="flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  )
  return <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>{children(handle)}</div>
}
