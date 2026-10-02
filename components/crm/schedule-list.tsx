"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { effectiveStatus, compareQueueOrder, getCaseWorkState, isActive, isOverdue, taskType } from "@/lib/crm/entity-queue"
import { getClinic } from "@/lib/crm/catalog"
import { CreateCaseTask, TaskActions } from "./task-actions"
import { formatDateTime } from "@/lib/crm/format"
import { TASK_TYPES } from "@/lib/crm/entity-store"

export function ScheduleList(){
  const store=useScopedEntityStore(), {openCase}=useCasePanel(), {hasPermission}=useAuthorization(),{users}=useUserDirectory()
  const [now,setNow]=useState(0),[clinic,setClinic]=useState("all"),[owner,setOwner]=useState("all"),[priority,setPriority]=useState("all"),[status,setStatus]=useState("all"),[type,setType]=useState("all"),[board,setBoard]=useState("all"),[stage,setStage]=useState("all"),[call,setCall]=useState("all"),[team,setTeam]=useState("all"),[mode,setMode]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState("")
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[])
  if(!hasPermission("task:view"))return <p role="alert">Brak dostępu do zadań.</p>
  if(!now)return <div role="status" className="h-40 animate-pulse rounded bg-muted">Ładowanie kolejki…</div>
  const eligible=store.tasks.filter(task=>{
    const item=store.cases.find(item=>item.id===task.caseId)
    return item && (hasPermission("task:assign") || !task.ownerId || task.ownerId===store.currentUser.id) && (clinic==="all"||item.clinicId===clinic) && (owner==="all"||owner==="unassigned"&&!task.ownerId||task.ownerId===owner) && (mode!=="mine"||task.ownerId===store.currentUser.id) && (priority==="all"||task.priority===priority) && (status==="all"||effectiveStatus(task,now)===status) && (type==="all"||taskType(task)===type) && (board==="all"||item.board===board) && (stage==="all"||item.status===stage) && (team==="all"||item.responsibleTeamId===team) && (call==="all"||Boolean(task.requiresCall)===(call==="yes")) && (!from||Boolean(task.dueAt&&Date.parse(task.dueAt)>=Date.parse(from))) && (!to||Boolean(task.dueAt&&Date.parse(task.dueAt)<new Date(to+"T23:59:59").getTime()))
  }).sort((a,b)=>compareQueueOrder(a,b,now))
  const groups=[{id:"overdue",label:"Przeterminowane"},{id:"today",label:"Dzisiaj"},{id:"upcoming",label:"Nadchodzące"},{id:"undated",label:"Bez terminu"},{id:"history",label:"Historia · completed / cancelled / failed"}]
  const group=(task:typeof store.tasks[number])=>!isActive(task)?"history":isOverdue(task,now)?"overdue":!task.dueAt?"undated":new Date(task.dueAt).toDateString()===new Date(now).toDateString()?"today":"upcoming"
  const missing=store.cases.filter(item=>getCaseWorkState(item,store.tasks,now).missingNextAction)
  const select=(label:string,value:string,set:(value:string)=>void,values:string[]) => <label className="text-xs">{label}<select className="block w-full rounded border bg-background p-2" value={value} onChange={event=>set(event.target.value)}><option value="all">Wszystkie</option>{values.map(value=><option key={value}>{value}</option>)}</select></label>
  return <div className="space-y-5"><CreateCaseTask/>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
      {select("Zakres",mode,setMode,hasPermission("task:assign")?["mine","team"]:["mine","shared"])}
      {select("Klinika",clinic,setClinic,[...new Set(store.cases.flatMap(item=>item.clinicId?[item.clinicId]:[]))])}
      {select("Właściciel",owner,setOwner,["unassigned",...new Set(store.tasks.flatMap(task=>task.ownerId?[task.ownerId]:[]))])}
      {select("Zespół",team,setTeam,[...new Set(store.cases.map(item=>item.responsibleTeamId))])}
      {select("Priorytet",priority,setPriority,["P0","P1","P2","P3","P4"])}{select("Status",status,setStatus,["planned","ready","assigned","in_progress","overdue","completed","cancelled","failed"])}
      {select("Typ",type,setType,TASK_TYPES)}{select("Wymaga telefonu",call,setCall,["yes","no"])}{select("Board",board,setBoard,["leads","deals","patients"])}{select("Etap",stage,setStage,[...new Set(store.cases.map(item=>item.status))])}
      <label className="text-xs">Od<Input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label className="text-xs">Do<Input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    </div>
    <section className="rounded border border-amber-300 p-3"><h2 className="font-medium">Brak następnego działania · {missing.length}</h2>{missing.map(item=><Button key={item.id} size="sm" variant="outline" onClick={()=>openCase(item.id)}>{item.id} · {item.status}</Button>)}{!missing.length&&<p className="text-sm">Brak spraw wymagających interwencji.</p>}</section>
    {!eligible.length&&<p>Brak zadań dla wybranych filtrów.</p>}
    {groups.map(section=><section key={section.id}><h2 className="mb-2 font-medium">{section.label}</h2>{!eligible.some(task=>group(task)===section.id)&&<p className="text-sm text-muted-foreground">Brak zadań.</p>}<div className="space-y-2">{eligible.filter(task=>group(task)===section.id).map(task=>{
      const item=store.cases.find(item=>item.id===task.caseId)!,patient=store.patients.find(patient=>patient.id===item.patientId)
      return <article key={task.id} className="space-y-2 rounded border p-3"><div className="flex flex-wrap items-center gap-2"><strong>{task.title}</strong><span className={isOverdue(task,now)?"text-destructive":"text-muted-foreground"}>{task.priority} · {effectiveStatus(task,now)} · {task.dueAt?formatDateTime(task.dueAt,Intl.DateTimeFormat().resolvedOptions().timeZone):"Bez terminu"}</span></div><p className="text-sm">{task.description??"Brak opisu (historyczna task)"}</p><p className="text-xs text-muted-foreground">{patient?`${patient.firstName} ${patient.lastName}`:"Kontakt niepowiązany"} · {getClinic(item.clinicId)?.name??"Bez kliniki"} · {item.board}/{item.status} · {taskType(task)} · {users.find(user=>user.id===task.ownerId)?.name??"Brak właściciela"} · próby {task.attempts} · requiresCall {String(Boolean(task.requiresCall))} · {task.source??"legacy"} · przeniesienia {task.rescheduleCount??0}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>openCase(item.id)}>{item.id}</Button>{patient&&<Link className="text-sm underline" href={`/patients/${patient.id}`}>Patient 360</Link>}</div><TaskActions task={task}/></article>
    })}</div></section>)}
  </div>
}
