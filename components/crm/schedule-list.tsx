"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useCasePanel } from "@/lib/crm/panel-context"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useLanguage } from "@/lib/crm/language-context"
import { effectiveStatus, compareQueueOrder, getCaseWorkState, isActive, isOverdue, taskType } from "@/lib/crm/entity-queue"
import { getClinic } from "@/lib/crm/catalog"
import { BOARD_COLUMNS, BOARD_LABEL_KEYS } from "@/lib/crm/boards"
import { PRIORITY_TONE } from "@/lib/crm/entity-selectors"
import { priorityText, taskStatusText } from "@/lib/crm/display-labels"
import { taskTypeLabel } from "@/lib/crm/task-type-labels"
import { CreateCaseTask, TaskActions } from "./task-actions"
import { SortableList } from "./sortable-list"
import { formatDateTime } from "@/lib/crm/format"
import { TASK_TYPES } from "@/lib/crm/entity-store"

type Option = string | [value: string, label: string]

export function ScheduleList(){
  const store=useScopedEntityStore(), {openCase}=useCasePanel(), {hasPermission}=useAuthorization(),{users}=useUserDirectory(),{t,tr,language}=useLanguage()
  const [now,setNow]=useState(0),[clinic,setClinic]=useState("all"),[owner,setOwner]=useState("all"),[priority,setPriority]=useState("all"),[status,setStatus]=useState("all"),[type,setType]=useState("all"),[board,setBoard]=useState("all"),[stage,setStage]=useState("all"),[call,setCall]=useState("all"),[team,setTeam]=useState("all"),[mode,setMode]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState("")
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[])
  if(!hasPermission("task:view"))return <p role="alert">{tr("Brak dostępu do zadań.","Нет доступа к задачам.")}</p>
  if(!now)return <div role="status" className="h-40 animate-pulse rounded bg-muted"><span className="sr-only">{tr("Ładowanie kolejki…","Загрузка очереди…")}</span></div>
  const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone
  const stageLabel=(boardId:keyof typeof BOARD_COLUMNS,statusId:string)=>{const column=BOARD_COLUMNS[boardId].find(col=>col.id===statusId);return column?t(column.labelKey):statusId}
  const patientName=(patientId?:string)=>{const patient=store.patients.find(item=>item.id===patientId);return patient?`${patient.firstName} ${patient.lastName}`:tr("Nierozpoznany kontakt","Неопознанный контакт")}
  const ownerName=(ownerId?:string)=>users.find(user=>user.id===ownerId)?.name??tr("Brak właściciela","Без ответственного")
  const eligible=store.tasks.filter(task=>{
    const item=store.cases.find(item=>item.id===task.caseId)
    return item && (hasPermission("task:assign") || !task.ownerId || task.ownerId===store.currentUser.id) && (clinic==="all"||item.clinicId===clinic) && (owner==="all"||owner==="unassigned"&&!task.ownerId||task.ownerId===owner) && (mode!=="mine"||task.ownerId===store.currentUser.id) && (priority==="all"||task.priority===priority) && (status==="all"||effectiveStatus(task,now)===status) && (type==="all"||taskType(task)===type) && (board==="all"||item.board===board) && (stage==="all"||item.status===stage) && (team==="all"||item.responsibleTeamId===team) && (call==="all"||Boolean(task.requiresCall)===(call==="yes")) && (!from||Boolean(task.dueAt&&Date.parse(task.dueAt)>=Date.parse(from))) && (!to||Boolean(task.dueAt&&Date.parse(task.dueAt)<new Date(to+"T23:59:59").getTime()))
  }).sort((a,b)=>{
    const rankA=store.manualTaskRanks[a.id],rankB=store.manualTaskRanks[b.id]
    if(rankA!==undefined&&rankB!==undefined)return rankA-rankB
    if(rankA!==undefined)return 1
    if(rankB!==undefined)return -1
    return compareQueueOrder(a,b,now)
  })
  const hasManualOrder=Object.keys(store.manualTaskRanks).length>0
  const groups=[{id:"overdue",label:tr("Przeterminowane","Просроченные")},{id:"today",label:tr("Dzisiaj","Сегодня")},{id:"upcoming",label:tr("Nadchodzące","Предстоящие")},{id:"undated",label:tr("Bez terminu","Без срока")},{id:"history",label:tr("Historia (zakończone, anulowane, nieudane)","История (завершённые, отменённые, неудачные)")}]
  const group=(task:typeof store.tasks[number])=>!isActive(task)?"history":isOverdue(task,now)?"overdue":!task.dueAt?"undated":new Date(task.dueAt).toDateString()===new Date(now).toDateString()?"today":"upcoming"
  const missing=store.cases.filter(item=>getCaseWorkState(item,store.tasks,now).missingNextAction)
  const select=(label:string,value:string,set:(value:string)=>void,values:Option[]) => <label className="space-y-1 text-xs font-medium text-muted-foreground">{label}<select className="block w-full rounded-md border bg-background p-2 text-sm font-normal text-foreground" value={value} onChange={event=>set(event.target.value)}><option value="all">{tr("Wszystkie","Все")}</option>{values.map(option=>{const [optionValue,optionLabel]=Array.isArray(option)?option:[option,option];return <option key={optionValue} value={optionValue}>{optionLabel}</option>})}</select></label>
  const scopeOptions:Option[]=hasPermission("task:assign")?[["mine",tr("Moje","Мои")],["team",tr("Zespół","Команда")]]:[["mine",tr("Moje","Мои")],["shared",tr("Wspólne","Общие")]]
  const ownerIds=[...new Set(store.tasks.flatMap(task=>task.ownerId?[task.ownerId]:[]))]
  const clinicIds=[...new Set(store.cases.flatMap(item=>item.clinicId?[item.clinicId]:[]))]
  const teamIds=[...new Set(store.cases.map(item=>item.responsibleTeamId))]
  const stageIds=[...new Set(store.cases.map(item=>item.status))]
  const activeFilters=[clinic,owner,priority,status,type,board,stage,call,team,mode].filter(value=>value!=="all").length+(from?1:0)+(to?1:0)
  const resetFilters=()=>{setClinic("all");setOwner("all");setPriority("all");setStatus("all");setType("all");setBoard("all");setStage("all");setCall("all");setTeam("all");setMode("all");setFrom("");setTo("")}
  return <div className="space-y-5"><CreateCaseTask/>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      {select(tr("Zakres","Охват"),mode,setMode,scopeOptions)}
      {select(tr("Klinika","Клиника"),clinic,setClinic,clinicIds.map(id=>[id,getClinic(id)?.name??id] as Option))}
      {select(tr("Właściciel","Ответственный"),owner,setOwner,[["unassigned",tr("Nieprzypisane","Не назначено")],...ownerIds.map(id=>[id,ownerName(id)] as Option)])}
      {select(tr("Zespół","Команда"),team,setTeam,teamIds)}
      {select(tr("Priorytet","Приоритет"),priority,setPriority,(["P0","P1","P2","P3","P4"] as const).map(id=>[id,`${id} · ${priorityText(id,language)}`] as Option))}
      {select(tr("Status","Статус"),status,setStatus,["planned","ready","assigned","in_progress","overdue","completed","cancelled","failed"].map(id=>[id,taskStatusText(id,language)] as Option))}
      {select(tr("Typ zadania","Тип задачи"),type,setType,TASK_TYPES.map(id=>[id,taskTypeLabel(id,language)] as Option))}
      {select(tr("Wymaga telefonu","Нужен звонок"),call,setCall,[["yes",tr("Tak","Да")],["no",tr("Nie","Нет")]])}
      {select(tr("Tablica","Доска"),board,setBoard,(["leads","deals","patients"] as const).map(id=>[id,t(BOARD_LABEL_KEYS[id])] as Option))}
      {select(tr("Etap","Этап"),stage,setStage,stageIds.map(id=>{const sample=store.cases.find(item=>item.status===id);return [id,sample?stageLabel(sample.board,id):id] as Option}))}
      <label className="space-y-1 text-xs font-medium text-muted-foreground">{tr("Termin od","Срок от")}<Input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">{tr("Termin do","Срок до")}<Input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    </div>
    {activeFilters>0&&<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground">{tr("Aktywne filtry","Активные фильтры")}: {activeFilters} · {tr("wyniki","результатов")}: {eligible.length}</span><Button size="sm" variant="outline" onClick={resetFilters}>{tr("Wyczyść filtry","Сбросить фильтры")}</Button></div>}
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {activeFilters>0
        ?<span>{tr("Zmiana kolejności jest wyłączona przy aktywnych filtrach.","Изменение порядка отключено при активных фильтрах.")}</span>
        :<span>{tr("Przeciągnij uchwyt przy zadaniu, aby zmienić kolejność w grupie. Priorytet pozostaje bez zmian.","Перетащите маркер у задачи, чтобы изменить порядок в группе. Приоритет не меняется.")}</span>}
      {hasManualOrder&&<>
        <Badge variant="secondary">{tr("Własna kolejność ma pierwszeństwo przed priorytetem","Ручной порядок важнее приоритета")}</Badge>
        <Button size="sm" variant="outline" onClick={store.clearManualOrder}>{tr("Przywróć kolejność automatyczną","Вернуть автоматический порядок")}</Button>
      </>}
    </div>
    <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3" aria-labelledby="missing-next-action">
      <h2 id="missing-next-action" className="flex items-center gap-2 text-sm font-semibold text-amber-900"><AlertCircle className="h-4 w-4" aria-hidden="true"/>{tr("Sprawy bez następnego działania","Дела без следующего действия")} · {missing.length}</h2>
      {missing.length>0&&<p className="mt-1 text-xs text-amber-900/80">{tr("Otwórz sprawę i zaplanuj następny krok, żeby pacjent nie wypadł z procesu.","Откройте дело и запланируйте следующий шаг, чтобы пациент не выпал из процесса.")}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{missing.map(item=><Button key={item.id} size="sm" variant="outline" className="bg-background" onClick={()=>openCase(item.id)}>{patientName(item.patientId)} · {stageLabel(item.board,item.status)}</Button>)}</div>
      {!missing.length&&<p className="mt-1 text-sm text-amber-900/80">{tr("Wszystkie sprawy mają zaplanowane działanie.","У всех дел запланированы действия.")}</p>}
    </section>
    {!eligible.length&&<p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{tr("Brak zadań dla wybranych filtrów.","Нет задач по выбранным фильтрам.")}</p>}
    {groups.map(section=>{
      const sectionTasks=eligible.filter(task=>group(task)===section.id)
      if(!sectionTasks.length)return null
      return <section key={section.id} aria-labelledby={`group-${section.id}`}>
        <h2 id={`group-${section.id}`} className={cn("mb-2 text-sm font-semibold",section.id==="overdue"&&"text-red-700")}>{section.label} <span className="font-normal text-muted-foreground">· {sectionTasks.length}</span></h2>
        <SortableList listId={`tasks-${section.id}`} ids={sectionTasks.map(task=>task.id)} disabled={section.id==="history"||activeFilters>0||sectionTasks.length<2} onReorder={store.saveManualOrder} renderItem={(taskId,handle)=>{
          const task=sectionTasks.find(task=>task.id===taskId)!
          const item=store.cases.find(item=>item.id===task.caseId)!,patient=store.patients.find(patient=>patient.id===item.patientId),overdue=isOverdue(task,now)
          return <article key={task.id} className={cn("space-y-2 rounded-lg border bg-card p-3",overdue&&"border-red-200")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {handle}
              <Badge className={cn("border-0 text-white",PRIORITY_TONE[task.priority])}>{task.priority}</Badge>
              <strong className="text-sm">{task.title}</strong>
              <span className={cn("ml-auto flex items-center gap-1 text-xs",overdue?"font-medium text-red-700":"text-muted-foreground")}>
                {overdue&&<AlertCircle className="h-3 w-3" aria-hidden="true"/>}
                {taskStatusText(effectiveStatus(task,now),language)} · {task.dueAt?formatDateTime(task.dueAt,timeZone):tr("Bez terminu","Без срока")}
              </span>
            </div>
            {task.description&&<p className="text-sm text-muted-foreground">{task.description}</p>}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{patientName(item.patientId)}</span>
              <span aria-hidden="true">·</span><span>{getClinic(item.clinicId)?.name??tr("Bez kliniki","Без клиники")}</span>
              <span aria-hidden="true">·</span><span>{t(BOARD_LABEL_KEYS[item.board])} / {stageLabel(item.board,item.status)}</span>
              <span aria-hidden="true">·</span><span>{taskTypeLabel(taskType(task),language)}</span>
              <span aria-hidden="true">·</span><span>{ownerName(task.ownerId)}</span>
              {task.attempts>0&&<><span aria-hidden="true">·</span><span>{tr("próby","попыток")}: {task.attempts}</span></>}
              {(task.rescheduleCount??0)>0&&<><span aria-hidden="true">·</span><span>{tr("przeniesienia","переносов")}: {task.rescheduleCount}</span></>}
              {task.requiresCall&&<Badge variant="outline" className="gap-1 text-[10px]"><Phone className="h-3 w-3" aria-hidden="true"/>{tr("Wymaga telefonu","Нужен звонок")}</Badge>}
            </p>
            <div className="flex items-center gap-3"><Button size="sm" variant="outline" onClick={()=>openCase(item.id)}>{tr("Otwórz sprawę","Открыть дело")}</Button>{patient&&<Link className="text-sm underline" href={`/patients/${patient.id}`}>{tr("Profil pacjenta","Профиль пациента")}</Link>}</div>
            <TaskActions task={task}/>
          </article>
        }}/>
      </section>
    })}
  </div>
}
