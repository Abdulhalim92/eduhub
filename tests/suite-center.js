// Регрессионный набор кабинета центра (eduhub.html). Запуск: sh tests/run.sh (Chrome headless поверх eduhub.html).
// Как и основной набор: настоящий слой api (mock) + DOM; задержка сети отключена, результат — <pre id="TESTOUT">.
(async function(){
 const R=[]; const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
 const out=()=>{ let d=document.getElementById('TESTOUT'); if(!d){d=document.createElement('pre'); d.id='TESTOUT'; document.body.appendChild(d);} d.textContent=R.join('\n'); };
 const goC=async(t,id,extra='')=>{ location.hash='#/'+routePath(t)+'?center='+id+extra; await renderRoute(); };
 const digitsOf=s=>String(s).replace(/\D/g,'');
 const txt=id=>document.getElementById(id).innerText;
 const rejects=async(p,code)=>{ try{ await p; return false; }catch(e){ return e instanceof ApiError && e.code===code ? e : false; } };
 try{
 await sleep(700);                       // дождаться bootstrap
 apiConfig.latencyMs=0;

 // ---- api: сотрудники (CTR-STF-010, BR-023) ----
 const st1=await api.cabinet.staff.list(9);
 ok('staff: Math Lab 4 of 5 on the free plan, can add', st1.meta.used===4 && st1.meta.limit===5 && st1.meta.canAdd===true && st1.total===4 && st1.counts.teacher===3 && st1.counts.admin===1);
 const add1=await api.cabinet.staff.add(9,{name:'Новый Сотрудник',role:'teacher',phone:'+992 90 777 77 77',login:'new.teacher'});
 ok('staff add: seat taken, limit reached, profile role counts follow the records', add1.role==='teacher' && (await api.cabinet.staff.list(9)).meta.canAdd===false && (await api.cabinet.profile(9)).profile.staffRoles.find(r=>r.key==='teacher').count===4);
 const lim=await rejects(api.cabinet.staff.add(9,{name:'Ещё Один',role:'admin',phone:'+992 90 888 88 88',login:'one.more'}),'CONFLICT');
 ok('staff add over the plan limit rejected (BR-023)', !!lim && lim.message.includes('Лимит'));
 ok('staff add validation: name, role, phone', Object.keys((await rejects(api.cabinet.staff.add(1,{name:'a',role:'x',phone:'1'}),'VALIDATION')).fields).join()==='name,role,phone,login');
 ok('staff add: duplicate phone in the same center rejected', !!(await rejects(api.cabinet.staff.add(9,{name:'Дубль Телефона',role:'admin',phone:add1.phone,login:'dup.phone'}),'VALIDATION')));
 ok('staff add: blocked center rejected', !!(await rejects(api.cabinet.staff.add(17,{name:'Из Блокировки',role:'admin',phone:'+992 90 999 99 99',login:'blocked.one'}),'CONFLICT')));
 ok('staff remove: reason required', !!(await rejects(api.cabinet.staff.remove(9,add1.id,{reason:'x'}),'VALIDATION')));
 await api.cabinet.staff.remove(9,add1.id,{reason:'Перешёл в другой центр'});
 ok('staff remove frees the seat and keeps the profile consistent', (await api.cabinet.staff.list(9)).meta.used===4 && (await api.cabinet.staff.list(9)).meta.canAdd===true && (await api.cabinet.profile(9)).profile.staffRoles.reduce((a,r)=>a+r.count,0)===4);
 ok('staff remove: another center cannot remove the record', !!(await rejects(api.cabinet.staff.remove(1,add1.id,{reason:'Чужой сотрудник'}),'NOT_FOUND')));
 const aud=await api.audit.list({q:'Math Lab'});
 ok('audit: staff.added and staff.removed are logged', ['staff.added','staff.removed'].every(a=>aud.items.some(e=>e.action===a)));
 ok('staff list: role filter, search, pagination', (await api.cabinet.staff.list(1,{role:'admin'})).total+(await api.cabinet.staff.list(1,{role:'teacher'})).total===14 && (await api.cabinet.staff.list(1,{role:'admin'})).total>0 && (await api.cabinet.staff.list(1,{q:'zzzz'})).total===0 && (await api.cabinet.staff.list(1,{page:2,pageSize:10})).items.length===4 && (await api.cabinet.staff.list(1)).items.length===10);
 // ---- api: счета центра ----
 ok('center invoices: another center cannot pay a foreign invoice', !!(await rejects(api.cabinet.invoices.payOnline(1,'INV-1043'),'FORBIDDEN')));
 // ---- api: дашборд, пользователи, группы, поощрения, правила coin, аналитика ----
 const db9=await api.cabinet.dashboard(9);
 ok('dashboard: Math Lab KPIs (48 students, 3 teachers, 4 groups) and a 7-day week', db9.kpis.students===48 && db9.kpis.teachers===3 && db9.kpis.groupsActive===4 && db9.week.length===7);
 ok('dashboard: profile students equal the student records for every center', (await Promise.all([1,5,7,17,29].map(async id=>(await api.cabinet.dashboard(id)).kpis.students===(await api.cabinet.profile(id)).profile.students))).every(Boolean));
 const us0=await api.cabinet.users.list(9);
 ok('users: staff and students in one list (4 staff + 48 students), role filter, search by phone digits', us0.total===52 && (await api.cabinet.users.list(9,{role:'student'})).total===48 && (await api.cabinet.users.list(9,{role:'teacher'})).total===3 && (await api.cabinet.users.list(9,{q:digitsOf(us0.items[0].phone)})).total>=1);
 const stu=await api.cabinet.users.add(9,{name:'Тест Ученик',phone:'+992 90 555 44 33',login:'test.student'});
 ok('users add: student created, profile counter follows', stu.name==='Тест Ученик' && (await api.cabinet.profile(9)).profile.students===49 && (await api.cabinet.users.list(9,{role:'student'})).total===49);
 ok('users add: duplicate phone and bad name rejected', !!(await rejects(api.cabinet.users.add(9,{name:'Дубль',phone:stu.phone,login:'dup.student'}),'VALIDATION')) && Object.keys((await rejects(api.cabinet.users.add(9,{name:'a',phone:'1'}),'VALIDATION')).fields).join()==='name,phone,login');
 ok('users add: blocked center rejected', !!(await rejects(api.cabinet.users.add(17,{name:'Из Блокировки',phone:'+992 90 111 22 33',login:'blocked.student'}),'CONFLICT')));
 ok('users block: reason required', !!(await rejects(api.cabinet.users.setStatus(9,stu.id,{status:'blocked',reason:'x'}),'VALIDATION')));
 await api.cabinet.users.setStatus(9,stu.id,{status:'blocked',reason:'Долгое отсутствие'});
 ok('users block: status changes, second block conflicts, audit has the entry', (await api.cabinet.users.list(9,{q:'Тест Ученик'})).items[0].status==='blocked' && !!(await rejects(api.cabinet.users.setStatus(9,stu.id,{status:'blocked',reason:'Ещё раз'}),'CONFLICT')) && (await api.audit.list({q:'Math Lab'})).items.some(e=>e.action==='student.blocked'));
 await api.cabinet.users.setStatus(9,stu.id,{status:'active',reason:'Вопрос урегулирован'});
 const g9=await api.cabinet.groups.list(9);
 ok('groups: 4 groups with teachers, branches, filters from api', g9.total===4 && g9.options.teachers.length===3 && g9.items.every(g=>g.teacher!=='—' && g.branch) && (await api.cabinet.groups.list(9,{status:'archived'})).total===0);
 const gOk={name:'Тестовая группа',course:'Golang',branch:g9.options.branches[0],teacherId:g9.options.teachers[0].id,schedule:'Пн, Ср, Пт',startTime:'21:00',durationMin:90,hwPoints:10,visitPoints:1,examDay:0,examPoints:100,capacity:2,startsAt:'2026-09-01',endsAt:'2026-12-01'};
 ok('groups create: validation (dates, foreign teacher)', Object.keys((await rejects(api.cabinet.groups.create(9,{...gOk,endsAt:'2026-08-01',teacherId:(await api.cabinet.groups.list(1)).options.teachers[0].id}),'VALIDATION')).fields).sort().join()==='endsAt,teacherId');
 const ng=await api.cabinet.groups.create(9,gOk);
 ok('groups create: new active group, empty, in the list', ng.status==='active' && ng.members===0 && (await api.cabinet.groups.list(9)).total===5);
 const free=(await api.cabinet.analytics.list(9,{pageSize:100})).items.filter(s=>s.status==='active').slice(0,3);
 await api.cabinet.groups.addStudent(9,ng.id,free[0].id); await api.cabinet.groups.addStudent(9,ng.id,free[1].id);
 ok('groups: capacity respected (2 of 2), third student rejected', !!(await rejects(api.cabinet.groups.addStudent(9,ng.id,free[2].id),'CONFLICT')) && (await api.cabinet.groups.get(9,ng.id)).group.members===2);
 ok('groups: capacity cannot drop below the roster', !!(await rejects(api.cabinet.groups.update(9,ng.id,{...gOk,capacity:1}),'VALIDATION')));
 await api.cabinet.groups.removeStudent(9,ng.id,free[0].id);
 ok('groups: removing a student frees a seat, student stays in the center', (await api.cabinet.groups.get(9,ng.id)).group.members===1 && (await api.cabinet.users.list(9,{role:'student'})).total===49);
 await api.cabinet.groups.update(9,ng.id,{...gOk,status:'archived'});
 ok('groups: archived group rejects roster changes', !!(await rejects(api.cabinet.groups.addStudent(9,ng.id,free[2].id),'CONFLICT')) && (await api.cabinet.groups.list(9,{status:'archived'})).total===1);
 ok('groups: another center cannot read the group', !!(await rejects(api.cabinet.groups.get(1,ng.id),'NOT_FOUND')));
 const cr9=await api.cabinet.coinRules.list(9);
 ok('points rules: 2 seeded with conditions, scope filter', cr9.total===2 && cr9.items[0].condition==='Средний % ≥ 90' && (await api.cabinet.coinRules.list(9,{scope:'course'})).total===1);
 ok('points rules: validation (threshold 101) and toggle', !!(await rejects(api.cabinet.coinRules.create(9,{name:'Правило',scope:'academy',threshold:101,coin:10}),'VALIDATION')) && (await api.cabinet.coinRules.update(9,cr9.items[0].id,{active:false})).active===false);
 const an=await api.cabinet.analytics.list(9,{coinFrom:100,coinTo:200});
 ok('analytics: points range filter and totals', an.items.length>0 && an.items.every(s=>s.coin>=100 && s.coin<=200) && an.totals.students===49 && an.totals.coin>0);

 // ---- api: логины и пароли, расписание, состав центра ----
 const cr=add1.credentials;
 ok('staff add: admin-chosen login kept, generated one-time password of 10 safe chars', cr.login==='new.teacher' && /^[a-hj-km-np-zA-HJ-NP-Z2-9]{10}$/.test(cr.password) && cr.mustChange===true);
 ok('staff add: password never returned later and not in the audit', !JSON.stringify(await api.cabinet.staff.list(9)).includes(cr.password) && !JSON.stringify((await api.audit.list({q:'Math Lab'})).items).includes(cr.password));
 ok('staff remove: the dismissed person login is freed for reuse', !!(await api.cabinet.users.add(14,{name:'Освободившийся Логин',phone:'+992 90 202 02 02',login:'new.teacher'})));
 ok('login: format and uniqueness across the platform (BR-025)', (await rejects(api.cabinet.users.add(14,{name:'Чужой Логин',phone:'+992 90 101 01 01',login:'TEST.student'}),'VALIDATION')).fields.login.includes('занят') && (await rejects(api.cabinet.users.add(14,{name:'Плохой Логин',phone:'+992 90 101 01 02',login:'а б'}),'VALIDATION')).fields.login.includes('4 до 32'));
 const sch9=await api.cabinet.schedule(9);
 ok('schedule: 7 days, lessons of active groups only, sorted by start time', sch9.days.length===7 && sch9.totals.groups===4 && sch9.days.every(d=>d.lessons.every((l,i,a)=>i===0||a[i-1].start<=l.start)));
 ok('schedule: filters by branch and teacher', (await api.cabinet.schedule(9,{teacherId:sch9.options.teachers[0].id})).totals.groups<=sch9.totals.groups && (await api.cabinet.schedule(9,{branch:'нет такого'})).totals.lessons===0);
 const noClash=(await Promise.all(Array.from({length:29},(_,i)=>api.cabinet.schedule(i+1)))).every(r=>r.days.every(d=>d.lessons.every((l,i)=>d.lessons.every((m,j)=>i===j||l.teacherId!==m.teacherId||l.end<=m.start||m.end<=l.start))));
 ok('schedule: seeded lessons of one teacher never overlap in any of the 29 centers (BR-024)', noClash);
 const gl=await api.cabinet.groups.list(9), g0=gl.items[0];
 const gBase={course:'Golang',branch:gl.options.branches[0],hwPoints:1,visitPoints:1,examDay:0,examPoints:1,capacity:5,startsAt:'2026-09-01',endsAt:'2026-12-01'};
 const clash=await rejects(api.cabinet.groups.create(9,{...gBase,name:'Конфликтная',teacherId:g0.teacherId,schedule:g0.schedule,startTime:g0.startTime,durationMin:60}),'VALIDATION');
 ok('groups: a teacher cannot have two lessons at the same time (BR-024)', !!clash && clash.fields.startTime.includes('Преподаватель занят'));
 ok('groups: time and duration validated', Object.keys((await rejects(api.cabinet.groups.create(9,{...gBase,name:'Время',teacherId:g0.teacherId,schedule:g0.schedule,startTime:'25:00',durationMin:10}),'VALIDATION')).fields).join()==='startTime,durationMin');
 const pe=await api.centers.people(9,{section:'students'});
 ok('platform people: counts, students without phones, sections validated', pe.counts.students>=48 && pe.counts.groups>=4 && !JSON.stringify(pe.items).includes('+992') && !!(await rejects(api.centers.people(9,{section:'x'}),'VALIDATION')) && (await api.centers.people(9,{section:'staff'})).total===pe.counts.staff);
 // ---- api: подключённый центр получает пустой профиль ----
 const nc=await api.centers.create({name:'Новый Тестовый Центр',city:'Душанбе',address:'ул. Рудаки, 1',phone:'+992 90 123 45 67',ownerName:'Тест Владелец',ownerPhone:'+992 90 765 43 21',terms:true});
 const ncp=await api.cabinet.profile(nc.id);
 ok('new center: admin login is the owner phone, one-time password of 10 safe chars, must change on first login', nc.credentials.login==='992907654321' && /^[a-hj-km-np-zA-HJ-NP-Z2-9]{10}$/.test(nc.credentials.password) && nc.credentials.mustChange===true);
 ok('new center: password never comes back from the api and is not stored in clear', !JSON.stringify(await api.cabinet.profile(nc.id)).includes(nc.credentials.password) && !JSON.stringify(await api.centers.list({pageSize:100})).includes(nc.credentials.password));
 ok('new center: issuing credentials is audited without the password', (await api.audit.list({q:'Новый Тестовый Центр'})).items.some(e=>e.action==='center.credentials' && !JSON.stringify(e).includes(nc.credentials.password)));
 const nc2=await api.centers.create({name:'Второй Тестовый Центр',city:'Душанбе',address:'ул. Рудаки, 2',phone:'+992 90 123 45 68',ownerName:'Тот Же Владелец',ownerPhone:'+992 90 765 43 21',terms:true});
 ok('new center: a repeated owner phone gets a distinct login and a different password', nc2.credentials.login==='center'+nc2.id && nc2.credentials.password!==nc.credentials.password);
 ok('new center: default profile (no direction, zero students, default logo) and an empty staff list', ncp.profile.direction.includes('не указано') && ncp.profile.students===0 && ncp.profile.logo.includes('logo-default') && (await api.cabinet.staff.list(nc.id)).total===0 && (await api.cabinet.profileCenters()).items.some(x=>x.id===nc.id));

 // ---- оболочка: вкладки, центр в адресе, режим поддержки ----
 await goC('profile',7); await sleep(400);
 ok('profile: opens the center from the address with the "у лимита" flag', txt('view-profile').includes('Sitora Kids') && txt('view-profile').includes('У лимита') && document.getElementById('nav-profile').classList.contains('text-brand') && txt('pageTitle')==='Профиль центра');
 ok('sidebar shows the current center and its plan', txt('sideCenterName')==='Sitora Kids' && txt('sideCenterPlan').includes('Про') && document.getElementById('sideCenterLogo').getAttribute('src').includes('logo-7'));
 ok('menu: eleven tabs, the center id is kept in every link', document.querySelectorAll('#centerNav a').length===11 && [...document.querySelectorAll('#centerNav a')].every(a=>a.getAttribute('href').includes('center=7')));
 ok('support banner is hidden when the cabinet is opened directly', document.getElementById('supportBanner').classList.contains('hidden'));
 for (const t of ['center-dashboard','profile','center-users','center-staff','center-branches','center-courses','center-groups','center-schedule','center-coin-rules','center-analytics','center-balance']) { await goC(t,1); await sleep(500); const el=document.getElementById('view-'+t); ok('tab '+t+' renders without error', !el.classList.contains('hidden') && el.innerText.length>60 && !/Не удалось загрузить/.test(el.innerText)); }
 openCenter(5); await sleep(500);
 ok('switching the center keeps the tab and changes the address and data', location.hash.includes('center=5') && currentTab==='center-balance' && selectedCenterId===5 && txt('view-center-balance').includes('-150'));
 await goC('profile',5); await sleep(400);
 ok('overdraft center: status "В овердрафте"', txt('view-profile').includes('В овердрафте') && txt('view-profile').includes('Умед Плюс'));
 await goC('profile',17); await sleep(400);
 ok('blocked center: banner and status on the profile', txt('view-profile').includes('Центр заблокирован') && txt('view-profile').includes('Заблокирован'));
 await goC('profile',3,'&support=1'); await sleep(400);
 ok('support mode: banner with the center name and the flag kept in menu links', !document.getElementById('supportBanner').classList.contains('hidden') && txt('supportCenterName')==='Alpha School' && supportMode===true && [...document.querySelectorAll('#centerNav a')].every(a=>a.getAttribute('href').includes('support=1')));
 switchTab('center-staff'); await sleep(500);
 ok('support mode persists between the cabinet screens', supportMode===true && currentTab==='center-staff' && location.hash.includes('support=1') && !document.getElementById('supportBanner').classList.contains('hidden'));
 await goC('profile',3); await sleep(300);
 ok('without the flag the banner is hidden again', document.getElementById('supportBanner').classList.contains('hidden'));

 // ---- UI: сотрудники ----
 await goC('center-staff',1); await sleep(500);
 ok('staff UI: 10 rows on the first page, pager "из 14", limit 14 of 100', document.querySelectorAll('#stfRows tr').length===10 && txt('stfPager').includes('из 14') && txt('stfLimit').includes('14 из 100'));
 setStaffRole('admin'); await sleep(400);
 ok('staff UI: role chip filters the list and shows reset', document.querySelectorAll('#stfRows tr').length===(await api.cabinet.staff.list(1,{role:'admin'})).total && !document.getElementById('stfReset').classList.contains('hidden'));
 resetStaffFilters(); await sleep(400);
 ok('staff UI: reset returns the full list', document.querySelectorAll('#stfRows tr').length===10 && document.getElementById('stfReset').classList.contains('hidden'));
 stfState.q='zzzz'; await renderStaff(); await sleep(100);
 ok('staff UI: empty state for a search without matches', txt('stfRows').includes('сотрудников нет')); resetStaffFilters(); await sleep(300);
 await goC('center-staff',9); await sleep(500);
 ok('staff UI: Math Lab 4 of 5, add button is shown', txt('stfLimit').includes('4 из 5') && txt('stfAction').includes('Добавить сотрудника'));
 openStaffAdd(); await sleep(50); await formSubmit(); await sleep(60);
 ok('staff add form: server validation inline', !!document.getElementById('err-form-name') && !!document.getElementById('err-form-phone'));
 formSet('name','Тестовый Преподаватель'); formSet('phone','+992 90 555 44 33'); formSet('login','test.prepod'); await formSubmit(); await sleep(500);
 ok('staff added from the UI: credentials dialog shows the login and a one-time password', txt('modalBox').includes('test.prepod') && /[a-zA-Z2-9]{10}/.test(txt('crPassword'))); closeModal();
 ok('staff added from the UI: row appears, limit 5 of 5 "Лимит исчерпан", add button replaced by the notice', txt('stfRows').includes('Тестовый Преподаватель') && txt('stfLimit').includes('5 из 5') && txt('stfLimit').includes('Лимит исчерпан') && !txt('stfAction').includes('Добавить сотрудника') && txt('stfAction').includes('Лимит тарифа исчерпан'));
 const newStaff=(await api.cabinet.staff.list(9,{q:'Тестовый'})).items[0];
 openStaffRemove(newStaff.id,newStaff.name); await sleep(50); await formSubmit(); await sleep(60);
 ok('staff remove form: reason is required', !!document.getElementById('err-form-reason'));
 formSet('reason','Закончился договор'); await formSubmit(); await sleep(500);
 ok('staff removed from the UI: seat freed, add button is back', !txt('stfRows').includes('Тестовый Преподаватель') && txt('stfLimit').includes('4 из 5') && txt('stfAction').includes('Добавить сотрудника'));

 // ---- UI: баланс и счета ----
 const inv4=await api.centers.invoice(4);
 await goC('center-balance',4); await sleep(500);
 ok('balance UI: tiles, open invoice with "Оплатить онлайн", ledger', txt('cbBody').includes('Баланс на платформе') && txt('cbBody').includes('Открытые счета') && txt('cbBody').includes('Оплатить онлайн') && txt('cbBody').includes('Журнал операций'));
 const invId=(await api.finance.get(4)).invoices[0].id;
 openCbPay(invId); await sleep(60);
 ok('pay dialog shows the amount and the consequence before confirming', txt('modalBox').includes('Подписка будет продлена') && txt('modalBox').includes('не отменяется'));
 await formSubmit(); await sleep(600);
 ok('invoice paid online from the cabinet: open invoices empty, ledger notice, platform sees it paid', txt('cbBody').includes('Открытых счетов нет') && (await api.finance.get(4)).invoices.length===0 && (await api.billing.get(invId)).status==='paid');
 const pay2=await rejects(api.cabinet.invoices.payOnline(4,invId),'CONFLICT'); ok('paid invoice cannot be paid twice', !!pay2);

 // ---- UI: филиалы кабинета (перенесено из основного набора) ----
 await goC('center-branches',1); await sleep(300);
 ok('branches tab: opens for the center from the address and highlights its menu item', currentTab==='center-branches' && selectedCenterId===1 && document.getElementById('nav-center-branches').classList.contains('text-brand'));
 ok('cabinet UI: own requests with status badges + "how it works" steps', document.getElementById('brBody').innerText.includes('Филиал «Сино»') && /На модерации|Опубликован на карте/.test(document.getElementById('brBody').innerText) && document.getElementById('brSteps').innerText.includes('Модерация проверяет'));
 openBranchForm(); await sleep(50);
 ok('branch form opens in the panel, city and phone prefilled from the center', panelIsOpen() && panelKind==='branch' && document.getElementById('br-city').value==='Душанбе' && document.getElementById('br-phone').value.includes('992'));
 await brSubmit(); await sleep(30);
 ok('branch form: server validation inline (name, address, coordinates, RU description)', !!document.getElementById('err-br-branch') && !!document.getElementById('err-br-address') && !!document.getElementById('err-br-gps') && !!document.getElementById('err-br-descRu'));
 brField('branch','Филиал «Фирдавси-2»'); brField('address','пр. Айни, 77'); await brGeocode();
 ok('"Определить по адресу" fills the coordinates (geocoder mock)', document.getElementById('br-lat').value!=='' && document.getElementById('br-lng').value!=='');
 brField('ru','Описание нового филиала на русском языке, достаточно длинное'); const attB=(await api.platform.attention()).moderation; await brSubmit(); await sleep(150);
 ok('branch submitted: panel closed, row "На модерации" appears, moderation badge +1', !panelIsOpen() && document.getElementById('brBody').innerText.includes('Фирдавси-2') && (await api.platform.attention()).moderation===attB+1);
 const newReq=(await api.cabinet.branches.list(1)).items.find(r=>r.branch.includes('Фирдавси-2'));
 await api.moderation.decide(newReq.id,{decision:'returned',reason:'Укажите описание на таджикском языке'}); await renderBranches(); await sleep(60);
 ok('returned request: status "Возвращён на доработку", moderator comment and "Исправить и отправить" button', document.getElementById('brBody').innerText.includes('Возвращён на доработку') && document.getElementById('brBody').innerText.includes('таджикском') && document.getElementById('brBody').innerText.includes('Исправить и отправить'));
 openBranchForm(newReq.id); await sleep(40);
 ok('returned request opens editable with the moderator comment on top and "Отправить повторно"', document.getElementById('panelBox').innerText.includes('Модерация вернула заявку') && document.getElementById('panelBox').innerText.includes('Отправить повторно') && !document.getElementById('br-branch').disabled);
 brField('tj','Тавсифи филиали нав бо забони тоҷикӣ, ба қадри кофӣ дароз'); await brSubmit(); await sleep(150);
 ok('resubmitted from the UI: back to "На модерации"', !panelIsOpen() && (await api.cabinet.branches.list(1)).items.find(r=>r.id===newReq.id).status==='pending');
 openBranchForm((await api.cabinet.branches.list(1)).items.find(r=>r.id===newReq.id).id); await sleep(40);
 ok('pending request opens read-only (cannot be edited while on moderation)', document.getElementById('br-branch').disabled===true && document.getElementById('panelBox').innerText.includes('изменить её нельзя'));

 closePanel();

 // ---- UI: материалы и курсы (перенесено из основного набора) ----
  ccState.tab='mine'; await goC('center-courses',1); await sleep(350);
  ok('cabinet: four tabs, "Мои методики" shows the purchased courses', document.querySelectorAll('#ccTabs button').length===4 && document.querySelectorAll('#ccBody > div > div').length===2 && document.getElementById('view-center-courses').innerText.includes('получен') && document.getElementById('nav-center-courses').classList.contains('text-brand'));
  selectedCenterId=29; await renderCenterCourses(); await sleep(250);
  ok('cabinet: a center without courses sees an honest empty state', document.getElementById('ccBody').innerText.includes('Методик пока нет'));
  ccState.tab='catalog'; await goC('center-courses',2); await sleep(400);
  ok('cabinet catalog: cards with price and "Подать заявку" or a status', document.querySelectorAll('#ccBody > div > div').length>=3 && /Подать заявку|Заявка подана|Уже у вас|Ожидает оплаты/.test(document.getElementById('ccBody').innerText));
  setCcTab('requests'); await sleep(350);
  ok('cabinet requests tab lists requests with statuses', document.getElementById('ccBody').innerText.includes('Заявка') || document.getElementById('ccBody').innerText.includes('Курс'));
  setCcTab('own'); await sleep(350);
  ok('cabinet "Мои курсы": create button in the header', document.getElementById('ccAction').innerText.includes('Создать курс'));
  ccCreateOwn(); await sleep(80); formSet('title','Курс центра для теста'); formSet('direction','Творчество'); formSet('description','Наш собственный курс'); await formSubmit(); await sleep(500);
  ok('own course created in the cabinet opens its page on the program tab with edit rights', location.hash.includes('center-course') && cpData.center && cpData.center.kind==='own' && cpData.center.canEdit && document.getElementById('cpcBody').innerText.includes('Добавить модуль'));
  cpAddModule('center'); await sleep(80); formSet('title','Первый модуль'); await formSubmit(); await sleep(300);
  ok('center edits its own course: module appears (no audit noise for center courses)', document.getElementById('cpcBody').innerText.includes('Первый модуль'));
  const myId=cpData.center.course.id;
  const eFo=await rejects(api.courses.addModule(myId,{title:'Чужой'},{centerId:1}),'FORBIDDEN'); ok('another center cannot edit a center course', !!eFo);
  const ePl=await rejects(api.courses.addModule(myId,{title:'Платформа'}),'FORBIDDEN'); ok('SuperAdmin cannot manage a center course either', !!ePl);
  const eRo=await rejects(api.courses.addModule(1,{title:'Купленный'},{centerId:1}),'FORBIDDEN'); ok('a purchased course is read-only for the center', !!eRo);
  ok('center courses never appear in the platform marketplace', !(await api.marketplace.list({q:'Курс центра для теста'})).items.length);
  openCenterCourse(2); await sleep(450);   // центр 2 владеет курсом «Подготовка к НЦТ» (демо-данные)
  ok('purchased course opens read-only: program visible, no editing controls, version note', cpData.center.kind==='purchased' && !cpData.center.canEdit && !document.getElementById('cpcBody').innerText.includes('Добавить модуль') && document.getElementById('cpcHead').innerText.includes('Куплен'));
  // ---- UI: дашборд, пользователи, группы, поощрения, правила, аналитика ----
  await goC('center-dashboard',9); await sleep(500);
  ok('dashboard UI: tiles and sections', ['Всего учеников','Группы с низкой заполненностью','Посещаемость по дням недели','Ближайшие занятия','Филиалы'].every(t=>txt('view-center-dashboard').includes(t)));
  await goC('center-users',9); await sleep(500);
  ok('users UI: 10 rows on the first page, pager, role filter works', document.querySelectorAll('#usrRows tr').length===10 && txt('usrPager').includes('из') && (setUsrRole('teacher'), await sleep(400), document.querySelectorAll('#usrRows tr').length===3));
  resetUsrFilters(); await sleep(300);
  await goC('center-groups',9); await sleep(500);
  ok('groups UI: rows with teacher and seats, add button', document.querySelectorAll('#grpRows tr').length===5 && txt('grpHead').includes('Добавить группу'));
  await goC('center-group',9,'&group='+ng.id); await sleep(500);
  ok('group page UI: assessment block, roster, back link', ['Система оценивания','Ученики','ДЗ / день','Назад'].every(t=>txt('view-center-group').includes(t)) && !!document.querySelector('#view-center-group a[href^="#/center-groups"]'));
  await goC(9); await sleep(500);
  await goC('center-coin-rules',9); await sleep(500);
  ok('points rules UI: condition and status shown', txt('view-center-coin-rules').includes('Средний % ≥ 90') && txt('view-center-coin-rules').includes('Выключено'));
  await goC('center-analytics',9); await sleep(500);
  ok('analytics UI: totals and ranking', txt('view-center-analytics').includes('Баллов выдано') && document.querySelectorAll('#anlRows tr').length===10);
  await goC('center-groups',17); await sleep(500);
  ok('blocked center: no create buttons, a note instead', !txt('grpHead').includes('Добавить группу') && txt('grpHead').includes('заблокирован'));
  await goC('center-users',17); await sleep(400);
  ok('empty center: empty state, not an error', txt('usrRows').includes('нет пользователей') && !txt('usrRows').includes('Не удалось'));
  await goC('center-schedule',9); await sleep(500);
  ok('schedule UI: seven day columns with lessons and filters', ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].every(d=>txt('schBody').includes(d)) && document.querySelectorAll('#schBody a[href*="center-group"]').length>=4 && txt('schFilters').includes('Преподаватель'));
  await goC('center-group',9,'&group='+ng.id); await sleep(500);
  ok('group page UI: lesson time shown next to the days', /\d\d:\d\d–\d\d:\d\d/.test(txt('gdBody')));
 }catch(e){ R.push('EXC '+e.message+' | '+(e.stack||'').split('\n')[1]); }
 out();
})();
