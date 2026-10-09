const test=require('node:test')
const assert=require('node:assert/strict')
const {harness,patients}=require('./helpers/crm-command-harness.cjs')
const permissions=harness().load('lib/crm/permissions.ts').ROLE_PERMISSIONS
const access=(role='admin',clinicIds=['pana-medica'])=>({actorId:'usr-test',actorRole:role,active:true,globalScope:role==='admin'||role==='team_leader',clinicIds,assignableUserIds:['usr-test','other'],hasPermission:permission=>permissions[role].includes(permission)})
const future=()=>new Date(Date.now()+86400000).toISOString()
const cases=()=>[{id:'c1',patientId:'p1',clinicId:'pana-medica',board:'leads',status:'new',contactIdentityId:'phone1',responsibleTeamId:'cc',createdAt:new Date().toISOString(),attribution:{firstTouch:{at:'2020-01-01',source:'original'},caseCreationTouch:{at:'2020-01-01'}}},{id:'c2',patientId:'p2',clinicId:'pana-comfort',board:'deals',status:'scheduled',contactIdentityId:'phone2',responsibleTeamId:'cc',createdAt:new Date().toISOString(),attribution:{firstTouch:{at:'2021-01-01'},caseCreationTouch:{at:'2021-01-01'}}}]
const create=seed=>harness({cases:cases(),...seed})
const input=patch=>({caseId:'c1',title:'Synthetic custom task',description:'Complete the agreed operational step',type:'custom',priority:'P2',dueAt:future(),...patch})
const task=patch=>({id:'t1',caseId:'c1',patientId:'p1',title:'Historical task',status:'ready',priority:'P2',dueAt:future(),createdAt:'2026-01-01',attempts:0,...patch})
const snapshot=h=>JSON.stringify({tasks:h.store.tasks,cases:h.store.cases,patients:h.store.patients,interactions:h.store.interactions,audit:h.store.auditEvents})
const rejects=(h,fn)=>{const before=snapshot(h);assert.throws(fn);h.render();assert.equal(snapshot(h),before)}
const change=(h,action,patch={},extras={})=>h.store.changeTask('t1',{caseId:'c1',action,reason:'Confirmed operational reason',patch,...extras},access())

test('canonical Task is reused by queue/calendar/case selectors, no copies or appointment entity',()=>{
 const h=create({tasks:[task(),task({id:'undated',dueAt:undefined})]}),q=h.load('lib/crm/entity-queue.ts')
 assert.equal(q.selectTaskCalendar(h.store.tasks).dated[0],h.store.tasks[0]);assert.equal(q.selectTaskCalendar(h.store.tasks).undated[0],h.store.tasks[1]);assert.equal(q.getNextTaskForCase(h.store.tasks,'c1'),h.store.tasks[0])
})
test('all stage IDs retain one existing workflow catalog with type, due policy and suggestions',()=>{
 const h=create(),rules=h.load('lib/crm/workflow-rules.ts').WORKFLOW_STAGE_RULES,boards=h.load('lib/crm/boards.ts').BOARD_COLUMNS
 for(const [board,columns] of Object.entries(boards))for(const column of columns)assert.ok(rules.some(rule=>rule.board===board&&rule.status===column.id))
 assert.ok(rules.filter(rule=>!rule.terminal).every(rule=>rule.nextActionMandatory))
 assert.ok(rules.filter(rule=>!rule.terminal).every(rule=>rule.suggestedTasks.includes('custom')&&rule.suggestedTasks.length>=2))
})
test('stage and starter task commit together; same retained command/double click creates one active task',()=>{
 const h=create(),move=h.store.moveCase,a=access();const touch=JSON.stringify(h.store.cases[0].attribution)
 move('c1','qualification','spoofed',{},a);move('c1','qualification','spoofed',{},a);h.render()
 assert.equal(h.store.cases[0].status,'qualification');assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].workflowRuleId,'leads.qualification.complete');assert.equal(h.store.tasks[0].source,'workflow');assert.equal(JSON.stringify(h.store.cases[0].attribution),touch)
 const events=h.store.auditEvents;assert.ok(events.every(event=>event.actorId==='usr-test'));assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
})
test('invalid transition due / stage / permissions reject atomically',()=>{
 const h=create()
 for(const fn of [()=>h.store.moveCase('c1','waiting','spoofed'),()=>h.store.moveCase('c1','unknown','spoofed',{},access()),()=>h.store.moveCase('c1','call_later','spoofed',{},access()),()=>h.store.moveCase('c1','qualification','spoofed',{dueAt:'invalid'},access()),()=>h.store.moveCase('c1','failed','spoofed',{},access())])rejects(h,fn)
})
test('callback explicit type/due creates call-required task; returning to stage reuses active rule task',()=>{
 const h=create(),a=access();h.store.moveCase('c1','call_later','ignored',{taskType:'call',dueAt:future()},a);h.render();assert.equal(h.store.tasks[0].requiresCall,true)
 h.store.moveCase('c1','qualification','ignored',{},a);h.render();h.store.moveCase('c1','call_later','ignored',{taskType:'call',dueAt:future()},a);h.render();assert.equal(h.store.tasks.filter(task=>task.workflowRuleId==='leads.call_later.call').length,1)
})
test('terminal stage creates no task and requires explicit resolution of active tasks',()=>{
 const h=create({tasks:[task({requiresCall:true})]});rejects(h,()=>h.store.moveCase('c1','closed','ignored',{reason:'Closure'},access()))
 rejects(h,()=>h.store.moveCase('c1','closed','ignored',{reason:'Closure',activeTaskDecision:'cancel'},access('operator')))
 h.store.moveCase('c1','closed','ignored',{reason:'Confirmed cancellation',activeTaskDecision:'cancel'},access());h.render();assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.cases[0].status,'closed')
})
test('manual skip override requires permission/reason and exposes missing-next-action control state',()=>{
 const h=create();for(const a of [access('operator'),access()])rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{skipAutomatic:true},a))
 h.store.moveCase('c1','qualification','ignored',{skipAutomatic:true,override:true,reason:'Approved exception'},access());h.render();assert.equal(h.store.tasks.length,0)
 const q=h.load('lib/crm/entity-queue.ts');assert.equal(q.getCaseWorkState(h.store.cases[0],h.store.tasks).missingNextAction,true);assert.equal(q.selectTaskAnalytics(h.store.tasks,h.store.auditEvents).manualOverrideCount,1)
})
test('Appointment/clinical stages reject invented dates; explicit manual date is stored',()=>{
 const cs=cases();cs[0].board='patients';cs[0].status='new_patient';const h=create({cases:cs})
 for(const stage of ['appt_scheduled','returning','in_treatment','control'])rejects(h,()=>h.store.moveCase('c1',stage,'ignored',{},access()))
 h.store.moveCase('c1','appt_scheduled','ignored',{dueAt:future()},access());h.render();assert.equal(h.store.tasks[0].type,'appointment_confirmation')
})
test('effective ranking puts overdue mandatory then other overdue ahead of future P0/P1',()=>{
 const h=create(),q=h.load('lib/crm/entity-queue.ts'),now=Date.now()
 const ts=[task({id:'futureP0',priority:'P0'}),task({id:'late',priority:'P4',dueAt:new Date(now-1000).toISOString()}),task({id:'mandatory',priority:'P4',mandatory:true,dueAt:new Date(now-500).toISOString()}),task({id:'undated',dueAt:undefined})]
 assert.deepEqual(Array.from(q.getQueue(ts),task=>task.id),['mandatory','late','futureP0','undated']);assert.equal(q.getCaseWorkState(cases()[0],ts).overdueTaskCount,2)
})
test('business priority wins inside the same operational bucket before due time',()=>{
 const h=create(),q=h.load('lib/crm/entity-queue.ts'),now=Date.now()
 const ts=[
  task({id:'older-new-lead',priority:'P3',dueAt:new Date(now-7200000).toISOString(),createdAt:'2026-01-01'}),
  task({id:'missed-call-p1',priority:'P1',requiresCall:true,dueAt:new Date(now-3600000).toISOString(),createdAt:'2026-01-02'}),
  task({id:'older-mandatory-p4',priority:'P4',mandatory:true,dueAt:new Date(now-10800000).toISOString(),createdAt:'2026-01-01'}),
  task({id:'newer-mandatory-p1',priority:'P1',mandatory:true,dueAt:new Date(now-1800000).toISOString(),createdAt:'2026-01-02'}),
 ]
 assert.deepEqual(Array.from(q.getQueue(ts,{},now),item=>item.id),['newer-mandatory-p1','older-mandatory-p4','missed-call-p1','older-new-lead'])
})
test('demo task rebasing preserves relative deadlines without mutating seed tasks',()=>{
 const h=create(),fixtures=h.load('lib/crm/demo-fixtures.ts'),reference=Date.parse(fixtures.DEMO_REFERENCE_AT),sessionNow=Date.parse('2030-05-10T09:15:00.000Z')
 const seed=[task({id:'overdue',createdAt:new Date(reference-7200000).toISOString(),dueAt:new Date(reference-3600000).toISOString(),slaAt:new Date(reference-1800000).toISOString()}),task({id:'future',createdAt:new Date(reference-1000).toISOString(),dueAt:new Date(reference+604800000).toISOString()})]
 const before=JSON.stringify(seed),rebased=fixtures.rebaseDemoTasks(seed,sessionNow)
 assert.equal(JSON.stringify(seed),before);assert.notEqual(rebased[0],seed[0])
 assert.equal(Date.parse(rebased[0].dueAt)-sessionNow,-3600000);assert.equal(Date.parse(rebased[1].dueAt)-sessionNow,604800000)
 assert.equal(Date.parse(rebased[0].slaAt)-sessionNow,-1800000);assert.equal(Date.parse(rebased[0].createdAt)-sessionNow,-7200000)
})
test('completed/cancelled/failed tasks remain in canonical history and never appear as active',()=>{
 const h=create({tasks:['completed','cancelled','failed'].map((status,index)=>task({id:String(index),status}))}),q=h.load('lib/crm/entity-queue.ts')
 assert.equal(q.getQueue(h.store.tasks).length,0);assert.equal(q.selectTaskCalendar(h.store.tasks).dated.length,3);assert.equal(q.getCaseWorkState(h.store.cases[0],h.store.tasks).missingNextAction,true)
})
test('custom requires title/description/date/type; inherits Patient from Case',()=>{
 const h=create();for(const patch of [{title:''},{description:''},{dueAt:'invalid'},{dueAt:''},{type:'not-real'},{patientId:'p2',description:''}])rejects(h,()=>h.store.createPatientTask(input(patch),access()))
 const created=h.store.createPatientTask(input({patientId:'p2'}),access());h.render();assert.equal(created.patientId,'p1');assert.equal(created.createdBy,'usr-test');assert.equal(created.originalDueAt,created.dueAt)
})
test('past dates require explicit consent, including reschedule',()=>{
 const h=create({tasks:[task()]}),dueAt=new Date(Date.now()-3600000).toISOString();rejects(h,()=>h.store.createPatientTask(input({dueAt}),access()))
 const made=h.store.createPatientTask(input({dueAt,allowPast:true}),access());h.render();assert.equal(made.dueAt,dueAt)
 rejects(h,()=>change(h,'reschedule',{dueAt}));change(h,'reschedule',{dueAt},{allowPast:true});h.render();assert.equal(h.store.tasks[0].dueAt,dueAt)
})
test('reschedule preserves original due, increments count, changes queue/calendar and never stage',()=>{
 const original=new Date(Date.now()+1000).toISOString(),h=create({tasks:[task({dueAt:original}),task({id:'t2',dueAt:new Date(Date.now()+2000).toISOString()})]}),q=h.load('lib/crm/entity-queue.ts')
 assert.equal(q.getNextTaskForCase(h.store.tasks,'c1').id,'t1');change(h,'reschedule',{dueAt:future()});h.render();change(h,'reschedule',{dueAt:future()});h.render()
 assert.equal(h.store.tasks[0].originalDueAt,original);assert.equal(h.store.tasks[0].rescheduleCount,2);assert.equal(q.getNextTaskForCase(h.store.tasks,'c1').id,'t2');assert.equal(h.store.cases[0].status,'new');assert.equal(q.selectTaskCalendar(h.store.tasks).dated[0].id,'t1')
})
test('overdue Calendar projection retains actual original date instead of moving to today',()=>{
 const due='2020-01-01T10:00:00Z',h=create({tasks:[task({dueAt:due})]}),q=h.load('lib/crm/entity-queue.ts');const projection=q.selectTaskCalendar(h.store.tasks)
 assert.equal(projection.overdue[0].dueAt,due);assert.equal(projection.dated[0].dueAt,due)
})
test('replacement links new/old and retains cancelled history',()=>{
 const h=create({tasks:[task()]});change(h,'replace',{}, {replacement:input({title:'Replacement'})});h.render()
 assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.tasks[1].previousTaskId,'t1');assert.equal(h.store.tasks[0].replacementTaskId,h.store.tasks[1].id);assert.equal(h.store.tasks[1].patientId,'p1')
})
test('replacement / edit cannot move task to a different case or destroy call constraints',()=>{
 const h=create({tasks:[task({requiresCall:true,type:'call'})]});rejects(h,()=>change(h,'replace',{}, {replacement:input({caseId:'c2'})}));rejects(h,()=>change(h,'edit',{type:'custom'}));rejects(h,()=>h.store.changeTask('t1',{caseId:'c2',action:'edit',reason:'No',patch:{title:'Injected'}},access()))
})
test('all lifecycle commands require active context/permission before state or audit',()=>{
 const h=create({tasks:[task()]})
 for(const action of ['edit','reschedule','reassign','reprioritize','replace','cancel','complete','reopen'])rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action,reason:'Denied',patch:{dueAt:future()}},undefined))
 for(const fn of [()=>h.store.completeTask('t1','done'),()=>h.store.rescheduleTask('t1',future(),'No'),()=>h.store.reopenTask('t1'),()=>h.store.skipTask('t1','No'),()=>h.store.assignTask('t1','other','spoofed'),()=>h.store.setPriority('t1','P0','spoofed'),()=>h.store.changeTask('missing',{caseId:'c1',action:'complete',reason:'No'},access()),()=>h.store.changeTask('t1',{caseId:'c1',action:'complete',reason:'No'},{...access(),active:false})])rejects(h,fn)
})
test('Operator cannot reassign/reprioritize/foreign work; manager cannot mutate foreign clinic',()=>{
 const h=create({tasks:[task({ownerId:'other'}),task({id:'foreign',caseId:'c2',patientId:'p2'})]})
 for(const action of ['reassign','reprioritize','edit'])rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action,reason:'No',patch:{ownerId:'usr-test',priority:'P0'}},access('operator')))
 rejects(h,()=>h.store.changeTask('foreign',{caseId:'c2',action:'cancel',reason:'No'},access('clinic_manager')))
})
test('reassign/reprioritize validate owner/priority, with canonical actor metadata',()=>{
 const h=create({tasks:[task()]});rejects(h,()=>change(h,'reassign',{ownerId:'unknown'}));rejects(h,()=>change(h,'reprioritize',{priority:'P9'}))
 change(h,'reassign',{ownerId:'other'});h.render();change(h,'reprioritize',{priority:'P0'});h.render();assert.equal(h.store.tasks[0].ownerId,'other');assert.equal(h.store.tasks[0].priority,'P0')
 const event=h.store.auditEvents.at(-1);for(const field of ['taskId','caseId','patientId','clinicId','actorId','actorRole','before','after','reason','correlationId','at'])assert.ok(event[field]);assert.equal(event.actorId,'usr-test')
})
test('closed task cannot be edited silently; explicit reopen preserves reschedule history',()=>{
 const h=create({tasks:[task({status:'completed',completedAt:'2026-01-01',rescheduleCount:3,originalDueAt:'2025-01-01'})]});rejects(h,()=>change(h,'edit',{title:'No'}));change(h,'reopen');h.render();assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].rescheduleCount,3);assert.equal(h.store.tasks[0].originalDueAt,'2025-01-01')
})
test('send treatment plan snapshots Medical CRM ID/version and does not complete by creation',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:7,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const created=h.store.sendTreatmentPlanTask('p1','c1','spoofed',access());h.render()
 assert.equal(created.type,'send_treatment_plan');assert.equal(created.treatmentPlanId,'plan');assert.equal(created.treatmentPlanVersion,7);assert.equal(created.status,'planned')
 rejects(h,()=>h.store.completePatientTask(created.id,access()));h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Emulated dispatch acknowledged',outcome:'sent'},access());h.render();assert.equal(h.store.tasks[0].outcome,'sent');assert.equal(h.store.tasks[0].treatmentPlanVersion,7)
})
test('missing plan / medical permission rejects without fictional plan/task',()=>{
 const h=create();rejects(h,()=>h.store.sendTreatmentPlanTask('p1','c1','ignored',access()));rejects(h,()=>h.store.createPatientTask(input({type:'send_treatment_plan',channel:'email'}),access('operator')))
})
test('plan failed result requires next action atomically or explicit cancellation reason',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:1,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const created=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render()
 rejects(h,()=>h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Failure',outcome:'failed'},access()))
 h.store.changeTask(created.id,{caseId:'c1',action:'complete',reason:'Provider emulator failure; next contact',outcome:'failed',nextTask:input()},access());h.render();assert.equal(h.store.tasks[0].status,'failed');assert.equal(h.store.tasks.length,2)
})
test('requiresCall manual complete/reschedule is rejected even for Admin; cancel/replace require supervisor reason',()=>{
 const h=create({tasks:[task({requiresCall:true,type:'call'})]});for(const action of ['complete','reschedule'])rejects(h,()=>change(h,action,{dueAt:future()}));rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'cancel',reason:'No'},access('operator')))
 change(h,'cancel');h.render();assert.equal(h.store.tasks[0].status,'cancelled')
})
test('real call wrap-up retry preserves Task ID/original due and increments reschedule counter',()=>{
 const due=future(),h=create({tasks:[task({requiresCall:true,ownerId:'usr-test',dueAt:due})]});h.scoped('operator');h.callRender();h.call.startOutgoingCall({caseId:'c1',taskId:'t1'});h.callRender();h.call.hangUp();h.callRender()
 assert.equal(h.call.submitWrapUp('no_answer',{rescheduleAt:future()}),true);h.render();assert.equal(h.store.tasks[0].id,'t1');assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].originalDueAt,due);assert.equal(h.store.tasks[0].rescheduleCount,1)
})
test('Marketing receives neither task records nor Patient PII; retained command uses live role',()=>{
 const h=create({tasks:[task()]}),scoped=h.scoped('admin');h.scoped('marketing');rejects(h,()=>scoped.changeTask('t1',{caseId:'c1',action:'cancel',reason:'Denied'}));const m=h.scoped('marketing');assert.equal(m.tasks.length,0);assert.equal(m.patients.length,0)
})
test('analytics preserves replacement/cancellation/reschedule/manual/workflow and actor totals',()=>{
 const h=create({tasks:[task()]});change(h,'reschedule',{dueAt:future()});h.render();change(h,'replace',{}, {replacement:input()});h.render();const q=h.load('lib/crm/entity-queue.ts'),analytics=q.selectTaskAnalytics(h.store.tasks,h.store.auditEvents)
 assert.equal(analytics.rescheduleCount,1);assert.equal(analytics.replacementCount,1);assert.equal(analytics.cancellationCount,1);assert.equal(analytics.manualCreated,1);assert.equal(analytics.byActor['usr-test'],3)
})

test('invalid calendar dates and inactive/out-of-clinic assignees reject before mutations',()=>{
 const h=create({tasks:[task()]});for(const dueAt of ['2027-02-30T12:00','2027-01-01T25:00','tomorrow'])rejects(h,()=>h.store.createPatientTask(input({dueAt}),access()))
 const scoped={...access(),assignableUserScopes:{other:['pana-comfort']}};rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'reassign',reason:'Denied',patch:{ownerId:'other'}},scoped))
})
test('patient-care handoff remains pending until its receiving owner accepts',()=>{
 const cs=cases();cs[0].board='deals';cs[0].status='post_visit';const h=create({cases:cs});h.store.moveCase('c1','care','ignored',{ownerId:'other'},access());h.render();assert.equal(h.store.tasks[0].handoffState,'pending')
 const id=h.store.tasks[0].id;rejects(h,()=>h.store.changeTask(id,{caseId:'c1',action:'complete',reason:'Sender cannot accept'},access()))
 h.store.changeTask(id,{caseId:'c1',action:'complete',reason:'Receiving user accepts'},{...access('patient_care'),actorId:'other'});h.render();assert.equal(h.store.tasks[0].handoffState,'accepted')
})
test('booking emulator cannot silently complete a call-required task or mutate a foreign task',()=>{
 const h=create({tasks:[task({requiresCall:true}),task({id:'foreign',caseId:'c2',patientId:'p2'})]});rejects(h,()=>h.store.bookAppointment({caseId:'c1',taskId:'foreign',label:'Synthetic slot',actorId:'spoof'},access()))
 h.store.bookAppointment({caseId:'c1',taskId:'t1',label:'Synthetic slot',actorId:'spoof'},access());h.render();assert.equal(h.store.tasks[0].status,'ready');assert.equal(h.store.tasks[0].outcome,undefined)
})
test('explicit plan cancellation with failure reason records outcome without inventing a retry',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:1,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const task=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render()
 h.store.changeTask(task.id,{caseId:'c1',action:'cancel',reason:'No usable address; explicitly closed',outcome:'no_valid_channel'},access());h.render();assert.equal(h.store.tasks[0].outcome,'no_valid_channel');assert.equal(h.store.tasks[0].status,'cancelled');assert.equal(h.store.tasks.length,1)
})

test('phone wrap-up never claims a treatment plan was sent',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:2,status:'presented',items:[],date:'2026-01-01'};const h=create({patients:ps});const planTask=h.store.sendTreatmentPlanTask('p1','c1','ignored',access());h.render();h.scoped('admin');h.callRender()
 h.call.startOutgoingCall({caseId:'c1',taskId:planTask.id});h.callRender();h.call.hangUp();h.callRender();assert.equal(h.call.submitWrapUp('appointment_scheduled'),true);h.render();assert.equal(h.store.tasks[0].status,'planned');assert.equal(h.store.tasks[0].outcome,undefined)
})
test('invalid foreign/closed call task rejects before starting telephone state or audit',()=>{
 const h=create({tasks:[task({status:'completed'}),task({id:'foreign',caseId:'c2'})]});h.scoped('operator');h.callRender();const before=snapshot(h)
 assert.throws(()=>h.call.startOutgoingCall({caseId:'c1',taskId:'foreign'}));assert.throws(()=>h.call.startOutgoingCall({caseId:'c1',taskId:'t1'}));h.callRender();assert.equal(h.call.phase,'idle');assert.equal(snapshot(h),before)
})
test('legacy assign/priority/reopen APIs cannot substitute a default reason',()=>{
 const h=create({tasks:[task(),task({id:'done',status:'completed'})]}),a=access();for(const fn of [()=>h.store.assignTask('t1','other','spoofed',a),()=>h.store.setPriority('t1','P0','spoofed',a),()=>h.store.reopenTask('done',a)])rejects(h,fn)
})

test('suggested plan task retains workflow origin, snapshot and selected receiving owner',()=>{
 const ps=structuredClone(patients);ps[0].treatmentPlan={id:'plan',version:3,status:'presented',items:[],date:'2026-01-01'};const cs=cases();cs[0].board='patients';cs[0].status='new_patient';const h=create({patients:ps,cases:cs})
 h.store.moveCase('c1','in_treatment','ignored',{taskType:'send_treatment_plan',dueAt:future(),ownerId:'other'},access());h.render();assert.equal(h.store.tasks[0].source,'workflow');assert.equal(h.store.tasks[0].workflowRuleId,'patients.in_treatment.send_treatment_plan');assert.equal(h.store.tasks[0].treatmentPlanVersion,3);assert.equal(h.store.tasks[0].ownerId,'other')
})
test('plan command cannot read a Patient outside its medical clinic scope through a visible case',()=>{
 const ps=structuredClone(patients);ps[1].treatmentPlan={id:'foreign-plan',version:1,status:'presented',items:[],date:'2026-01-01'};const cs=cases();cs[0].patientId='p2';const h=create({patients:ps,cases:cs})
 rejects(h,()=>h.store.createPatientTask(input({type:'send_treatment_plan',channel:'email'}),access('clinic_manager')))
})

test('supervisor alternate custom stage task requires override reason and description atomically',()=>{
 const h=create(),opts={override:true,taskType:'custom',taskTitle:'Clinical coordination',taskDescription:'Coordinate the agreed operational handoff',dueAt:future(),reason:'Approved alternative'}
 rejects(h,()=>h.store.moveCase('c1','qualification','ignored',opts,access('operator')));rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{...opts,taskDescription:''},access()))
 h.store.moveCase('c1','qualification','ignored',opts,access());h.render();assert.equal(h.store.cases[0].status,'qualification');assert.equal(h.store.tasks[0].title,'Clinical coordination');assert.equal(h.store.tasks[0].type,'custom');assert.equal(h.store.tasks[0].source,'workflow');assert.equal(h.store.auditEvents[0].action,'override')
})

test('editing a custom call-required task preserves its type and mandatory wrap-up',()=>{
 const h=create({tasks:[task({type:'custom',requiresCall:true})]});change(h,'edit',{title:'Updated call purpose',description:'Updated description',type:'custom'});h.render();assert.equal(h.store.tasks[0].requiresCall,true);rejects(h,()=>change(h,'complete'))
})
test('first scheduling of an undated historical task establishes immutable original deadline',()=>{
 const h=create({tasks:[task({dueAt:undefined})]}),dueAt=future();change(h,'reschedule',{dueAt});h.render();assert.equal(h.store.tasks[0].originalDueAt,dueAt)
 change(h,'reschedule',{dueAt:future()});h.render();assert.equal(h.store.tasks[0].originalDueAt,dueAt)
})

test('clinic manager cannot mutate unassigned-clinic work outside its scoped case view',()=>{
 const cs=cases();cs[0].clinicId=undefined;const h=create({cases:cs,tasks:[task()]})
 rejects(h,()=>h.store.changeTask('t1',{caseId:'c1',action:'cancel',reason:'Not in clinic scope'},access('clinic_manager')))
 rejects(h,()=>h.store.moveCase('c1','qualification','ignored',{},access('clinic_manager')))
 rejects(h,()=>h.store.createPatientTask(input(),access('clinic_manager')))
})

test('missed-call callback enforces access and canonical patient and deduplicates retained commands',()=>{
 const h=create();rejects(h,()=>h.store.ensureMissedCallTask('c1','p1'));rejects(h,()=>h.store.ensureMissedCallTask('c1','p1',access('marketing')));rejects(h,()=>h.store.ensureMissedCallTask('missing',undefined,access()));rejects(h,()=>h.store.ensureMissedCallTask('c1','p2',access()));
 const command=h.store.ensureMissedCallTask;const first=command('c1','p1',access());const second=command('c1','p1',access());h.render();assert.equal(first.id,second.id);assert.equal(h.store.tasks.length,1);assert.equal(h.store.tasks[0].patientId,'p1');assert.equal(h.store.auditEvents[0].actorId,'usr-test')
})
