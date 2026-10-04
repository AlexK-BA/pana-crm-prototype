"use client"

import type { CSSProperties, ReactNode } from "react"
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/crm/language-context"

interface SortableListProps {
  listId: string
  ids: string[]
  disabled?: boolean
  onReorder: (orderedIds: string[]) => void
  renderItem: (id: string, handle: ReactNode) => ReactNode
}

export function SortableList({ listId, ids, disabled, onReorder, renderItem }: SortableListProps) {
  const { tr } = useLanguage()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onReorder(arrayMove(ids, from, to))
  }
  return (
    <DndContext
      id={listId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: tr(
        "Aby zmienić kolejność, naciśnij spację, użyj strzałek w górę i w dół, a następnie spację, aby upuścić.",
        "Чтобы изменить порядок, нажмите пробел, стрелками вверх и вниз выберите место и снова нажмите пробел.",
      ) } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">{ids.map(id => <SortableRow key={id} id={id} disabled={disabled} renderItem={renderItem} />)}</div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, disabled, renderItem }: { id: string; disabled?: boolean; renderItem: SortableListProps["renderItem"] }) {
  const { tr } = useLanguage()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={tr("Zmień kolejność zadania", "Изменить порядок задачи")}
      title={tr("Przeciągnij, aby zmienić kolejność (priorytet się nie zmienia)", "Перетащите, чтобы изменить порядок (приоритет не меняется)")}
      className="-ml-1 flex h-6 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  )
  return <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-10 opacity-90 shadow-lg")}>{renderItem(id, handle)}</div>
}
