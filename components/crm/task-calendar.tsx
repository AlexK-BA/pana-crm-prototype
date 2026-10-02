"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { effectiveStatus, selectTaskCalendar, isActive, isOverdue, taskType } from "@/lib/crm/entity-queue"
import { formatDateTime } from "@/lib/crm/format"
import { getClinic, getClinicTone } from "@/lib/crm/catalog"
import { TaskActions } from "./task-actions"

export function TaskCalendar(){
  const store=useScopedEntityStore(),{openCase}=useCasePanel(),{hasPermission}=useAuthorization(),{users}=useUserDirectory()
  const [now,setNow]=useState(0),[offset,setOffset]=useState(0),[drag,setDrag]=useState<string|null>(null),[pending,setPending]=useState<{id:string;due:string}|null>(null),[selected,setSelected]=useState<string|null>(null),[history,setHistory]=useState(false)
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[])
  if(!hasPermission("task:view"))return <p role="alert">Brak dostępu do kalendarza.</p>
  if(!now)return <div role="status" className="h-64 animate-pulse rounded bg-muted">Ładowanie kalendarza…</div>
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7)+offset*7)
  const days=Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return date})
  const projection=selectTaskCalendar(store.tasks.filter(task=>hasPermission("task:assign")||!task.ownerId||task.ownerId===store.currentUser.id)),dated=projection.dated.filter(task=>history||isActive(task)),detail=store.tasks.find(task=>task.id===selected),reschedule=store.tasks.find(task=>task.id===pending?.id)
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setOffset(offset-1)}>←</Button><Button variant="outline" onClick={()=>setOffset(0)}>Dzisiaj</Button><Button variant="outline" onClick={()=>setOffset(offset+1)}>→</Button><span>{days[0].toLocaleDateString()} – {days[6].toLocaleDateString()}</span><label className="flex gap-2"><input type="checkbox" checked={history} onChange={event=>setHistory(event.target.checked)}/>Pokaż historię</label></div>
    <p className="text-xs text-muted-foreground">Zadania ≠ wizyty. Czas lokalny przeglądarki; brak Appointment w modelu. Przeniesienie zadania nie zmienia daty wizyty. RequiresCall przenosisz przez wrap-up.</p>
    <div className="overflow-x-auto"><div className="grid min-w-[900px] grid-cols-7 gap-2">{days.map(day=><section key={day.toISOString()} className="min-h-48 rounded border p-2" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const task=store.tasks.find(task=>task.id===drag);if(!task)return;const original=new Date(task.dueAt!),due=new Date(day);due.setHours(original.getHours(),original.getMinutes(),0,0);setPending({id:task.id,due:due.toISOString()});setDrag(null)}}><h2 className="mb-2 text-sm">{day.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</h2>{dated.filter(task=>new Date(task.dueAt!).toDateString()===day.toDateString()).map(task=>{const item=store.cases.find(item=>item.id===task.caseId),patient=store.patients.find(patient=>patient.id===item?.patientId);return <button key={task.id} className={`mb-2 w-full space-y-1 rounded border p-2 text-left text-xs ${isOverdue(task,now)?"border-destructive bg-destructive/5":""}`} draggable={isActive(task)&&!task.requiresCall&&hasPermission("task:work")} onDragStart={()=>setDrag(task.id)} onDragEnd={()=>setDrag(null)} onClick={()=>setSelected(task.id)}><strong className="block">{task.title}</strong><span className="block">{patient?`${patient.firstName} ${patient.lastName}`:"Kontakt"}</span><span className={`block ${getClinicTone(item?.clinicId).chip}`}>{getClinic(item?.clinicId)?.name} · {taskType(task)}</span><span className="block">{new Date(task.dueAt!).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} · {task.priority} · {effectiveStatus(task,now)}</span><span className="block">{users.find(user=>user.id===task.ownerId)?.name??"Brak właściciela"} · {task.requiresCall?"requiresCall":""}</span></button>})}{!dated.some(task=>new Date(task.dueAt!).toDateString()===day.toDateString())&&<p className="text-xs text-muted-foreground">Brak zadań</p>}</section>)}</div></div>
    <section className="rounded border p-3"><h2>Przeterminowane · {projection.overdue.length}</h2><p className="text-xs text-muted-foreground">Zachowują pierwotną datę; nie są automatycznie przenoszone na dziś.</p>{projection.overdue.map(task=><Button key={task.id} variant="outline" size="sm" onClick={()=>setSelected(task.id)}>{task.title} · {formatDateTime(task.dueAt!,Intl.DateTimeFormat().resolvedOptions().timeZone)}</Button>)}</section>
    <section className="rounded border p-3"><h2>Bez terminu</h2>{projection.undated.filter(task=>history||isActive(task)).map(task=><Button key={task.id} variant="outline" size="sm" onClick={()=>setSelected(task.id)}>{task.title}</Button>)}{!projection.undated.length&&<p className="text-sm">Brak zadań bez terminu.</p>}</section>
    {detail&&<section className="space-y-2 rounded border p-3"><div className="flex gap-2"><strong>{detail.title}</strong><Button size="sm" variant="ghost" onClick={()=>setSelected(null)}>Zamknij</Button></div><p>{detail.description}</p><Button size="sm" variant="outline" onClick={()=>openCase(detail.caseId)}>{detail.caseId}</Button>{detail.patientId&&<Link className="ml-2 underline" href={`/patients/${detail.patientId}`}>Patient 360</Link>}<TaskActions key={detail.id} task={detail}/></section>}
    {reschedule&&pending&&<TaskActions key={`${pending.id}:${pending.due}`} task={reschedule} proposedDue={pending.due} onClose={()=>setPending(null)}/>}
  </div>
}
