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
import { getWorkflowStageRule } from "@/lib/crm/workflow-rules"
import { channelText, priorityText, taskOutcomeText, taskStatusText, taskTypeText } from "@/lib/crm/display-labels"
import type { Task, TaskPriority, TaskType, TaskOutcome, ContactChannel } from "@/lib/crm/entities"

const ACTION_TITLE:Record<TaskChangeInput["action"],[string,string]>={edit:["Edycja","Редактирование"],reschedule:["Przeniesienie terminu","Перенос срока"],reassign:["Zmiana właściciela","Смена владельца"],reprioritize:["Zmiana priorytetu","Смена приоритета"],replace:["Zastąpienie","Замена"],cancel:["Anulowanie","Отмена"],complete:["Wynik","Результат"],reopen:["Ponowne otwarcie","Повторное открытие"]}
const PRIORITIES:TaskPriority[]=["P0","P1","P2","P3","P4"]

export function TaskActions({task, proposedDue, onClose}:{task:Task; proposedDue?:string; onClose?:()=>void}) {
  const store=useScopedEntityStore(), {hasPermission}=useAuthorization(), {users}=useUserDirectory(), {startOutgoingCall}=useCall(), {tr,language}=useLanguage()
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
  }catch(error){setError(error instanceof Error?error.message:tr("Błąd zadania.","Ошибка задачи."))}}
  function begin(next:TaskChangeInput["action"]){if(next==="cancel"&&taskType(task)==="send_treatment_plan")setOutcome("patient_declined");setAction(next);setReason("");setError("")}
  const active=isActive(task), mayAssign=hasPermission("task:assign"), mayWork=hasPermission("task:work") && (mayAssign || !task.ownerId || task.ownerId===store.currentUser.id)
  const target=store.cases.find(item=>item.id===task.caseId)
  const availableOwners=users.filter(user=>user.status==="active" && (!target?.clinicId || user.clinicIds.includes(target.clinicId) || user.roles.includes("admin") || user.roles.includes("team_leader")))
  const outcomeOptions:TaskOutcome[]=taskType(task)==="send_treatment_plan"?action==="cancel"?["failed","patient_declined","no_valid_channel"]:["sent","failed","patient_declined","no_valid_channel"]:["done"]
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-1">
      {active&&mayWork&&task.requiresCall&&hasPermission("call:handle")&&<Button size="sm" onClick={()=>{try{startOutgoingCall({caseId:task.caseId,taskId:task.id})}catch(error){setError(String(error))}}}>{tr("Zadzwoń / wrap-up","Позвонить / wrap-up")}</Button>}
      {active&&mayWork&&<><Button size="sm" variant="outline" onClick={()=>begin("edit")}>{tr("Edytuj","Изменить")}</Button>{!task.requiresCall&&<><Button size="sm" variant="outline" onClick={()=>begin("complete")}>{tr("Zapisz wynik","Записать результат")}</Button><Button size="sm" variant="outline" onClick={()=>begin("reschedule")}>{tr("Przenieś","Перенести")}</Button></>}{(!task.requiresCall||mayAssign)&&<><Button size="sm" variant="outline" onClick={()=>begin("replace")}>{tr("Zastąp","Заменить")}</Button><Button size="sm" variant="outline" onClick={()=>begin("cancel")}>{tr("Anuluj","Отменить")}</Button></>}</>}
      {active&&mayAssign&&<><Button size="sm" variant="outline" onClick={()=>begin("reassign")}>{tr("Właściciel","Владелец")}</Button><Button size="sm" variant="outline" onClick={()=>begin("reprioritize")}>{tr("Priorytet","Приоритет")}</Button></>}
      {!active&&mayWork&&<Button size="sm" variant="outline" onClick={()=>begin("reopen")}>{tr("Otwórz ponownie","Открыть снова")}</Button>}
    </div>
    {error&&!action&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={Boolean(action)} onOpenChange={open=>{if(!open)close()}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{task.title} · {action ? tr(...ACTION_TITLE[action]) : ""}</DialogTitle></DialogHeader>
      <p className="break-all text-xs text-muted-foreground">{task.id} · {task.caseId} · {taskStatusText(task.status,language)} · {tr("przekazanie","передача")} {task.handoffState??"—"}. {tr("Historia pozostaje zachowana.","История сохраняется.")}</p>
      {["edit","replace"].includes(action??"")&&<><label>{tr("Tytuł","Название")}<Input value={title} onChange={event=>setTitle(event.target.value)}/></label><label>{tr("Opis zadania","Описание задачи")}<Textarea value={description} onChange={event=>setDescription(event.target.value)}/></label><label>{tr("Typ","Тип")}<select className="w-full rounded border p-2" value={type} onChange={event=>setType(event.target.value as TaskType)}>{TASK_TYPES.map(value=><option key={value} value={value}>{taskTypeText(value,language)}</option>)}</select></label></>}
      {["reschedule","replace"].includes(action??"")&&<><label>{tr("Nowy termin","Новый срок")}<Input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPast} onChange={event=>setAllowPast(event.target.checked)}/>{tr("Świadomie dopuszczam termin w przeszłości","Осознанно разрешаю срок в прошлом")}</label></>}
      {["reprioritize","replace"].includes(action??"")&&<label>{tr("Priorytet","Приоритет")}<select className="w-full rounded border p-2" value={priority} onChange={event=>setPriority(event.target.value as TaskPriority)}>{PRIORITIES.map(value=><option key={value} value={value}>{value} · {priorityText(value,language)}</option>)}</select></label>}
      {action==="reassign"&&<label>{tr("Aktywny właściciel","Активный владелец")}<select className="w-full rounded border p-2" value={owner} onChange={event=>setOwner(event.target.value)}>{availableOwners.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label>}
      {(action==="complete" || action==="cancel"&&taskType(task)==="send_treatment_plan")&&<><label>{tr("Wynik","Результат")}<select className="w-full rounded border p-2" value={outcome} onChange={event=>setOutcome(event.target.value as TaskOutcome)}>{outcomeOptions.map(value=><option key={value} value={value}>{taskOutcomeText(value,language)}</option>)}</select></label>{taskType(task)==="send_treatment_plan"&&<p className="text-xs">{tr("Plan","План")} {task.treatmentPlanId} · {tr("wersja","версия")} {task.treatmentPlanVersion} · {tr("kanał","канал")} {task.channel?channelText(task.channel,language):"—"}. {tr("Zapis wyniku jest emulacją, nie wywołaniem Medical CRM. Nieudane / brak działającego kanału wymaga następnego zadania; użyj zastąpienia lub jawnego anulowania z powodem.","Запись результата — эмуляция, а не вызов Medical CRM. «Не удалось» / «нет рабочего канала» требует следующей задачи; используйте замену или явную отмену с причиной.")}</p>}</>}
      {action==="complete"&&["failed","no_valid_channel"].includes(outcome)&&<div className="space-y-2"><label className="flex gap-2"><input type="checkbox" checked={nextAction} onChange={event=>setNextAction(event.target.checked)}/>{tr("Utwórz następne zadanie razem z wynikiem","Создать следующую задачу вместе с результатом")}</label>{nextAction&&<><Input aria-label={tr("Tytuł następnego zadania","Название следующей задачи")} value={title} onChange={event=>setTitle(event.target.value)}/><Textarea aria-label={tr("Opis następnego zadania","Описание следующей задачи")} value={description} onChange={event=>setDescription(event.target.value)}/><Input aria-label={tr("Termin następnego zadania","Срок следующей задачи")} type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></>}</div>}
      <label>{tr("Powód / wynik operacyjny *","Причина / операционный результат *")}<Textarea value={reason} onChange={event=>setReason(event.target.value)}/></label>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="ghost" onClick={close}>{tr("Wróć","Назад")}</Button><Button onClick={save} disabled={!reason.trim()}>{tr("Potwierdź","Подтвердить")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
export function toLocalDateTime(iso?:string){if(!iso)return "";const date=new Date(iso);if(!Number.isFinite(date.getTime()))return "";return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}

const CREATE_CHANNELS:ContactChannel[]=["email","phone","website","whatsapp","instagram","facebook","telegram"]
const COMMUNICATION_TASKS = new Set<TaskType>(["message","sms","email","send_treatment_plan"])
const TASK_DEFAULT_TITLE:Record<TaskType,[string,string]>={
  call:["Zadzwoń do pacjenta","Позвонить пациенту"],message:["Wyślij wiadomość","Отправить сообщение"],sms:["Wyślij SMS","Отправить SMS"],email:["Wyślij e-mail","Отправить e-mail"],qualification:["Uzupełnij kwalifikację","Заполнить квалификацию"],appointment_confirmation:["Potwierdź wizytę","Подтвердить визит"],appointment_booking:["Umów wizytę","Записать на визит"],post_visit_follow_up:["Skontaktuj się po wizycie","Связаться после визита"],waitlist_contact:["Skontaktuj się z listy oczekujących","Связаться по листу ожидания"],patient_care_handoff:["Przekaż do opieki nad pacjentem","Передать в сопровождение"],treatment_plan_review:["Sprawdź plan leczenia","Проверить план лечения"],send_treatment_plan:["Wyślij plan leczenia","Отправить план лечения"],custom:["Własne zadanie","Собственная задача"],
}

/**
 * Form state only; submission goes to the canonical guarded EntityStore command.
 * Terminal state is derived from the selected case, so every entry point (Now panel,
 * Tasks tab, Schedule) blocks the invalid action up front instead of failing on submit.
 */
export function CreateCaseTask({caseId,terminal=false,variant="outline"}:{caseId?:string;terminal?:boolean;variant?:"outline"|"secondary"}){
  const store=useScopedEntityStore(),{hasPermission}=useAuthorization(),{tr,language}=useLanguage()
  const [open,setOpen]=useState(false),[error,setError]=useState(""),[selectedType,setSelectedType]=useState<TaskType>("custom")
  if(!hasPermission("task:work")||!hasPermission("case:edit"))return null
  const isTerminalCase=(item:{board:string;status:string})=>Boolean(getWorkflowStageRule(item.board as never,item.status as never)?.terminal)
  const scopedCase=caseId?store.cases.find(item=>item.id===caseId):undefined
  const stageRule=scopedCase?getWorkflowStageRule(scopedCase.board,scopedCase.status):undefined
  const patient=scopedCase?.patientId?store.patients.find(item=>item.id===scopedCase.patientId):undefined
  const stageTypes=([...new Set([stageRule?.automaticTask?.type,...(stageRule?.suggestedTasks??[]),"custom"].filter(Boolean))] as TaskType[]).filter(type=>type!=="send_treatment_plan"||(hasPermission("patient:view_medical")&&Boolean(patient?.treatmentPlan||patient?.treatmentPlans?.length)))
  const defaultDue=toLocalDateTime(new Date(Date.now()+(stageRule?.automaticTask?.dueInMinutes??1440)*60000).toISOString())
  const defaultPriority=stageRule?.automaticTask?.priority??"P2"
  const sourceChannel=scopedCase?.attribution.caseCreationTouch.channel
  const defaultChannel=CREATE_CHANNELS.includes(sourceChannel as ContactChannel)?sourceChannel as ContactChannel:"phone"
  const blocked=Boolean(caseId)&&(terminal||(scopedCase?isTerminalCase(scopedCase):false))
  const selectableCases=store.cases.filter(item=>(!caseId||item.id===caseId)&&(caseId||!isTerminalCase(item)))
  const hintId=`create-task-terminal-${caseId??"any"}`
  function reset(){setSelectedType(stageTypes[0]??"custom");setError("")}
  return <><Button size="sm" variant={variant} disabled={blocked} aria-describedby={blocked?hintId:undefined} onClick={()=>{reset();setOpen(true)}}>{tr("Utwórz zadanie","Создать задачу")}</Button>{blocked&&<p id={hintId} className="text-xs text-muted-foreground">{tr("Najpierw przywróć sprawę do etapu roboczego.","Сначала верните кейс в рабочий этап.")}</p>}<Dialog open={open&&!blocked} onOpenChange={next=>{setOpen(next);if(next)reset()}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{tr("Wybierz następne działanie","Выберите следующее действие")}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);const type=String(data.get("type")) as TaskType;const preset=tr(...TASK_DEFAULT_TITLE[type]);const title=type==="custom"?String(data.get("title")):preset;const description=type==="custom"?String(data.get("description")):preset;try{store.createPatientTask({caseId:String(data.get("caseId")),title,description,type,priority:String(data.get("priority")) as TaskPriority,dueAt:String(data.get("dueAt")),channel:COMMUNICATION_TASKS.has(type)?String(data.get("channel")) as ContactChannel:undefined,requiresCall:type==="call",allowPast:data.has("allowPast")});setOpen(false)}catch(error){setError(error instanceof Error?error.message:tr("Nie udało się utworzyć zadania.","Не удалось создать задачу."))}}}>
    {caseId?<input type="hidden" name="caseId" value={caseId}/>:<label className="block">{tr("Sprawa","Кейс")}<select className="block w-full rounded border p-2" name="caseId" defaultValue="" required><option value="">{tr("Wybierz sprawę","Выберите кейс")}</option>{selectableCases.map(item=><option key={item.id} value={item.id}>{item.id} · {item.board}/{item.status}</option>)}</select></label>}
    <div><p className="mb-2 text-sm font-medium">{tr("Dostępne na tym etapie","Доступно на этом этапе")}</p><div className="grid gap-2 sm:grid-cols-2">{stageTypes.map(value=><label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${selectedType===value?"border-primary bg-primary/5":"hover:bg-muted/50"}`}><input className="mr-2" type="radio" name="type" value={value} checked={selectedType===value} onChange={()=>setSelectedType(value)}/><span className="font-medium">{taskTypeText(value,language)}</span>{value!=="custom"&&<span className="mt-1 block text-xs text-muted-foreground">{tr(...TASK_DEFAULT_TITLE[value])}</span>}</label>)}</div></div>
    {selectedType==="custom"&&<div className="space-y-3 rounded-lg border p-3"><label className="block">{tr("Tytuł własnego zadania","Название собственной задачи")}<Input name="title" required/></label><label className="block">{tr("Komentarz / istota zadania","Комментарий / суть задачи")}<Textarea name="description" required/></label></div>}
    <label className="block">{tr("Kiedy wykonać","Когда выполнить")}<Input name="dueAt" type="datetime-local" defaultValue={defaultDue} required/></label>
    {COMMUNICATION_TASKS.has(selectedType)&&<label className="block">{tr("Kanał kontaktu","Канал связи")}<select className="block w-full rounded border p-2" name="channel" defaultValue={defaultChannel}>{CREATE_CHANNELS.map(value=><option key={value} value={value}>{channelText(value,language)}</option>)}</select></label>}
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{tr("Ustawienia dodatkowe","Дополнительные настройки")}</summary><div className="mt-3 space-y-3"><label className="block">{tr("Priorytet","Приоритет")}<select className="block w-full rounded border p-2" name="priority" defaultValue={defaultPriority} required>{PRIORITIES.map(value=><option key={value} value={value}>{value} · {priorityText(value,language)}</option>)}</select></label><label className="flex gap-2 text-sm"><input name="allowPast" type="checkbox"/>{tr("Świadomie dopuszczam termin w przeszłości","Осознанно разрешаю срок в прошлом")}</label></div></details>
    <p className="text-xs text-muted-foreground">{tr("Pacjent, klinika i właściciel zostaną pobrani ze sprawy. Zadanie typu telefon zawsze wymaga połączenia i wrap-up.","Пациент, клиника и владелец берутся из кейса. Задача типа «звонок» всегда требует звонка и wrap-up.")}</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>{tr("Anuluj","Отмена")}</Button><Button type="submit">{tr("Utwórz","Создать")}</Button></DialogFooter>
  </form></DialogContent></Dialog></>
}
