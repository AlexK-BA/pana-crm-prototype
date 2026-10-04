"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useUserDirectory } from "@/lib/crm/user-directory"
import { useCall } from "@/lib/crm/call-context"
import { useLanguage } from "@/lib/crm/language-context"
import { TASK_TYPES, type TaskChangeInput } from "@/lib/crm/entity-store"
import { isActive, taskType } from "@/lib/crm/entity-queue"
import type { Task, TaskPriority, TaskType, TaskOutcome, ContactChannel } from "@/lib/crm/entities"

const actionLabels:Record<TaskChangeInput["action"],string>={edit:"Edycja",reschedule:"Przeniesienie terminu",reassign:"Zmiana właściciela",reprioritize:"Zmiana priorytetu",replace:"Zastąpienie",cancel:"Anulowanie",complete:"Wynik",reopen:"Ponowne otwarcie"}

export function TaskActions({task, proposedDue, onClose}:{task:Task; proposedDue?:string; onClose?:()=>void}) {
  const store=useScopedEntityStore(), {hasPermission}=useAuthorization(), {users}=useUserDirectory(), {startOutgoingCall}=useCall()
  const [action,setAction]=useState<TaskChangeInput["action"]|null>(proposedDue?"reschedule":null)
  const [title,setTitle]=useState(task.title),[description,setDescription]=useState(task.description??"")
  const [type,setType]=useState<TaskType>(taskType(task)),[priority,setPriority]=useState<TaskPriority>(task.priority)
  const [due,setDue]=useState(toLocalDateTime(proposedDue??task.dueAt)),[reason,setReason]=useState("")
  const [owner,setOwner]=useState(task.ownerId??store.currentUser.id),[outcome,setOutcome]=useState<TaskOutcome>(taskType(task)==="send_treatment_plan"?"sent":"done")
  const [nextAction,setNextAction]=useState(false)
  const [allowPast,setAllowPast]=useState(false),[error,setError]=useState("")
  function close(){setAction(null);setError("");onClose?.()}
  function save(){try{
    if(!action)return
    store.changeTask(task.id,{caseId:task.caseId,action,reason,allowPast,outcome,
      patch:{title,description,type,priority,ownerId:owner,dueAt:due},
      nextTask:nextAction?{caseId:task.caseId,title,description,type:"custom",priority,dueAt:due,allowPast}:undefined,
      replacement:action==="replace"?{caseId:task.caseId,title,description,type,priority,dueAt:due,ownerId:owner,allowPast,requiresCall:type==="call",channel:task.channel}:undefined})
    close()
  }catch(error){setError(error instanceof Error?error.message:"Błąd zadania.")}}
  function begin(next:TaskChangeInput["action"]){if(next==="cancel"&&taskType(task)==="send_treatment_plan")setOutcome("patient_declined");setAction(next);setReason("");setError("")}
  const active=isActive(task), mayAssign=hasPermission("task:assign"), mayWork=hasPermission("task:work") && (mayAssign || !task.ownerId || task.ownerId===store.currentUser.id)
  const target=store.cases.find(item=>item.id===task.caseId)
  const availableOwners=users.filter(user=>user.status==="active" && (!target?.clinicId || user.clinicIds.includes(target.clinicId) || user.roles.includes("admin") || user.roles.includes("team_leader")))
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-1">
      {active&&mayWork&&task.requiresCall&&hasPermission("call:handle")&&<Button size="sm" onClick={()=>{try{startOutgoingCall({caseId:task.caseId,taskId:task.id})}catch(error){setError(String(error))}}}>Zadzwoń / wrap-up</Button>}
      {active&&mayWork&&<><Button size="sm" variant="outline" onClick={()=>begin("edit")}>Edytuj</Button>{!task.requiresCall&&<><Button size="sm" variant="outline" onClick={()=>begin("complete")}>Zapisz wynik</Button><Button size="sm" variant="outline" onClick={()=>begin("reschedule")}>Przenieś</Button></>}{(!task.requiresCall||mayAssign)&&<><Button size="sm" variant="outline" onClick={()=>begin("replace")}>Zastąp</Button><Button size="sm" variant="outline" onClick={()=>begin("cancel")}>Anuluj</Button></>}</>}
      {active&&mayAssign&&<><Button size="sm" variant="outline" onClick={()=>begin("reassign")}>Właściciel</Button><Button size="sm" variant="outline" onClick={()=>begin("reprioritize")}>Priorytet</Button></>}
      {!active&&mayWork&&<Button size="sm" variant="outline" onClick={()=>begin("reopen")}>Otwórz ponownie</Button>}
    </div>
    {error&&!action&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(action)} onOpenChange={open=>{if(!open)close()}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{task.title} · {action ? actionLabels[action] : ""}</DialogTitle></DialogHeader>
      <p className="break-all text-xs text-muted-foreground">{task.id} · {task.caseId} · {task.status} · handoff {task.handoffState??"—"}. Historia pozostaje zachowana.</p>
      {["edit","replace"].includes(action??"")&&<><label>Tytuł<Input value={title} onChange={event=>setTitle(event.target.value)}/></label><label>Opis zadania<Textarea value={description} onChange={event=>setDescription(event.target.value)}/></label><label>Typ<select className="w-full rounded border p-2" value={type} onChange={event=>setType(event.target.value as TaskType)}>{TASK_TYPES.map(type=><option key={type}>{type}</option>)}</select></label></>}
      {["reschedule","replace"].includes(action??"")&&<><label>Nowy termin<Input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPast} onChange={event=>setAllowPast(event.target.checked)}/>Świadomie dopuszczam termin w przeszłości</label></>}
      {["reprioritize","replace"].includes(action??"")&&<label>Priorytet<select className="w-full rounded border p-2" value={priority} onChange={event=>setPriority(event.target.value as TaskPriority)}>{["P0","P1","P2","P3","P4"].map(value=><option key={value}>{value}</option>)}</select></label>}
      {action==="reassign"&&<label>Aktywny właściciel<select className="w-full rounded border p-2" value={owner} onChange={event=>setOwner(event.target.value)}>{availableOwners.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label>}
      {(action==="complete" || action==="cancel"&&taskType(task)==="send_treatment_plan")&&<><label>Wynik<select className="w-full rounded border p-2" value={outcome} onChange={event=>setOutcome(event.target.value as TaskOutcome)}>{(taskType(task)==="send_treatment_plan"?action==="cancel"?["failed","patient_declined","no_valid_channel"]:["sent","failed","patient_declined","no_valid_channel"]:["done"]).map(value=><option key={value}>{value}</option>)}</select></label>{taskType(task)==="send_treatment_plan"&&<p className="text-xs">Plan {task.treatmentPlanId} · wersja {task.treatmentPlanVersion} · kanał {task.channel}. Zapis wyniku jest emulacją, nie wywołaniem Medical CRM. Failed/no_valid_channel wymaga następnego zadania; użyj zastąpienia lub jawnego anulowania z powodem.</p>}</>}
      {action==="complete"&&["failed","no_valid_channel"].includes(outcome)&&<div className="space-y-2"><label className="flex gap-2"><input type="checkbox" checked={nextAction} onChange={event=>setNextAction(event.target.checked)}/>Utwórz następne zadanie razem z wynikiem</label>{nextAction&&<><Input aria-label="Tytuł następnego zadania" value={title} onChange={event=>setTitle(event.target.value)}/><Textarea aria-label="Opis następnego zadania" value={description} onChange={event=>setDescription(event.target.value)}/><Input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></>}</div>}
      <label>Powód / wynik operacyjny *<Textarea value={reason} onChange={event=>setReason(event.target.value)}/></label>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="ghost" onClick={close}>Wróć</Button><Button onClick={save} disabled={!reason.trim()}>Potwierdź</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
export function toLocalDateTime(iso?:string){if(!iso)return "";const date=new Date(iso);if(!Number.isFinite(date.getTime()))return "";return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}

/** Form state only; submission goes to the canonical guarded EntityStore command. */
export function CreateCaseTask({caseId,terminal=false,variant="outline"}:{caseId?:string;terminal?:boolean;variant?:"outline"|"secondary"}){
  const store=useScopedEntityStore(),{hasPermission}=useAuthorization(),{tr}=useLanguage()
  const [open,setOpen]=useState(false),[error,setError]=useState("")
  if(!hasPermission("task:work")||!hasPermission("case:edit"))return null
  const hintId=`create-task-terminal-${caseId??"any"}`
  return <><Button size="sm" variant={variant} disabled={terminal} aria-describedby={terminal?hintId:undefined} onClick={()=>{setOpen(true);setError("")}}>{tr("Utwórz zadanie","Создать задачу")}</Button>{terminal&&<p id={hintId} className="text-xs text-muted-foreground">{tr("Najpierw przywróć sprawę do etapu roboczego.","Сначала верните кейс в рабочий этап.")}</p>}<Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{tr("Nowe zadanie w sprawie","Новая задача по кейсу")}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);try{store.createPatientTask({caseId:String(data.get("caseId")),title:String(data.get("title")),description:String(data.get("description")),type:String(data.get("type")) as TaskType,priority:String(data.get("priority")) as TaskPriority,dueAt:String(data.get("dueAt")),channel:String(data.get("channel")) as ContactChannel,requiresCall:data.has("requiresCall"),allowPast:data.has("allowPast")});setOpen(false)}catch(error){setError(error instanceof Error?error.message:"Nie udało się utworzyć zadania.")}}}>
    <label className="block">Sprawa<select className="block w-full rounded border p-2" name="caseId" defaultValue={caseId??""} required><option value="">Wybierz sprawę</option>{store.cases.filter(item=>!caseId||item.id===caseId).map(item=><option key={item.id} value={item.id}>{item.id} · {item.board}/{item.status}</option>)}</select></label>
    <label className="block">Tytuł<Input name="title" required/></label><label className="block">Opis / istota zadania<Textarea name="description" required/></label>
    <label className="block">Typ<select className="block w-full rounded border p-2" name="type" defaultValue="custom">{TASK_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
    <label className="block">Kanał<select className="block w-full rounded border p-2" name="channel" defaultValue="email">{["email","phone","website","whatsapp","instagram","facebook","telegram"].map(channel=><option key={channel}>{channel}</option>)}</select></label>
    <label className="block">Termin<Input name="dueAt" type="datetime-local" required/></label><label className="block">Priorytet<select className="block w-full rounded border p-2" name="priority" defaultValue="P2" required>{["P0","P1","P2","P3","P4"].map(value=><option key={value}>{value}</option>)}</select></label>
    <label className="flex gap-2"><input name="requiresCall" type="checkbox"/>Wymaga połączenia i wrap-up</label><label className="flex gap-2"><input name="allowPast" type="checkbox"/>Świadomie dopuszczam termin w przeszłości</label>
    <p className="text-xs text-muted-foreground">Pacjent i klinika pochodzą ze sprawy. Właściciel: bieżący użytkownik. Wysyłka planu wymaga uprawnień medycznych i istniejącego planu.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Anuluj</Button><Button type="submit">Utwórz</Button></DialogFooter>
  </form></DialogContent></Dialog></>
}
