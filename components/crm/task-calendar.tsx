"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ChevronLeft, ChevronRight, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useLanguage } from "@/lib/crm/language-context"
import { effectiveStatus, selectTaskCalendar, isActive, isOverdue, taskType } from "@/lib/crm/entity-queue"
import { formatDateTime } from "@/lib/crm/format"
import { getClinic, getClinicTone } from "@/lib/crm/catalog"
import { PRIORITY_TONE } from "@/lib/crm/entity-selectors"
import { taskStatusText } from "@/lib/crm/display-labels"
import { taskTypeLabel } from "@/lib/crm/task-type-labels"
import { hasManualOrder, sortWithManualOrder } from "@/lib/crm/manual-order"
import { TaskActions } from "./task-actions"
import { SortableColumn, SortableColumns, SortableItem } from "./sortable-columns"

const LOCALES = { pl: "pl-PL", ru: "ru-RU" } as const

export function TaskCalendar(){
  const store=useScopedEntityStore(),{openCase}=useCasePanel(),{hasPermission}=useAuthorization(),{users}=useUserDirectory(),{tr,language}=useLanguage()
  const [now,setNow]=useState(0),[offset,setOffset]=useState(0),[pending,setPending]=useState<{id:string;due:string}|null>(null),[selected,setSelected]=useState<string|null>(null),[history,setHistory]=useState(false)
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[])
  if(!hasPermission("task:view"))return <p role="alert">{tr("Brak dostępu do kalendarza.","Нет доступа к календарю.")}</p>
  if(!now)return <div role="status" className="h-64 animate-pulse rounded bg-muted"><span className="sr-only">{tr("Ładowanie kalendarza…","Загрузка календаря…")}</span></div>
  const locale=LOCALES[language]
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7)+offset*7)
  const days=Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return date})
  const projection=selectTaskCalendar(store.tasks.filter(task=>hasPermission("task:assign")||!task.ownerId||task.ownerId===store.currentUser.id)),dated=projection.dated.filter(task=>history||isActive(task)),detail=store.tasks.find(task=>task.id===selected),reschedule=store.tasks.find(task=>task.id===pending?.id)
  const patientName=(patientId?:string)=>{const patient=store.patients.find(item=>item.id===patientId);return patient?`${patient.firstName} ${patient.lastName}`:tr("Kontakt","Контакт")}
  const ownerName=(ownerId?:string)=>users.find(user=>user.id===ownerId)?.name??tr("Brak właściciela","Без ответственного")
  const todayKey=new Date(now).toDateString()
  const dayKey=(date:Date)=>`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
  const orderKey=(key:string)=>`calendar:${key}`
  const tasksByDay=Object.fromEntries(days.map(day=>[dayKey(day),sortWithManualOrder(dated.filter(task=>new Date(task.dueAt!).toDateString()===day.toDateString()),store.manualOrder[orderKey(dayKey(day))],task=>task.id,(a,b)=>new Date(a.dueAt!).getTime()-new Date(b.dueAt!).getTime())]))
  const dayTaskIds=Object.fromEntries(Object.entries(tasksByDay).map(([key,items])=>[key,items.map(task=>task.id)]))
  const calendarHasOrder=hasManualOrder(store.manualOrder,"calendar:")
  const moveToDay=(taskId:string,_from:string,toKey:string)=>{
    const task=store.tasks.find(item=>item.id===taskId),day=days.find(item=>dayKey(item)===toKey)
    if(!task||!day||!isActive(task)||task.requiresCall||!hasPermission("task:work"))return
    const original=new Date(task.dueAt!),due=new Date(day);due.setHours(original.getHours(),original.getMinutes(),0,0)
    setPending({id:task.id,due:due.toISOString()})
  }
  const weekHasTasks=days.some(day=>dated.some(task=>new Date(task.dueAt!).toDateString()===day.toDateString()))
  const range=`${days[0].toLocaleDateString(locale,{day:"numeric",month:"short"})} – ${days[6].toLocaleDateString(locale,{day:"numeric",month:"short",year:"numeric"})}`
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label={tr("Poprzedni tydzień","Предыдущая неделя")} onClick={()=>setOffset(offset-1)}><ChevronLeft className="h-4 w-4"/></Button>
      <Button variant="outline" onClick={()=>setOffset(0)} disabled={offset===0}>{tr("Dzisiaj","Сегодня")}</Button>
      <Button variant="outline" size="icon" aria-label={tr("Następny tydzień","Следующая неделя")} onClick={()=>setOffset(offset+1)}><ChevronRight className="h-4 w-4"/></Button>
      <span className="px-2 text-sm font-medium" aria-live="polite">{range}</span>
      {calendarHasOrder&&<Button variant="outline" size="sm" className="ml-2" onClick={()=>store.clearManualOrder("calendar:")}>{tr("Przywróć kolejność automatyczną","Вернуть автоматический порядок")}</Button>}
      <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={history} onChange={event=>setHistory(event.target.checked)}/>{tr("Pokaż historię","Показать историю")}</label>
    </div>
    <p className="text-xs text-muted-foreground">{tr("To kalendarz zadań, a nie wizyt. Przeniesienie zadania nie zmienia terminu wizyty. Zadania z telefonem przenosisz przez zapis wyniku rozmowy. Uchwytem zmienisz kolejność zadań w dniu; priorytet się nie zmienia.","Это календарь задач, а не визитов. Перенос задачи не меняет дату визита. Задачи со звонком переносятся через запись результата звонка. Маркером можно изменить порядок задач в дне; приоритет не меняется.")}</p>
    {!weekHasTasks&&<p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{tr("W tym tygodniu nie ma zaplanowanych zadań.","На этой неделе нет запланированных задач.")}{projection.overdue.length>0&&<> {tr("Przeterminowane zadania są poniżej.","Просроченные задачи показаны ниже.")}</>}</p>}
    <SortableColumns id="task-calendar" columns={dayTaskIds} onReorder={(key,ids)=>store.saveManualOrder(orderKey(key),ids)} onMove={moveToDay} renderOverlay={taskId=><div className="w-40 rounded-md border bg-card p-2 text-xs font-semibold shadow-lg">{store.tasks.find(task=>task.id===taskId)?.title}</div>}>
    <div className="overflow-x-auto"><div className="grid min-w-[900px] grid-cols-7 gap-2">{days.map(day=>{
      const dayTasks=tasksByDay[dayKey(day)],isToday=day.toDateString()===todayKey
      return <SortableColumn key={day.toISOString()} columnId={dayKey(day)} ids={dayTaskIds[dayKey(day)]} ariaLabel={day.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long"})} overClassName="ring-2 ring-primary/40" className={cn("min-h-48 rounded-lg border p-2",isToday&&"border-primary/50 bg-primary/5")}>
        <h2 className={cn("mb-2 text-xs font-semibold capitalize",isToday&&"text-primary")}>{day.toLocaleDateString(locale,{weekday:"short",day:"numeric",month:"short"})}</h2>
        {dayTasks.map(task=>{const item=store.cases.find(item=>item.id===task.caseId),overdue=isOverdue(task,now);return <SortableItem key={task.id} id={task.id} disabled={!isActive(task)} handleLabel={tr("Zmień kolejność zadania","Изменить порядок задачи")}>{handle=><div className="mb-2 flex items-start gap-0.5"><div className="pt-2">{handle}</div><button type="button" className={cn("w-full min-w-0 flex-1 space-y-1 rounded-md border bg-card p-2 text-left text-xs hover:bg-muted/50",overdue&&"border-red-300 bg-red-50/60")} onClick={()=>setSelected(task.id)}>
          <span className="flex items-center gap-1.5"><span className={cn("h-2 w-2 shrink-0 rounded-full",PRIORITY_TONE[task.priority])} aria-hidden="true"/><span className="sr-only">{task.priority}</span><span className="font-semibold tabular-nums">{new Date(task.dueAt!).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</span>{overdue&&<AlertCircle className="h-3 w-3 text-red-600" aria-label={tr("Po terminie","Просрочено")}/>}{task.requiresCall&&<Phone className="ml-auto h-3 w-3 text-muted-foreground" aria-label={tr("Wymaga telefonu","Нужен звонок")}/>}</span>
          <strong className="block leading-snug">{task.title}</strong>
          <span className="block text-muted-foreground">{patientName(item?.patientId)}</span>
          <span className={cn("block truncate rounded px-1",getClinicTone(item?.clinicId).chip)}>{getClinic(item?.clinicId)?.name}</span>
        </button></div>}</SortableItem>})}
        {!dayTasks.length&&<p className="text-xs text-muted-foreground">{tr("Brak zadań","Нет задач")}</p>}
      </SortableColumn>
    })}</div></div></SortableColumns>
    {projection.overdue.length>0&&<section className="rounded-lg border border-red-200 bg-red-50/40 p-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-red-800"><AlertCircle className="h-4 w-4" aria-hidden="true"/>{tr("Przeterminowane","Просроченные")} · {projection.overdue.length}</h2><p className="text-xs text-muted-foreground">{tr("Zachowują pierwotną datę i nie przenoszą się same na dziś.","Сохраняют исходную дату и не переносятся на сегодня автоматически.")}</p><div className="mt-2 flex flex-wrap gap-2">{projection.overdue.map(task=><Button key={task.id} variant="outline" size="sm" className="bg-background" onClick={()=>setSelected(task.id)}>{task.title} · {formatDateTime(task.dueAt!,timeZone)}</Button>)}</div></section>}
    <section className="rounded-lg border p-3"><h2 className="text-sm font-semibold">{tr("Bez terminu","Без срока")}</h2><div className="mt-2 flex flex-wrap gap-2">{projection.undated.filter(task=>history||isActive(task)).map(task=><Button key={task.id} variant="outline" size="sm" onClick={()=>setSelected(task.id)}>{task.title}</Button>)}</div>{!projection.undated.filter(task=>history||isActive(task)).length&&<p className="text-sm text-muted-foreground">{tr("Brak zadań bez terminu.","Нет задач без срока.")}</p>}</section>
    {detail&&<section className="space-y-2 rounded-lg border p-3" aria-label={detail.title}>
      <div className="flex items-center gap-2"><strong>{detail.title}</strong><span className="text-xs text-muted-foreground">{taskTypeLabel(taskType(detail),language)} · {taskStatusText(effectiveStatus(detail,now),language)} · {ownerName(detail.ownerId)}</span><Button size="sm" variant="ghost" className="ml-auto" onClick={()=>setSelected(null)}>{tr("Zamknij","Закрыть")}</Button></div>
      {detail.description&&<p className="text-sm">{detail.description}</p>}
      <div className="flex items-center gap-3"><Button size="sm" variant="outline" onClick={()=>openCase(detail.caseId)}>{tr("Otwórz sprawę","Открыть дело")}</Button>{detail.patientId&&<Link className="text-sm underline" href={`/patients/${detail.patientId}`}>{tr("Profil pacjenta","Профиль пациента")}</Link>}</div>
      <TaskActions key={detail.id} task={detail}/>
    </section>}
    {reschedule&&pending&&<TaskActions key={`${pending.id}:${pending.due}`} task={reschedule} proposedDue={pending.due} onClose={()=>setPending(null)}/>}
  </div>
}
