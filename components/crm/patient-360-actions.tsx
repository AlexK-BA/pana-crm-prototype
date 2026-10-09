"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useScopedEntityStore } from "@/lib/crm/scoped-entity-store"
import { useAuthorization } from "@/lib/crm/authorization-context"
import { useCasePanel } from "@/lib/crm/panel-context"
import { CLINICS, PROCEDURES } from "@/lib/crm/catalog"
import { TASK_TYPES } from "@/lib/crm/entity-store"
import { useLanguage } from "@/lib/crm/language-context"
import { taskTypeLabel } from "@/lib/crm/task-type-labels"
import { channelText } from "@/lib/crm/display-labels"
import type { TaskType, CaseBoard, ClinicId, ContactChannel, TaskPriority } from "@/lib/crm/entities"

const channels: ContactChannel[] = ["phone", "email", "website", "whatsapp", "instagram", "facebook", "telegram", "tiktok", "viber", "personal_account"]
export function Patient360Actions({ patientId, caseId, contactOnly = false }: { patientId: string; caseId?: string; contactOnly?: boolean }) {
  const { tr, language } = useLanguage()
  const store = useScopedEntityStore()
  const { hasPermission } = useAuthorization()
  const { openCase } = useCasePanel()
  const patient = store.patients.find(item => item.id === patientId)
  const cases = store.cases.filter(item => item.patientId === patientId)
  const identities = store.identities.filter(item => item.patientId === patientId)
  const [action, setAction] = useState<"case" | "task" | "contact" | "local" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [clinicId, setClinicId] = useState(patient?.primaryClinicId ?? "pana-medica")
  const [identityId, setIdentityId] = useState("")
  const [selectedCase, setSelectedCase] = useState(caseId ?? "")
  const [board, setBoard] = useState<CaseBoard>("leads")
  const [service, setService] = useState("")
  const [taskDescription,setTaskDescription]=useState("")
  const [taskType,setTaskType]=useState<TaskType>("custom")
  const [allowPast,setAllowPast]=useState(false)
  const [title, setTitle] = useState("")
  const [due, setDue] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("P2")
  const [requiresCall, setRequiresCall] = useState(false)
  const [channel, setChannel] = useState<ContactChannel>("phone")
  const [value, setValue] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [tags, setTags] = useState("")
  const [note, setNote] = useState("")
  function begin(kind: NonNullable<typeof action>) {
    setAction(kind); setError(""); setNotice(""); setSelectedCase(caseId ?? ""); setIdentityId(""); setValue(""); setDisplayName("")
    setTags(patient?.localTags?.join(", ") ?? ""); setNote(patient?.localNote ?? ""); setService("")
  }
  function save() {
    try {
      if (action === "case") {
        const identity = identities.find(item => item.id === identityId)
        if (!identity) throw new Error(tr("Wybierz istniejący kontakt pacjenta.", "Выберите существующий контакт пациента."))
        const created = store.createPatientCase({ patientId, contactIdentityId: identityId, channel: identity.channel, clinicId, serviceInterest: service || undefined, board, initialTaskDueAt: due || undefined })
        setAction(null); openCase(created.id); return
      }
      if (action === "task") store.createPatientTask({ caseId: selectedCase, title, description:taskDescription, type:taskType, channel, dueAt: due, priority, requiresCall, allowPast })
      if (action === "local") store.updatePatientLocal(patientId, { localTags: tags.split(","), localNote: note })
      if (action === "contact") {
        const result = store.addPatientContact({ patientId, caseId: selectedCase || undefined, channel, value, displayName })
        if (result.conflictCaseId) { setAction(null); setNotice(tr("Kontakt konfliktowy — skierowano do dopasowania pacjenta bez przeniesienia tożsamości.", "Конфликтующий контакт направлен на сопоставление пациента без переноса идентификатора.")); openCase(result.conflictCaseId); return }
      }
      setAction(null); setNotice(tr("Zapisano.", "Сохранено."))
    } catch (error) { setError(error instanceof Error ? error.message : tr("Nie udało się zapisać.", "Не удалось сохранить.")) }
  }
  const titles = { case: tr("Nowa sprawa tego pacjenta", "Новый кейс пациента"), task: tr("Nowe zadanie w wybranej sprawie", "Новая задача в выбранном кейсе"), contact: tr("Dodaj lokalny kontakt", "Добавить локальный контакт"), local: tr("Lokalne tagi i notatka", "Локальные теги и заметка") }
  const selectClass = "w-full rounded-md border border-input bg-background p-2 text-sm"
  const casePicker = <label className="grid gap-1 text-sm">{tr("Sprawa", "Кейс")}<select aria-label={tr("Sprawa", "Кейс")} className={selectClass} value={selectedCase} onChange={event => setSelectedCase(event.target.value)}><option value="">{action === "contact" ? tr("Kontakt pacjenta bez konkretnej sprawy", "Контакт пациента без конкретного кейса") : tr("Wybierz sprawę", "Выберите кейс")}</option>{cases.map(item => <option key={item.id} value={item.id}>{item.id} · {item.status}</option>)}</select></label>
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {!contactOnly && hasPermission("case:edit") && <Button size="sm" variant="outline" onClick={() => begin("case")}>{tr("Utwórz sprawę", "Создать кейс")}</Button>}
      {!contactOnly && hasPermission("case:edit") && hasPermission("task:work") && <Button size="sm" variant="outline" onClick={() => begin("task")}>{tr("Utwórz zadanie", "Создать задачу")}</Button>}
      {hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => begin("contact")}>{tr("Dodaj kontakt", "Добавить контакт")}</Button>}
      {!contactOnly && hasPermission("patient:edit_local") && <Button size="sm" variant="outline" onClick={() => begin("local")}>{tr("Edytuj pola lokalne", "Изменить локальные поля")}</Button>}
    </div>
    {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <Dialog open={Boolean(action)} onOpenChange={open => { if (!open) setAction(null) }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{action ? titles[action] : "Patient 360"}</DialogTitle></DialogHeader>
        {action === "case" && <>{board === "deals" && <label className="grid gap-1 text-sm">{tr("Termin zadania potwierdzenia (brak wizyty w modelu)", "Срок задачи подтверждения (визита нет в модели)")}<Input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></label>}
          <label className="grid gap-1 text-sm">{tr("Kontakt / kanał", "Контакт / канал")}<select className={selectClass} value={identityId} onChange={event => setIdentityId(event.target.value)}><option value="">{tr("Wybierz istniejący kontakt", "Выберите существующий контакт")}</option>{identities.map(item => <option key={item.id} value={item.id}>{channelText(item.channel, language)} · {item.value}</option>)}</select></label>
          {identities.length === 0 && <p className="text-sm">{tr("Brak kontaktów. Najpierw dodaj lokalny kontakt.", "Нет контактов. Сначала добавьте локальный контакт.")}</p>}
          <label className="grid gap-1 text-sm">{tr("Klinika", "Клиника")}<select className={selectClass} value={clinicId} onChange={event => { setClinicId(event.target.value as ClinicId); setService("") }}>{CLINICS.filter(item => store.currentUser.roles.includes("admin") || store.currentUser.roles.includes("team_leader") || store.currentUser.clinicIds.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{tr("Usługa", "Услуга")}<select className={selectClass} value={service} onChange={event => setService(event.target.value)}><option value="">{tr("Nie określono", "Не указана")}</option>{PROCEDURES.filter(item => item.clinicId === clinicId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{tr("Początkowy lejek", "Начальная воронка")}<select className={selectClass} value={board} onChange={event => setBoard(event.target.value as CaseBoard)}><option value="leads">{tr("Leady · Nowy", "Лиды · Новый")}</option><option value="deals">{tr("Sprzedaż · Zaplanowano", "Сделки · Запланировано")}</option><option value="patients">{tr("Pacjenci · Nowy pacjent", "Пациенты · Новый пациент")}</option></select></label>
          <p className="text-xs text-muted-foreground">{tr("Pacjent i pierwszy kontakt pozostają bez zmian. Zadanie startowe powstaje według istniejącej reguły procesu.", "Пациент и первый контакт остаются без изменений. Стартовая задача создаётся по действующему правилу процесса.")}</p>
        </>}
        {action === "task" && <>{casePicker}<label className="grid gap-1 text-sm">{tr("Tytuł", "Название")}<Input value={title} onChange={event => setTitle(event.target.value)} /></label><label className="grid gap-1 text-sm">{tr("Opis zadania *", "Описание задачи *")}<Textarea value={taskDescription} onChange={event=>setTaskDescription(event.target.value)}/></label><label className="grid gap-1 text-sm">{tr("Typ", "Тип")}<select value={taskType} onChange={event=>setTaskType(event.target.value as TaskType)}>{TASK_TYPES.map(type=><option key={type} value={type}>{taskTypeLabel(type, language)}</option>)}</select></label><label className="grid gap-1 text-sm">{tr("Kanał", "Канал")}<select value={channel} onChange={event=>setChannel(event.target.value as ContactChannel)}>{channels.map(channel=><option key={channel} value={channel}>{channelText(channel, language)}</option>)}</select></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={allowPast} onChange={event=>setAllowPast(event.target.checked)}/>{tr("Dopuszczam termin w przeszłości", "Разрешаю срок в прошлом")}</label><label className="grid gap-1 text-sm">{tr("Termin", "Срок")}<Input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} /></label><label className="grid gap-1 text-sm">{tr("Priorytet", "Приоритет")}<select className={selectClass} value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>{["P0", "P1", "P2", "P3", "P4"].map(item => <option key={item}>{item}</option>)}</select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresCall} onChange={event => setRequiresCall(event.target.checked)} />{tr("Wymaga połączenia i obowiązkowego podsumowania", "Требует звонка и обязательного подведения итогов")}</label></>}
        {action === "contact" && <>{casePicker}<label className="grid gap-1 text-sm">{tr("Kanał", "Канал")}<select className={selectClass} value={channel} onChange={event => setChannel(event.target.value as ContactChannel)}>{channels.map(item => <option key={item} value={item}>{channelText(item, language)}</option>)}</select></label><label className="grid gap-1 text-sm">{tr("Telefon / e-mail / identyfikator", "Телефон / e-mail / идентификатор")}<Input value={value} onChange={event => setValue(event.target.value)} /></label><label className="grid gap-1 text-sm">{tr("Nazwa wyświetlana", "Отображаемое имя")}<Input value={displayName} onChange={event => setDisplayName(event.target.value)} /></label><p className="text-xs text-muted-foreground">{tr("Dodawany kontakt jest lokalny i niezweryfikowany. Potwierdzone kontakty Medical CRM pozostają tylko do odczytu; konflikt wymaga dopasowania pacjenta.", "Добавляемый контакт локальный и неподтверждённый. Подтверждённые контакты Medical CRM доступны только для чтения; конфликт требует сопоставления пациента.")}</p></>}
        {action === "local" && <><label className="grid gap-1 text-sm">{tr("Tagi oddzielone przecinkami", "Теги через запятую")}<Input value={tags} onChange={event => setTags(event.target.value)} /></label><label className="grid gap-1 text-sm">{tr("Notatka operacyjna", "Операционная заметка")}<Textarea value={note} onChange={event => setNote(event.target.value)} /></label><p className="text-xs text-muted-foreground">{tr("Wyłącznie lokalne dane CRM. Nie zmieniają danych medycznych ani tożsamości pacjenta.", "Только локальные данные CRM. Они не изменяют медицинские данные или личность пациента.")}</p></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setAction(null)}>{tr("Anuluj", "Отмена")}</Button><Button onClick={save}>{tr("Zapisz", "Сохранить")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
