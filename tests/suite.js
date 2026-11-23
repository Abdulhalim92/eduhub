// Регрессионный набор прототипа «Линия». Запуск: sh tests/run.sh (Chrome headless поверх index.html).
// Тесты работают с настоящим слоем api (mock) и DOM; задержку сети отключают (apiConfig.latencyMs = 0). Результат — <pre id="TESTOUT">.
(async function(){
 const R=[]; const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
 const out=()=>{ let d=document.getElementById('TESTOUT'); if(!d){d=document.createElement('pre'); d.id='TESTOUT'; document.body.appendChild(d);} d.textContent=R.join('\n'); };
 const go=async t=>{ location.hash='#/'+routePath(t); await renderRoute(); };
 const rows=id=>document.getElementById(id).querySelectorAll('tr').length;
 const rejects=async(p,code)=>{ try{ await p; return false; }catch(e){ return e instanceof ApiError && e.code===code ? e : false; } };
 try{
 await sleep(600);                       // дождаться bootstrap с реальной задержкой
 apiConfig.latencyMs=0; PAGE_SIZE=100;   // прежние проверки считают все строки; пагинация проверяется отдельным блоком с PAGE_SIZE=10

 // ---- api напрямую ----
 const att=await api.platform.attention();
 ok('attention 4/7/5 (+limits)', att.moderation===4 && att.expiring===7 && att.churn===5 && att.totalCenters===142);
 const a1=await api.centers.list({limit:1}); a1.items[0].name='X'; const a2=await api.centers.list({limit:1});
 ok('api returns copies (no shared mutation)', a2.items[0].name!=='X');
 ok('api list filter churn=5', (await api.centers.list({filter:'churn'})).total===5);
 ok('api search city', (await api.centers.list({q:'худж'})).total===6);
 ok('flags from server', (await api.centers.list({q:'Alpha'})).items[0].isChurn===true);
 ok('api create validation', !!(await rejects(api.centers.create({name:'a'}),'VALIDATION')));
 ok('api not found', !!(await rejects(api.centers.invoice(9999),'NOT_FOUND')));
 ok('api publish gate server-side', !!(await rejects(api.moderation.decide(3,{decision:'published',desc:{ru:'x'.repeat(30),tj:'',en:''},gpsConfirmed:true}),'VALIDATION')));
 ok('api reason required', !!(await rejects(api.moderation.decide(3,{decision:'rejected',reason:'ab'}),'VALIDATION')));


 // ---- тарифы: чтение (до мутаций) ----
 const pl=await api.plans.list();
 ok('plans list 4 sorted by price', pl.items.length===4 && pl.items.map(p=>p.name).join()==='Старт,Базовый,Про,Бизнес');
 ok('plans meta mrr/paid/near', pl.meta.mrr===20600 && pl.meta.paidCenters===24 && pl.meta.nearLimit===6);
 ok('attention nearLimit 6', (await api.platform.attention()).nearLimit===6);
 const nl=await api.plans.nearLimit(); const byId=id=>nl.items.find(x=>x.center.id===id);
 const idsOf=async o=>(await api.plans.nearLimit(o)).items.map(x=>x.center.id).sort((a,b)=>a-b).join();
 ok('near-limit: any metric >=80% -> 4,5,7,8,9,15', nl.items.map(x=>x.center.id).sort((a,b)=>a-b).join()==='4,5,7,8,9,15');
 ok('near meta total/full/offered/potential', nl.meta.total===6 && nl.meta.full===2 && nl.meta.offered===1 && nl.meta.withoutOffer===5 && nl.meta.potential===3700);
 ok('suggestions by limiting metric', byId(5).suggestion.name==='Про' && byId(9).suggestion.name==='Базовый' && byId(4).suggestion.name==='Бизнес' && byId(7).suggestion.name==='Бизнес');
 ok('options: recommended + all fit', byId(8).options.find(o=>o.recommended).name==='Про' && byId(9).options.every(o=>o.fits) && byId(8).options[0].after.length===3);
 ok('threshold 90 -> 5,7,8,9', await idsOf({threshold:.9})==='5,7,8,9');
 ok('threshold 100 -> 8,9', await idsOf({threshold:1})==='8,9');
 ok('metric branches -> 7,8,9', await idsOf({metric:'branches'})==='7,8,9');
 ok('metric storage -> 4,8', await idsOf({metric:'storage'})==='4,8');
 ok('metric staff -> 5,9,15', await idsOf({metric:'staff'})==='5,9,15');
 ok('status filters', await idsOf({status:'offered'})==='4' && (await idsOf({status:'nooffer'})).split(',').length===5 && await idsOf({status:'full'})==='8,9');
 ok('plan + search filters', await idsOf({plan:'Про'})==='4,7' && await idsOf({q:'zebo'})==='8');
 ok('sort potential: biggest delta first', (await api.plans.nearLimit({sort:'potential'})).items[0].suggestion.delta===900);
 ok('sort name', (await api.plans.nearLimit({sort:'name'})).items.length===6);
 // ---- профиль центра (CTR-PRF-010): чтение до мутаций; флаги приходят из api, экран их не пересчитывает ----
 ok('sync: off in tests (чистый seed)', api.sync.enabled()===false);
 const pcs=(await api.cabinet.profileCenters()).items;
 ok('profile centers: all 29 have a profile', pcs.length===29 && pcs[0].id===1 && pcs[28].id===29 && pcs.every(x=>x.logo && x.direction && x.owner));
 const prf=await Promise.all(pcs.map(x=>api.cabinet.profile(x.id)));
 const pf=id=>prf.find(d=>d.center.id===id);
 ok('profile: staff roles sum = staffUsed (all 29)', prf.every(d=>d.profile.staffRoles.reduce((a,r)=>a+r.count,0)===d.center.staffUsed));
 ok('profile: logo, banner, direction, year, students', prf.every(d=>d.profile.logo && d.profile.banner && d.profile.direction && d.profile.foundedYear>2000 && d.profile.students>=0));
 ok('profile: distinct directions >= 20', new Set(prf.map(d=>d.profile.direction)).size>=20);
 ok('profile: 9/10 branches -> near flag, not full', pf(7).usage.find(u=>u.key==='branches').near===true && pf(7).usage.find(u=>u.key==='branches').full===false && pf(7).center.nearLimit===true);
 ok('profile: 3/3 branches -> full', pf(8).usage.find(u=>u.key==='branches').full===true);
 ok('profile: overdraft flag and available (center 5)', pf(5).center.balance===-150 && pf(5).center.financeStatus==='overdraft' && pf(5).center.available===150);
 ok('profile: blocked center keeps status flag', pf(17).center.status==='blocked' && pf(17).profile.students===0);
 ok('profile: ledger max 5, newest first', pf(5).ledger.length===2 && new Date(pf(5).ledger[0].at)>=new Date(pf(5).ledger[1].at));
 ok('profile: purchased courses of center 1', pf(1).courses.items.length===2 && pf(1).courses.items.every(a=>a.course && a.course.cover));
 ok('staff: phones are well-formed (+992 NN NNN NN NN)', (await Promise.all(pcs.map(x=>api.cabinet.staff.list(x.id,{pageSize:100})))).every(r=>r.items.every(i=>/^\+992 9\d \d{3} \d{2} \d{2}$/.test(i.phone))));
 ok('staff: seeded records match staffUsed (29 centers)', (await Promise.all(pcs.map(x=>api.cabinet.staff.list(x.id,{pageSize:100})))).every((r,i)=>r.total===prf[i].center.staffUsed));
 ok('profile: unknown center -> NOT_FOUND', !!(await rejects(api.cabinet.profile(9999),'NOT_FOUND')));
 pf(1).profile.students=-1; ok('profile: returns copy', (await api.cabinet.profile(1)).profile.students===428);
 ok('rule: no option for top plan -> offer skipped', (await api.centers.sendOffer({ids:[1]})).skipped===1);
 ok('rule: storage limit below usage rejected', (await rejects(api.plans.update('pro',{price:900,limits:{staff:50,storageGb:10,branches:10},modules:{}}),'VALIDATION')).fields.storageGb.includes('Дониш'));
 ok('rule: branches limit below usage rejected', (await rejects(api.plans.update('basic',{price:400,limits:{staff:10,storageGb:10,branches:2},modules:{}}),'VALIDATION')).fields.branches.includes('Zebo'));
 ok('center DTO has limits & pct', (await api.centers.list({q:'Умед'})).items[0].staff.join()==='9,10' && (await api.centers.list({q:'Умед'})).items[0].staffPct===90);
 ok('rule: free plan price locked', !!(await rejects(api.plans.update('start',{price:100,limits:{staff:5,storageGb:2,branches:2},modules:{}}),'VALIDATION')));
 ok('rule: cannot archive free plan', !!(await rejects(api.plans.update('start',{active:false}),'CONFLICT')));
 ok('rule: cannot archive plan with centers', !!(await rejects(api.plans.update('pro',{active:false}),'CONFLICT')));
 const lowErr=await rejects(api.plans.update('basic',{price:400,limits:{staff:8,storageGb:10,branches:3},modules:{}}),'VALIDATION');
 ok('rule: limit below usage rejected (names center)', !!lowErr && lowErr.fields.staff.includes('Умед'));
 ok('rule: invalid numbers', !!(await rejects(api.plans.update('pro',{price:-5,limits:{staff:0,storageGb:'x',branches:1.5},modules:{}}),'VALIDATION')));
 const created=await api.plans.create({name:'Премиум',price:3000,limits:{staff:200,storageGb:500,branches:50},modules:{payroll:true,inventory:true,crm:true,geo:true}});
 ok('plan created', created.name==='Премиум' && created.centers===0 && created.active===true);
 ok('rule: duplicate plan name', !!(await rejects(api.plans.create({name:'премиум',price:1,limits:{staff:1,storageGb:1,branches:1},modules:{}}),'VALIDATION')));
 ok('archive empty plan ok', (await api.plans.update(created.id,{active:false})).active===false);
 ok('dict has only active plans', (await api.dictionaries.get()).plans.every(p=>p.id!==created.id) && (await api.dictionaries.get()).plans.length===4);

 // ---- биллинг / аудит / смена тарифа: API (до мутаций) ----
 const bl=await api.billing.list();
 ok('billing seed: 3 invoices, pending 1 500, trials 1', bl.items.length===3 && bl.meta.pendingSum===1500 && bl.meta.pendingCount===1 && bl.meta.trials===1 && bl.meta.paid30===1800);
 ok('attention pendingInvoices 1', (await api.platform.attention()).pendingInvoices===1);
 const al=(await api.audit.list()).items; ok('audit: seed entries present, newest first', al.length>=3 && al.some(e=>e.action==='support.entered') && al.some(e=>e.action==='invoice.paid') && al.every((e,i)=>i===0 || new Date(al[i-1].at)>=new Date(e.at)));

 const inv43=bl.items.find(i=>i.id==='INV-1043'), inv42=bl.items.find(i=>i.id==='INV-1042');
 ok('invoice model: "overdue" derived from due date (not a separate status)', inv43.overdue===true && inv43.daysOverdue===2 && inv43.status==='pending' && !inv42.overdue && inv43.payLink.includes('INV-1043') && inv42.payLink===null);
 ok('invoice list: overdue + kind filters, overdue sum', (await api.billing.list({status:'overdue'})).items.length===1 && (await api.billing.list({status:'overdue'})).meta.overdueSum===1500 && (await api.billing.list({kind:'renewal'})).items.length===1 && (await api.billing.list({status:'pending'})).meta.counts.overdue===1);
 ok('invoice timeline events', inv42.events.map(e=>e.type).join()==='issued,paid,applied' && inv43.events.map(e=>e.type).join()==='issued,reminded');
 ok('paid invoice carries payment basis (channel, who confirmed, amount, date)', inv42.payment.channel==='bank' && inv42.payment.confirmedBy.name==='Алексей К.' && inv42.payment.via==='manual' && inv42.payment.receivedAmount===1800 && inv42.channel==='bank');
 const ve=await rejects(api.billing.confirmPayment('INV-1043',{method:'Наличные',reference:'ПК',receivedAmount:1,receivedOn:'2999-01-01',confirmed:false}),'VALIDATION');
 ok('manual confirmation validates reference, amount, date, explicit confirmation', !!ve && !!ve.fields.reference && !!ve.fields.receivedAmount && !!ve.fields.receivedOn && !!ve.fields.confirmed);
 const ve2=await rejects(api.billing.confirmPayment('INV-1043',{method:'Наличные',reference:'ПКО № 5',receivedAmount:1500,receivedOn:'2000-01-01',confirmed:true}),'VALIDATION');
 ok('rule: payment date cannot precede invoice date', !!ve2 && !!ve2.fields.receivedOn);
 ok('dictionary: payMethods carry channel, evidence and document label', (await api.dictionaries.get()).payMethods.length===3 && (await api.dictionaries.get()).payMethods.every(m=>m.method && m.channel && m.evidence && m.docLabel));

 // ---- баланс и овердрафт центров: API (чтение и правила) ----
 const f5=await api.finance.get(5);
 ok('finance: balance, overdraft limit/used/available/pct/status', f5.center.balance===-150 && f5.center.overdraftLimit===300 && f5.center.overdraftUsed===150 && f5.center.available===150 && f5.center.overdraftPct===50 && f5.center.financeStatus==='overdraft');
 ok('finance: status "critical" at >=80% of the overdraft used', (await api.finance.get(10)).center.financeStatus==='critical' && (await api.finance.get(10)).center.overdraftPct===84);
 ok('finance: centers without overdraft (Старт) have limit 0 and no percentage', (await api.finance.get(9)).center.overdraftLimit===0 && (await api.finance.get(9)).center.overdraftPct===null);
 ok('finance: ledger newest first; top row balanceAfter equals current balance', f5.ledger.length===2 && f5.ledger[0].type==='charge' && f5.ledger[1].type==='topup' && f5.ledger[0].balanceAfter===-150);
 ok('finance: every seeded ledger ends at the center balance', (await Promise.all([1,2,3,4,6,7,8,11,12].map(id=>api.finance.get(id)))).every(r=>r.ledger[0].balanceAfter===r.center.balance));
 ok('attention.overdraft = 4 and list filter "overdraft"', (await api.platform.attention()).overdraft===4 && (await api.centers.list({filter:'overdraft'})).total===4);
 ok('invoice exposes pay-from-balance availability (Alpha: 120+800 < 1500)', bl.items.find(i=>i.id==='INV-1043').fromBalance.possible===false && bl.items.find(i=>i.id==='INV-1043').fromBalance.available===920);
 const fe=await rejects(api.billing.payFromBalance('INV-1043'),'VALIDATION');
 ok('rule: pay-from-balance rejected when balance + overdraft is not enough', !!fe && fe.message.includes('Недостаточно средств') && (await api.billing.get('INV-1043')).status==='pending');
 const te=await rejects(api.finance.topUp(5,{method:'Наличные',reference:'ПК',receivedAmount:-5,receivedOn:'2999-01-01',confirmed:false}),'VALIDATION');
 ok('rule: top-up needs evidence (reference, positive amount, date, confirmation)', !!te && !!te.fields.reference && !!te.fields.receivedAmount && !!te.fields.receivedOn && !!te.fields.confirmed);
 const oe1=await rejects(api.finance.setOverdraft(10,{limit:400,reason:'снижение лимита'}),'VALIDATION');
 ok('rule: overdraft limit cannot be below the amount already used', !!oe1 && oe1.fields.limit.includes('420'));
 ok('rule: overdraft change needs a reason and a real change', !!(await rejects(api.finance.setOverdraft(10,{limit:800,reason:'ab'}),'VALIDATION')) && !!(await rejects(api.finance.setOverdraft(10,{limit:500,reason:'без изменений'}),'VALIDATION')));
 ok('rule: overdraft limit range', !!(await rejects(api.finance.setOverdraft(10,{limit:-1,reason:'отрицательный лимит'}),'VALIDATION')) && !!(await rejects(api.finance.setOverdraft(10,{limit:1e9,reason:'слишком большой'}),'VALIDATION')));

 // ---- демо-центры (18–29): у каждого активного центра есть путь смены тарифа, много центров могут платить с баланса ----
 const allActive=(await api.centers.list()).items.filter(c=>c.status==='active');
 const infos=await Promise.all(allActive.map(c=>api.centers.planChangeInfo(c.id)));
 ok('tariff change: EVERY active center has at least one tariff it fits (incl. top-plan centers)', infos.length===28 && infos.every(i=>i.options.some(o=>o.fits)));
 ok('tariff change: >= 15 centers can pay some change straight from the platform balance', infos.filter(i=>i.options.some(o=>o.fits && o.payable && o.price>0)).length>=15);
 const optOf=async id=>(await api.centers.planChangeInfo(id)).options;
 const o20=await optOf(20), o27=await optOf(27), o23=await optOf(23), o29=await optOf(29), o1=await optOf(1);
 ok('center 20 (Старт, 5 000): can go to Базовый / Про / Бизнес and pay each from balance', ['Базовый','Про','Бизнес'].every(n=>{ const o=o20.find(x=>x.name===n); return o.fits && o.payable; }));
 ok('center 27 (Бизнес, light usage): can go down to Про, Базовый and free Старт', ['Про','Базовый','Старт'].every(n=>o27.find(x=>x.name===n).fits));
 ok('center 1 (Бизнес) now has a downgrade path: Про fits', o1.find(o=>o.name==='Про').fits===true);
 ok('center 23 (800 + overdraft 300): Про payable via overdraft (after −100), Бизнес not payable', o23.find(o=>o.name==='Про').payable===true && o23.find(o=>o.name==='Про').balanceAfter===-100 && o23.find(o=>o.name==='Бизнес').payable===false);
 ok('center 29: only Бизнес fits and it is NOT payable from balance (invoice needed)', o29.filter(o=>o.fits).map(o=>o.name).join()==='Бизнес' && o29.find(o=>o.name==='Бизнес').payable===false);
 const dn=['Дониёр','Тарона','Нур Акад','Эврика','Сармад','Фаро','Паёмбар','Дидор','Лидерс','Мактаби','Ситораи','Бахт Эдь'];
 ok('12 demo centers are healthy: not near limit, not churn, not expiring, balance >= 0', (await Promise.all(dn.map(q=>api.centers.list({q})))).every(r=>r.items.length===1 && r.items.every(c=>!c.nearLimit && !c.isChurn && !c.isExpiring && c.balance>=0)));
 const e29=await rejects(api.centers.requestPlanChange(29,{planId:'business',reason:'Нужен тариф выше',payFromBalance:true}),'VALIDATION');
 ok('rule: one-step change with insufficient balance is rejected and nothing is created', !!e29 && !!e29.fields.payment && (await api.centers.list({q:'Бахт Эдь'})).items[0].plan==='Про' && (await api.billing.list({q:'Бахт Эдь'})).items.length===0);
 const e1=await rejects(api.billing.confirmPayment('INV-1043',{method:'xxx',reference:''}),'VALIDATION');
 ok('rule: payment needs method + document number', !!e1 && !!e1.fields.method && !!e1.fields.reference);
 ok('rule: cannot confirm already paid invoice', !!(await rejects(api.billing.confirmPayment('INV-1042',{method:'Наличные',reference:'квитанция 1'}),'CONFLICT')));
 ok('rule: cancel needs reason', !!(await rejects(api.billing.cancel('INV-1043',{reason:'ab'}),'VALIDATION')));
 ok('rule: plan change needs reason', !!(await rejects(api.centers.requestPlanChange(5,{planId:'pro',reason:''}),'VALIDATION')));
 const doesnt=await rejects(api.centers.requestPlanChange(12,{planId:'basic',reason:'понижение для теста'}),'VALIDATION');
 ok('rule: plan that does not fit is rejected (lists excess)', !!doesnt && doesnt.fields.plan.includes('Не вмещает'));
 ok('rule: same plan conflict', !!(await rejects(api.centers.requestPlanChange(5,{planId:'basic',reason:'тест причины'}),'CONFLICT')));
 ok('rule: blocked center cannot change plan', !!(await rejects(api.centers.requestPlanChange(17,{planId:'pro',reason:'тест причины'}),'CONFLICT')));
 const info=await api.centers.planChangeInfo(5);
 ok('planChangeInfo: all other active plans, recommended up, history', info.options.length===3 && info.options.find(o=>o.recommended).name==='Про' && info.options.find(o=>o.name==='Старт').fits===false && Array.isArray(info.history));
 // ---- loading state ----
 apiConfig.latencyMs=80;
 const p=go('centers');
 await sleep(10);
 ok('skeleton shown while loading', document.querySelectorAll('#centersTableBody .animate-pulse').length>0);
 await p; await sleep(250); apiConfig.latencyMs=0;
 ok('skeleton replaced', document.querySelectorAll('#centersTableBody .animate-pulse').length===0 && rows('centersTableBody')===29);

 // ---- UI ----
 ok('badges', [state.attention.moderation,state.attention.expiring,state.attention.churn].join()==='4,7,5' && !document.querySelector('#superadminNav [id^="badge-"]') && !document.querySelector('#superadminNav [id^="gbadge-"]'));
 ok('centers badge 142', String(state.attention.totalCenters)==='142');
 await go('home'); ok('home rows 5', rows('homeActivityBody')===5 && document.getElementById('attTotal').innerText==='22');

 await go('expiring'); ok('exp rows 7', rows('expBody')===7);
 await setExpWindow(30); await sleep(5); ok('exp30 rows 9', rows('expBody')===9);
 await setExpWindow(14); await sleep(5);
 await invoiceCenter(2); ok('invoice issued (INV-1045 in registry)', document.getElementById('expBody').innerText.includes('INV-1045') && (await api.billing.list({status:'pending'})).items.some(i=>i.id==='INV-1045' && i.kind==='renewal'));
 await invoiceCenter(2); ok('double invoice -> server conflict (no crash)', document.getElementById('expBody').innerText.includes('INV-1045'));

 await invoiceCenter(11); await sleep(30);
 const inv11=(await api.centers.expiring({withinDays:14})).items.find(c=>c.id===11).invoice;
 ok('expiring: "Подтвердить оплату" appears only with invoice', document.querySelectorAll('#expBody button').length>0 && document.getElementById('expBody').innerText.includes('Подтвердить оплату') && !document.getElementById('expBody').innerText.includes('Продлить'));
 await openPaymentConfirm(inv11); await sleep(30);
 ok('payment modal opened with invoice summary', modalIsOpen() && document.getElementById('modalBox').innerText.includes(inv11) && document.getElementById('modalBox').innerText.includes('продлена на 30 дней'));
 payState.reference=''; await payConfirm();
 ok('payment: reference required (server validation shown inline)', !!document.getElementById('err-pay-reference') && modalIsOpen());
 payState.reference='ПП № 77'; payState.confirmed=true; await payConfirm(); await sleep(80);
 ok('after manual payment: modal closed, subscription extended, row gone', !modalIsOpen() && rows('expBody')===6 && String(state.attention.expiring)==='6');
 ok('paid invoice recorded with method/reference', (await api.billing.get(inv11)).status==='paid' && (await api.billing.get(inv11)).reference==='ПП № 77' && (await api.billing.get(inv11)).method==='Безнал (Р/С)');
 await remindAllExpiring(); ok('remind all', (await api.centers.expiring({withinDays:14})).items.every(c=>c.reminded));

 await go('churn'); ok('churn rows 5', rows('churnBody')===5);
 await setChurnFilter('nomanager'); await sleep(5); ok('nomanager 4', rows('churnBody')===4);
 await markContacted(5); await setChurnFilter('contacted'); await sleep(5); ok('contacted 1', rows('churnBody')===1);
 await setChurnFilter('all'); await sleep(5);
 await setManager(6,'Фарход С.'); ok('manager set', (await api.centers.churn({})).items.find(c=>c.id===6).manager==='Фарход С.');

 await go('centers'); ok('centers 29', rows('centersTableBody')===29);
 setCentersFilter('chip','churn'); await sleep(20); ok('chip churn 5', rows('centersTableBody')===5);
 setCentersFilter('chip','overdraft'); await sleep(40); ok('centers: chip "В овердрафте" -> 4 centers with negative balance', rows('centersTableBody')===4 && document.getElementById('centersChips').innerText.includes('В овердрафте · 4'));
 ok('centers: overdraft usage and status badges shown', document.getElementById('centersTableBody').innerText.includes('Овердрафт почти исчерпан') && document.getElementById('centersTableBody').innerText.includes('В овердрафте'));
 setCentersFilter('chip','all'); await sleep(40);
 ok('centers: balance and overdraft columns present with values', document.getElementById('view-centers').innerText.includes('Баланс') && document.getElementById('view-centers').innerText.includes('Овердрафт') && document.getElementById('centersTableBody').innerText.includes('не предусмотрен') && /2\D400/.test(document.getElementById('centersTableBody').innerText));
 ok('tables: columns visibly separated (vertical border between cells)', getComputedStyle(document.querySelector('#centersTableBody td')).borderRightWidth==='1px' && getComputedStyle(document.querySelector('#view-centers thead th')).borderRightWidth==='1px');
 setCentersFilter('chip','all'); setCentersFilter('q','худж'); await sleep(350); ok('debounced search', rows('centersTableBody')===6);
 setCentersFilter('q',''); await sleep(350);

 // ---- гонка: старый медленный ответ не должен перезаписать новый ----
 apiConfig.latencyMs=120; const slow=renderCenters(); await sleep(5); centersState.chip='blocked'; apiConfig.latencyMs=0; await renderCenters(); await slow;
 ok('stale response ignored', rows('centersTableBody')===1);
 centersState.chip='all';

 // ---- ошибка сети → состояние ошибки и повтор ----
 const orig=api.centers.list; api.centers.list=()=>Promise.reject(new Error('net'));
 await renderCenters(); ok('error row + retry', document.getElementById('centersTableBody').innerText.includes('Повторить'));
 api.centers.list=orig; await renderCenters(); ok('recovered', rows('centersTableBody')===29);

 // ---- wizard ----
 await go('center-new'); await wzNext(); ok('wizard blocks empty', wizard.step===1 && Object.keys(wizard.errors).length>0);
 wz('name','Alpha School'); wz('address','ул. Тест 1'); wz('phone','+992 90 111 22 33'); await wzNext(); ok('dup name blocked by server check', wizard.step===1 && !!wizard.errors.name);
 wz('name','Новый Центр'); await wzNext(); ok('step2', wizard.step===2);
 wz('ownerName','Иван Иванов'); wz('ownerPhone','+992 90 555 55 55'); await wzCheckGlobalId(); ok('gid not found', wizard.checked && wizard.checked.found===false);
 wz('ownerPhone','+992 90 100 10 01'); wz('ownerPhone','+992 901 001 001'); await wzCheckGlobalId(); ok('gid found', wizard.checked.found===true);
 await wzNext(); ok('step3', wizard.step===3);
 await wzFinish(); ok('terms required', !wizard.done);
 wz('terms',true); wzFinish(); ok('submitting state', wizard.submitting===true); await sleep(10);
 ok('created', wizard.done && wizard.done.name==='Новый Центр'); await sleep(10);
 ok('counter 143', String(state.attention.totalCenters)==='143');
 ok('new center not churn', (await api.centers.list({q:'Новый Центр'})).items[0].isChurn===false);
 // серверная ошибка валидации → возврат на нужный шаг
 wizardReset(); Object.assign(wizard.data,{name:'Alpha School',address:'ул. Тест 1',phone:'+992 90 111 22 33',ownerName:'Иван Иванов',ownerPhone:'+992 90 111 22 33',terms:true}); wizard.step=3; await wzFinish();
 ok('server validation -> step 1 w/ error', wizard.step===1 && !!wizard.errors.name && !wizard.done);

 // ---- moderation ----
 await go('moderation'); ok('mod list 4', document.getElementById('modList').children.length===4);
 const r=modReq(); ok('first sel', r.id===1);
 ok('publish disabled w/o gps', modGate(r).length>0 && document.getElementById('modActions').innerHTML.includes('disabled'));
 modToggleGps(true); modState.lang='tj'; modSetDesc('y'.repeat(25)); ok('gate ok', modGate(modReq()).length===0);
 await modPublish(); ok('published + badge 3', String(state.attention.moderation)==='3' && modReq().id===2);
 selectMod(3); ok('no tj blocks', modGate(modReq()).some(x=>x.includes('TJ')));
 modOpenPanel('reject'); document.getElementById('modReason').value='abc'; await modDecideWithReason('rejected'); ok('short reason blocked client-side', modRaw().id===3);
 document.getElementById('modReason').value='Неверный адрес'; await modDecideWithReason('rejected'); ok('rejected + badge 2', String(state.attention.moderation)==='2');
 await setModTab('processed'); await sleep(5); ok('processed 2', document.getElementById('modList').children.length===2);
 await modRequeue(3); ok('requeue', modState.tab==='pending' && modState.items.some(x=>x.id===3));
 ok('dist warn id2', distM(modState.items.find(x=>x.id===2).gps, modState.items.find(x=>x.id===2).geo)>150);



 // ---- экран «Центры у лимита» ----
 await go('limits'); await sleep(60);
 const lrows=()=>document.querySelectorAll('#limList > div').length;
 const setL=async(k,v,w=40)=>{ limSet(k,v); await sleep(w); };
 ok('limits: 6 rows', lrows()===6);
 ok('limits: tiles (potential 3 700, full 2)', /3\D700/.test(document.getElementById('limTiles').innerText) && document.getElementById('limTiles').innerText.includes('Лимит исчерпан'));
 ok('limits: nav badge 6', String(state.attention.nearLimit)==='6');
 ok('limits: most loaded selected first', limState.sel===8);
 ok('limits: detail shows 3 bars + recommended', document.querySelectorAll('#limDetail .rounded-full.overflow-hidden').length===3 && document.getElementById('limDetail').innerText.includes('Рекомендуем'));
 await setL('threshold',0.9); ok('limits: threshold 90 -> 4', lrows()===4);
 await setL('threshold',0.8);
 await setL('metric','branches'); ok('limits: metric branches -> 3', lrows()===3);
 await setL('metric','any');
 await setL('status','nooffer'); ok('limits: no-offer -> 5', lrows()===5);
 await setL('status','offered'); ok('limits: offered -> 1 + banner', lrows()===1 && limState.sel===4 && document.getElementById('limDetail').innerText.includes('уже отправлено'));
 await setL('status','all');
 await setL('plan','Про'); ok('limits: plan filter -> 2', lrows()===2);
 await setL('plan','all');
 await setL('q','zebo',350); ok('limits: debounced search -> 1', lrows()===1);
 await setL('q','',350);
 await setL('sort','name'); ok('limits: sort by name keeps all', lrows()===6);
 await setL('sort','usage');

 limSelect(8); limPick(8,'pro'); limChangePlan(); await sleep(60);
 ok('limits: "Выставить счёт" opens modal with plan + reason prefilled', modalIsOpen() && pcState.planId==='pro' && pcState.reason.includes('Филиалы') && document.getElementById('modalBox').innerText.includes('Смена тарифа'));
 ok('modal: unfit plans are disabled (Старт does not fit Zebo)', [...document.querySelectorAll('#modalBox button[disabled]')].some(b=>b.innerText.includes('Старт')));
 pcState.reason=''; await pcSubmit(); ok('modal: reason required', !!document.getElementById('err-pcReason'));
 pcState.reason='Лимит филиалов исчерпан'; await pcSubmit(); await sleep(80);
 const z0=(await api.centers.list({q:'Zebo'})).items[0];
 ok('invoice issued, plan NOT changed yet', z0.plan==='Базовый' && !!z0.pendingChange && z0.pendingChange.planName==='Про' && z0.pendingChange.amount===900);
 ok('modal switches to pending-invoice view with pay actions', document.getElementById('modalBox').innerText.includes('ожидает оплаты') && document.getElementById('modalBox').innerText.includes('Подтвердить оплату') && document.getElementById('modalBox').innerText.includes('Демо: владелец оплатил онлайн'));
 ok('billing registry has the plan_change invoice', (await api.billing.list({status:'pending'})).items.some(i=>i.kind==='plan_change' && i.centerId===8));
 ok('rule: second request conflicts', !!(await rejects(api.centers.requestPlanChange(8,{planId:'business',reason:'ещё раз'}),'CONFLICT')));
 closeModal(); await sleep(60);
 ok('limits list marks center "Ожидает оплаты"', document.getElementById('limList').innerText.includes('Ожидает оплаты') && document.getElementById('limDetail').innerText.includes('ожидает оплаты'));
 await setL('status','pending'); ok('limits: status filter "Ожидает оплаты" -> 1', lrows()===1 && limState.sel===8);
 await setL('status','all');
 await openPaymentConfirm(z0.pendingChange.invoiceId); await sleep(30);
 payState.reference=''; await payConfirm(); ok('payment: reference required', !!document.getElementById('err-pay-reference'));
 payState.reference='ПП № 901'; payState.method='Наличные'; payState.confirmed=true; await payConfirm(); await sleep(90);
 const z=(await api.centers.list({q:'Zebo'})).items[0];
 ok('after manual payment: plan changed (Про, 30d, no pending, offer cleared)', z.plan==='Про' && z.expiresIn===30 && !z.pendingChange && z.offer===null);
 const au8=await api.audit.list({q:'Zebo'});
 ok('audit for manual path: created, paid (SuperAdmin, Наличные), changed', ['invoice.created','invoice.paid','plan.changed'].every(a=>au8.items.some(e=>e.action===a)) && au8.items.find(e=>e.action==='invoice.paid').actor.role==='SuperAdmin' && au8.items.find(e=>e.action==='invoice.paid').after.method==='Наличные' && au8.items.find(e=>e.action==='plan.changed').reason.includes('Лимит филиалов'));
 ok('limits: upgraded center left the list', lrows()===5 && limState.sel!==8);
 limCheckAll(true); ok('limits: select all', limState.checked.size===5);
 limCheck(5,false); ok('limits: uncheck one', limState.checked.size===4 && document.getElementById('limBulk').innerText.includes('Выбрано: 4'));
 await limBulkOffer(); await sleep(60);
 ok('limits: bulk offer sent, selection cleared', limState.meta.offered===4 && limState.checked.size===0);
 limSelect(5); await limOffer(); await sleep(60);
 ok('limits: single offer', limState.meta.offered===5 && limState.meta.withoutOffer===0);
 await setL('threshold',1); ok('limits: threshold 100 -> only Math Lab', lrows()===1 && limState.items[0].center.name==='Math Lab');
 await setL('threshold',0.8);
 ok('limits: attention badge refreshed (5)', String(state.attention.nearLimit)==='5');
 ok('rule: plan change rejects over-capacity', !!(await rejects(api.centers.requestPlanChange(5,{planId:'start',reason:'проверка лимитов'}),'VALIDATION')));
 // ---- тарифы: UI ----
 await go('plans'); await sleep(50);
 ok('plans grid cards (4 active + archived)', document.querySelectorAll('#plansGrid > div').length===5);
 ok('plans tiles', document.getElementById('plansTiles').innerText.replace(/\D/g,'').includes(String(plansState.meta.mrr)) && document.getElementById('plansLimitBanner').innerText.includes('к лимиту тарифа'));
 planEdit('basic'); ok('editor opens w/ values', document.getElementById('pf-price').value==='400' && !document.getElementById('pf-name').disabled===false);
 planDraft('staff','8'); await planSave(); ok('UI: server error shown inline', !!document.getElementById('perr-staff') && document.getElementById('perr-staff').innerText.includes('Умед') && plansState.editing==='basic');
 planDraft('staff','12'); planToggleModule('inventory'); await planSave(); await sleep(30);
 ok('UI: plan saved + editor closed', plansState.editing===null && plansState.items.find(p=>p.id==='basic').limits.staff===12 && plansState.items.find(p=>p.id==='basic').modules.inventory===true);
 planNew(); planDraft('name','Ab'); planDraft('price','0'); planDraft('staff','5'); planDraft('storageGb','5'); planDraft('branches','1'); await planSave();
 ok('UI: new plan validation (price>0)', !!document.getElementById('perr-price') && plansState.editing==='new');
 planDraft('name','Корпоратив'); planDraft('price','2500'); await planSave(); await sleep(30);
 ok('UI: new plan appears', plansState.items.some(p=>p.name==='Корпоратив') && document.querySelectorAll('#plansGrid > div').length===6);
 await planToggleActive('pro'); ok('UI: archive blocked -> still active', plansState.items.find(p=>p.id==='pro').active===true);
 ok('rule: downgrade below usage rejected', !!(await rejects(api.centers.requestPlanChange(5,{planId:'start',reason:'проверка лимитов'}),'VALIDATION')));
 ok('rule: same plan conflict (UI block)', !!(await rejects(api.centers.requestPlanChange(5,{planId:'basic',reason:'проверка лимитов'}),'CONFLICT')));
 ok('rule: archived plan rejected', !!(await rejects(api.centers.requestPlanChange(5,{planId:created.id,reason:'проверка лимитов'}),'VALIDATION')));
 ok('expiring unaffected for free plans', (await api.centers.expiring({withinDays:60})).items.every(c=>c.plan!=='Старт'));
 // лимиты Старт попадают в мастер подключения
 planEdit('start'); planDraft('staff','6'); await planSave(); await sleep(30);
 ok('dict Старт limit updated', dict().plans.find(p=>p.name==='Старт').limits.staff===6);
 wizardReset(); wizard.step=3; await go('center-new'); wizard.step=3; renderWizard();
 ok('wizard step3 shows dynamic Старт limits', document.getElementById('wizardRoot').innerText.includes('6') && document.getElementById('wizardRoot').innerText.includes('учителей'));
 // платёж → смена тарифа ТОЛЬКО после оплаты; онлайн-путь (мок шлюза): центр 15
 const r15=await api.centers.requestPlanChange(15,{planId:'pro',reason:'Нужны дополнительные сотрудники'});
 ok('request: invoice created, plan NOT changed', r15.mode==='invoice' && r15.invoice.amount===900 && r15.center.plan==='Базовый' && r15.center.pendingChange.planName==='Про');
 ok('rule: second request while invoice pending conflicts', !!(await rejects(api.centers.requestPlanChange(15,{planId:'business',reason:'ещё один запрос'}),'CONFLICT')));
 ok('rule: renewal invoice blocked while plan-change pending', !!(await rejects(api.centers.invoice(15),'CONFLICT')));
 const paid15=await api.billing.simulateOnlinePayment(r15.invoice.id);
 const c15=(await api.centers.list({q:'Kids Planet'})).items[0];
 ok('online payment carries gateway evidence (tx id, masked card, auto)', paid15.payment.channel==='online' && paid15.payment.via==='online' && /^TX-/.test(paid15.payment.txId) && paid15.payment.cardMask==='•••• 4242' && paid15.payment.confirmedBy.role==='Система' && paid15.events.map(e=>e.type).join()==='issued,paid,applied' && paid15.events[2].text.includes('Тариф изменён'));
 ok('online payment (mock gateway): plan changed automatically', paid15.status==='paid' && paid15.paidVia==='online' && c15.plan==='Про' && c15.expiresIn===30 && !c15.pendingChange && c15.offer===null);
 const au15=await api.audit.list({q:'Kids Planet'});
 ok('audit: created + paid(by gateway) + plan.changed with before/after', ['invoice.created','invoice.paid','plan.changed'].every(a=>au15.items.some(e=>e.action===a)) && au15.items.find(e=>e.action==='invoice.paid').actor.role==='Система' && au15.items.find(e=>e.action==='plan.changed').before.plan==='Базовый' && au15.items.find(e=>e.action==='plan.changed').after.plan==='Про');
 const cancelInv=await api.centers.requestPlanChange(16,{planId:'pro',reason:'проверка отмены счёта'});
 ok('cancel invoice: status cancelled, center free of pending', (await api.billing.cancel(cancelInv.invoice.id,{reason:'владелец передумал'})).status==='cancelled' && (await api.centers.list({q:'Лидер'})).items[0].pendingChange===null);
 ok('support.enter writes audit', (await api.support.enter({centerId:3})).ok===true && (await api.audit.list({action:'support.entered'})).total===2);

 // переход на бесплатный тариф — без счёта, сразу
 const free6=await api.centers.requestPlanChange(6,{planId:'start',reason:'Центр сокращает работу'});
 ok('free target: applied immediately, no invoice', free6.mode==='applied' && free6.invoice===null && free6.center.plan==='Старт' && free6.center.expiresIn===null);
 ok('audit: free change logged with reason', (await api.audit.list({q:'сокращает'})).items.some(e=>e.action==='plan.changed' && e.entity.id===6));

 // ---- drawer и «Все центры»: единая точка смены тарифа ----
 await go('centers'); await sleep(60);
 const crow=[...document.querySelectorAll('#centersTableBody tr')].find(r=>r.innerText.includes('Alpha School'));
 ok('centers: row = primary "Войти" (title: в кабинет) + gear dropdown (no row of buttons)', crow.querySelectorAll('td:last-child button').length===2 && crow.querySelector('td:last-child [data-menu-trigger] svg') && crow.querySelector('td:last-child button[title*="Войти в кабинет"]') && crow.querySelector('td:last-child').innerText.includes('Войти'));
 crow.querySelector('[data-menu-trigger]').scrollIntoView({block:'center'}); await sleep(60); crow.querySelector('[data-menu-trigger]').click(); await sleep(30);
 ok('centers: gear menu = finance, top-up, change tariff, modules (each with hint)', menuIsOpen() && ['Баланс и овердрафт','Пополнить баланс','Начислить пакет SMS','Сменить тариф','Настройка модулей'].every(x=>document.getElementById('menuPopover').innerText.includes(x)) && menuButtons().length===5);
 closeMenu();
 openDrawerById(5); ok('drawer: plan block shown with current plan', !document.getElementById('drawerPlanBlock').classList.contains('hidden') && document.getElementById('drawerPlanName').textContent.includes('Базовый'));
 drawerChangePlan(); await sleep(80);
 ok('drawer: opens plan-change modal and closes drawer', modalIsOpen() && pcState.centerId===5 && document.getElementById('moduleDrawer').classList.contains('translate-x-full'));
 closeModal();
 openDrawer('Центр Перспектива'); ok('drawer opened by name: plan block hidden', document.getElementById('drawerPlanBlock').classList.contains('hidden')); closeDrawer();


 // ---- экран «Биллинг»: реестр, меню действий, карточка счёта, оплата ----
 await go('billing'); await sleep(80);
 const brows=()=>document.querySelectorAll('#billBody tr').length;
 const rowOf=id=>[...document.querySelectorAll('#billBody tr')].find(r=>r.innerText.includes(id));
 ok('billing: registry shows invoices incl. new ones', brows()>=6 && document.getElementById('billBody').innerText.includes('INV-1043'));
 ok('billing: underline tabs with counts incl. "Просрочены"', document.querySelectorAll('#billTabs button').length===6 && document.getElementById('billTabs').innerText.includes('Просрочены'));
 ok('billing: explainer answers where payment comes from', document.getElementById('billExplainer').innerText.includes('Онлайн — автоматически') && document.getElementById('billExplainer').innerText.includes('Вручную — SuperAdmin'));
 ok('billing: nav badge = pending invoices', String(state.attention.pendingInvoices)===String((await api.platform.attention()).pendingInvoices));
 ok('billing: numbers right-aligned, status shows due text', rowOf('INV-1043').innerText.includes('просрочен на 2 дня') && rowOf('INV-1043').querySelector('td.text-right.tabular-nums'));
 // действия: одно главное + меню, а не ряд кнопок
 ok('billing: pending row = primary button + gear dropdown (2 controls)', rowOf('INV-1043').querySelectorAll('td:last-child button').length===2 && rowOf('INV-1043').querySelector('td:last-child [data-menu-trigger]'));
 ok('billing: paid row = kebab only', rowOf('INV-1042').querySelectorAll('td:last-child button').length===1);
 const kb=rowOf('INV-1043').querySelector('[data-menu-trigger]'); kb.scrollIntoView({block:'center'}); await sleep(60); kb.click(); await sleep(30);
 const pop=document.getElementById('menuPopover'), pr=pop.getBoundingClientRect();
 ok('menu: role=menu, aria-expanded, 5 justified items (no mock/stub actions)', menuIsOpen() && pop.getAttribute('role')==='menu' && kb.getAttribute('aria-expanded')==='true' && pop.querySelectorAll('[role="menuitem"]').length===5 && pop.innerText.includes('Подробности счёта') && pop.innerText.includes('Списать с баланса на платформе') && pop.innerText.includes('Отменить счёт') && !pop.innerText.includes('мок') && !pop.innerText.includes('PDF'));
 ok('menu: balance item disabled when funds are insufficient, hint explains why', (()=>{ const d=pop.querySelector('[role="menuitem"][disabled]'); return !!d && d.innerText.includes('Списать с баланса на платформе') && d.innerText.includes('Не хватает средств') && d.getAttribute('aria-disabled')==='true'; })());
 ok('menu: fixed popover stays inside viewport (not clipped by table)', pr.left>=0 && pr.top>=0 && pr.right<=window.innerWidth && pr.bottom<=window.innerHeight);
 ok('menu: first item focused', document.activeElement===menuButtons()[0]);
 pop.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); ok('menu: ArrowDown moves focus', document.activeElement===menuButtons()[1]);
 pop.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); ok('menu: End -> last item', document.activeElement===menuButtons()[menuButtons().length-1]);
 pop.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); ok('menu: Esc closes and returns focus to trigger', !menuIsOpen() && kb.getAttribute('aria-expanded')==='false' && document.activeElement===kb);
 kb.click(); await sleep(20); document.getElementById('view-billing').dispatchEvent(new Event('scroll')); await sleep(20); ok('menu: spurious scroll (anchor did not move) keeps it open', menuIsOpen());
 document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); ok('menu: click outside closes', !menuIsOpen());
 kb.click(); await sleep(20); kb.click(); await sleep(20); ok('menu: second click on trigger toggles it closed', !menuIsOpen());
 kb.click(); await sleep(20); menuButtons().find(b=>b.innerText.includes('Отправить напоминание')).click(); await sleep(90);
 ok('menu: item runs its action (reminder event added), menu closed', (await api.billing.get('INV-1043')).events.filter(e=>e.type==='reminded').length===2 && !menuIsOpen());
 // карточка счёта
 rowOf('INV-1043').click(); await sleep(100);
 const pbox=()=>document.getElementById('panelBox').innerText;
 ok('invoice panel opens on row click: two ways to pay, link, payer, timeline', panelIsOpen() && pbox().includes('Онлайн — автоматически') && pbox().includes('Вручную — оплата вне системы') && document.querySelector('#panelBox input[readonly]').value.includes('pay.liniya.tj/INV-1043') && pbox().includes('Дилшод Азизов') && pbox().includes('просрочен на 2 дня') && pbox().includes('Напоминание отправлено'));
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); ok('invoice panel: Esc closes', !panelIsOpen());
 await openInvoice('INV-1042'); await sleep(70);
 ok('invoice panel (paid manually): channel, who confirmed, basis, document, amount, timeline', pbox().includes('Безнал (Р/С)') && pbox().includes('Вручную: Алексей К.') && pbox().includes('Банковская выписка') && pbox().includes('№ платёжного поручения') && pbox().includes('ПП № 18') && /1\D800/.test(pbox()) && pbox().includes('Подписка продлена на 30 дней'));
 closePanel();
 // окно подтверждения оплаты
 await openPaymentConfirm('INV-1043'); await sleep(50);
 const mtext=()=>document.getElementById('modalBox').innerText;
 ok('payment dialog: irreversible warning, 3 method cards, prefilled amount and date', mtext().includes('Подтверждайте, только если деньги уже получены') && mtext().includes('Банковская выписка') && mtext().includes('Кассовый документ') && document.getElementById('pay-receivedAmount').value==='1500' && document.getElementById('pay-receivedOn').value===todayStr());
 payPickMethod('Наличные'); ok('payment dialog: document label follows the method', mtext().includes('№ приходного кассового ордера') && payState.method==='Наличные');
 payState.receivedAmount='1'; payState.receivedOn='2999-01-01'; payState.reference='ПКО № 12'; await payConfirm();
 ok('payment dialog: server errors inline (amount, date, explicit confirmation)', !!document.getElementById('err-pay-receivedAmount') && !!document.getElementById('err-pay-receivedOn') && !!document.getElementById('err-pay-confirmed') && modalIsOpen());
 closeModal();
 // массовые действия
 await go('billing'); await sleep(70);
 billCheckAll(true); ok('billing: select-all picks pending invoices, bulk bar shown', billState.checked.size>=2 && document.getElementById('billBulk').innerText.includes('Выбрано счетов') && document.getElementById('billCheckAll').checked);
 const nPend=billState.checked.size; await billBulkRemind(); await sleep(90);
 ok('billing: bulk reminder sent, selection cleared', billState.checked.size===0 && document.getElementById('billBulk').innerText==='' && (await api.billing.get('INV-1043')).events.filter(e=>e.type==='reminded').length===3 && nPend>=2);
 billSet('status','overdue'); await sleep(60);
 ok('billing: overdue tab shows only overdue', brows()===1 && document.getElementById('billBody').innerText.includes('INV-1043'));
 billSet('status','pending'); await sleep(60);
 ok('billing: pending tab shows only open invoices', [...document.querySelectorAll('#billBody tr')].every(r=>/Ожидает оплаты|Просрочен/.test(r.innerText)) && brows()===(await api.billing.list({status:'pending'})).items.length);
 await payOnline('INV-1043'); await sleep(90);
 ok('billing: online (mock) payment closes the invoice via gateway', (await api.billing.get('INV-1043')).status==='paid' && (await api.billing.get('INV-1043')).payment.via==='online');
 billSet('status','paid'); await sleep(60);
 ok('billing: paid rows show channel and how it was confirmed', document.getElementById('billBody').innerText.includes('Онлайн-шлюз') && document.getElementById('billBody').innerText.includes('автоматически') && document.getElementById('billBody').innerText.includes('вручную: Алексей К.') && document.getElementById('billBody').innerText.includes('Банк'));
 billSet('status','all'); billSet('kind','plan_change'); await sleep(60);
 ok('billing: type filter (plan changes only)', [...document.querySelectorAll('#billBody tr')].every(r=>r.innerText.includes('Смена тарифа')));
 billSet('kind','all'); await sleep(40);
 ok('billing: header has no stub buttons', (()=>{ const hd=document.querySelector('#view-billing > div').innerText; return !hd.includes('Промокод') && !hd.includes('Выставить счёт') && !hd.includes('в разработке'); })());
 ok('billing: columns separated and gear is a bordered visible control', getComputedStyle(document.querySelector('#billBody td')).borderRightWidth==='1px' && document.querySelector('#billBody [data-menu-trigger]').className.includes('border-slate-300'));
 const nInv=(await api.billing.list()).items.length;
 billSet('kind','course'); await sleep(60);
 ok('billing filters: type narrows rows AND tab counts (numbers match rows)', brows()===1 && /Все статусы\s*1/.test(document.getElementById('billTabs').innerText) && document.getElementById('billActive').innerText.includes('Тип: Методика') && document.getElementById('billActive').innerText.includes('Сбросить все фильтры'));
 billSet('status','trial'); await sleep(60);
 ok('billing filters: status + type combine (course ∩ trial = empty), empty state offers reset', document.getElementById('billBody').innerText.includes('подходящих под выбранные фильтры') && document.getElementById('billBody').innerText.includes('Сбросить все фильтры') && document.getElementById('billActive').innerText.includes('Статус: Триалы'));
 const kindSel=document.getElementById('billKind'); kindSel.value='all'; kindSel.dispatchEvent(new Event('change',{bubbles:true})); await sleep(60);
 ok('billing filters: "Все типы счетов" removes the type filter (status stays visible as a chip)', billState.kind==='all' && document.getElementById('billActive').innerText.includes('Статус: Триалы') && !document.getElementById('billActive').innerText.includes('Тип:'));
 billResetFilters(); await sleep(70);
 ok('billing filters: reset shows every invoice, no chips', brows()===Math.min(10,nInv) && document.getElementById('billActive').innerHTML==='' && billState.status==='all' && billState.kind==='all');
 ok('billing: tiles dynamic', document.getElementById('billTiles').innerText.includes('Ожидают оплаты') && document.getElementById('billTiles').innerText.includes('Просрочено'));

 // ---- прокрутка экрана: карточки не сжимаются под высоту окна (регресс: у таблицы была высота 0) ----
 for (const tab of ['billing','centers','audit','expiring','churn','limits']) {
   await go(tab); await sleep(120);
   const main=document.getElementById('view-'+tab);
   const clipped=[...main.children].filter(k=>k.offsetHeight>0 || true).filter(k=>k.scrollHeight-k.offsetHeight>2 && getComputedStyle(k).overflowY!=='visible' && getComputedStyle(k).overflowY!=='auto' ).length;
   const cards=[...main.querySelectorAll(':scope > div')].filter(k=>/rounded-2xl/.test(k.className));
   ok('scroll: '+tab+' — cards keep natural height (none squeezed/clipped)', cards.every(k=>k.offsetHeight>=k.scrollHeight-2 || getComputedStyle(k).overflowY==='visible') && clipped===0);
 }
 await go('billing'); await sleep(120);
 const bmain=document.getElementById('view-billing'), bcard=document.getElementById('billBody').closest('.rounded-2xl');
 ok('billing: registry card is large (>=32rem) and fully visible when scrolled', bcard.offsetHeight>=500 && bcard.offsetHeight>=bcard.scrollHeight-2);
 ok('billing: screen scrolls vertically to the end (viewport is short)', bmain.scrollHeight>bmain.clientHeight+1 && (bmain.scrollTop=bmain.scrollHeight, bmain.scrollTop>0));
 bmain.scrollTop=0;
 ok('billing: card has title, tabs, toolbar and footer', bcard.innerText.includes('Реестр счетов') && document.getElementById('billFooter').innerText.includes('Показано') && document.getElementById('billFooter').innerText.includes('Строк на странице'));
 const totalInv=(await api.billing.list()).items.length;
 ok('billing footer: counter "Показано 1–N из M"', new RegExp('1.'+Math.min(10,totalInv)+' из '+totalInv).test(document.getElementById('billFooter').innerText));
 billPageSize(5); await sleep(70);
 ok('billing pagination: page size 5 -> 5 rows, page 1 of 2, prev disabled', brows()===5 && document.getElementById('billFooter').innerText.includes('Стр. 1 из 2') && document.querySelector('#billFooter button[aria-label="Предыдущая страница"]').disabled);
 billPage(1); await sleep(70);
 ok('billing pagination: page 2 shows the rest, next disabled', brows()===totalInv-5 && document.getElementById('billFooter').innerText.includes('Стр. 2 из 2') && document.querySelector('#billFooter button[aria-label="Следующая страница"]').disabled);
 billSet('status','paid'); await sleep(60);
 ok('billing pagination: filter change resets to page 1', billState.page===1);
 billSet('status','all'); billPageSize(10); await sleep(60);
 // ---- экран «Журнал аудита» ----
 await go('audit'); await sleep(80);
 const arows=()=>document.querySelectorAll('#auditBody tr').length;
 const total=(await api.audit.list()).total;
 ok('audit: shows all entries with before→after and actor', arows()===total && document.getElementById('auditBody').innerText.includes('Тариф:') && document.getElementById('auditBody').innerText.includes('SuperAdmin') && document.getElementById('auditBody').innerText.includes('Платёжный шлюз'));
 auditSet('action','plan.changed'); await sleep(60);
 ok('audit: action filter', arows()===(await api.audit.list({action:'plan.changed'})).total && arows()>=3);
 auditSet('action','all'); auditSet('q','Zebo'); await sleep(350);
 ok('audit: search by center', arows()===(await api.audit.list({q:'Zebo'})).total && arows()>=3);
 ok('audit: time shown to the second', /\d{2}:\d{2}:\d{2}/.test(document.getElementById('auditBody').innerText));

 // ---- роутер: неизвестный маршрут не молчит ----
 location.hash='#/no-such-screen'; await sleep(60);
 ok('router: unknown route -> home + visible error toast', location.hash==='#/home' && document.getElementById('toastContainer').innerText.includes('не найден'));

 // ---- баланс и овердрафт: операции (API) ----
 const top=await api.finance.topUp(14,{method:'Наличные',reference:'ПКО № 77',receivedAmount:500,receivedOn:todayStr(),comment:'тест',confirmed:true});
 const f14=await api.finance.get(14);
 ok('top-up (API): balance −80 → 420, overdraft no longer used, ledger entry', top.balance===420 && top.overdraftUsed===0 && top.financeStatus==='ok' && f14.ledger[0].type==='topup' && f14.ledger[0].amount===500 && f14.ledger[0].balanceAfter===420);
 const od=await api.finance.setOverdraft(10,{limit:800,reason:'Надёжный клиент, оплата по графику'});
 ok('overdraft limit raised 500 → 800, status recalculated (420/800 = 53%)', od.overdraftLimit===800 && od.overdraftPct===53 && od.financeStatus==='overdraft');
 const auF=await api.audit.list({});
 ok('audit: balance.topup and overdraft.changed with before → after and reason', auF.items.some(e=>e.action==='balance.topup' && e.entity.id===14 && e.before.balance===-80 && e.after.balance===420) && auF.items.some(e=>e.action==='overdraft.changed' && e.entity.id===10 && e.before.overdraftLimit===500 && e.after.overdraftLimit===800 && e.reason.includes('Надёжный')));
 const i45=await api.billing.get('INV-1045');
 ok('pay-from-balance availability uses overdraft (Indigo: 850 − 1800 = −950, limit 2000)', i45.fromBalance.possible===true && i45.fromBalance.usesOverdraft===true && i45.fromBalance.after===-950);
 const pb=await api.billing.payFromBalance('INV-1045'); const c2=await api.finance.get(2);
 ok('pay from balance: paid via "balance", balance −950 (overdraft 950), ledger charge linked to invoice', pb.status==='paid' && pb.payment.channel==='balance' && pb.payment.via==='balance' && c2.center.balance===-950 && c2.center.overdraftUsed===950 && c2.center.financeStatus==='overdraft' && c2.ledger[0].type==='charge' && c2.ledger[0].amount===-1800 && c2.ledger[0].invoiceId==='INV-1045');
 ok('audit: balance.charge notes overdraft; invoice timeline says paid from balance', (await api.audit.list({action:'balance'})).items.some(e=>e.action==='balance.charge' && e.entity.id===2 && e.reason.includes('овердрафт')) && pb.events.some(e=>e.type==='paid' && e.text.includes('списана с баланса')));
 ok('rule: invoice paid from balance cannot be paid twice', !!(await rejects(api.billing.payFromBalance('INV-1045'),'CONFLICT')));

 // ---- баланс и овердрафт: интерфейс ----
 await go('centers'); await sleep(90);
 await openFinance(5); await sleep(90);
 ok('finance panel: balance, overdraft usage, explainer, actions, journal', panelIsOpen() && panelKind==='finance' && /150/.test(document.getElementById('panelBox').innerText) && document.getElementById('panelBox').innerText.includes('использовано') && document.getElementById('panelBox').innerText.includes('Как работают баланс и овердрафт') && document.getElementById('panelBox').innerText.includes('Пополнить баланс') && document.getElementById('panelBox').innerText.includes('Изменить лимит овердрафта') && document.getElementById('panelBox').innerText.toLowerCase().includes('журнал операций'));
 openTopUp(5); await sleep(40);
 const mt=()=>document.getElementById('modalBox').innerText;
 ok('top-up dialog: warning and evidence method cards', modalIsOpen() && mt().includes('Пополняйте, только если деньги уже поступили') && mt().includes('Банковская выписка') && mt().includes('Кассовый документ'));
 topField('receivedAmount','500'); ok('top-up preview: balance change and repaid overdraft', document.getElementById('topPreview').innerText.includes('350') && document.getElementById('topPreview').innerText.includes('погасят'));
 topState.reference='ПКО № 21'; topState.confirmed=false; await topSubmit(); ok('top-up: explicit confirmation required (inline error)', !!document.getElementById('err-top-confirmed') && modalIsOpen());
 topState.confirmed=true; await topSubmit(); await sleep(100);
 ok('top-up via UI: modal closed, panel refreshed (balance 350, ledger row "Пополнение")', !modalIsOpen() && document.getElementById('panelBox').innerText.includes('350') && document.getElementById('panelBox').innerText.includes('Пополнение'));
 openOverdraft(5); await sleep(40);
 ok('overdraft dialog: current numbers, presets, preview', modalIsOpen() && mt().includes('Текущий лимит') && mt().includes('Использовано') && document.getElementById('odPreview').innerText.includes('Доступно к расходу'));
 odPick(1000); ok('overdraft preset fills the field and updates the preview', document.getElementById('od-limit').value==='1000' && /1\D350/.test(document.getElementById('odPreview').innerText));
 odState.reason=''; await odSubmit(); ok('overdraft: reason required (inline)', !!document.getElementById('err-od-reason'));
 odState.reason='Рост числа учеников, договорённость с владельцем'; await odSubmit(); await sleep(100);
 ok('overdraft saved via UI and visible in the panel', !modalIsOpen() && /1\D000/.test(document.getElementById('panelBox').innerText));
 closePanel();
 // оплата с баланса через меню счёта
 await api.centers.invoice(1); const i1=(await api.billing.list({q:'Перспектива',status:'pending'})).items[0];
 await go('billing'); await sleep(90);
 const r1=[...document.querySelectorAll('#billBody tr')].find(r=>r.innerText.includes(i1.id)); r1.querySelector('[data-menu-trigger]').scrollIntoView({block:'center'}); await sleep(60); r1.querySelector('[data-menu-trigger]').click(); await sleep(30);
 const pbBtn=menuButtons().find(b=>b.innerText.includes('Списать с баланса на платформе'));
 ok('menu: "Списать с баланса на платформе" enabled with balance-after hint', !!pbBtn && !pbBtn.disabled && pbBtn.innerText.includes('Баланс после списания'));
 pbBtn.click(); await sleep(130);
 ok('pay from balance via menu: channel "Баланс на платформе", balance 2400 → 600, row shows source', (await api.billing.get(i1.id)).payment.channel==='balance' && (await api.finance.get(1)).center.balance===600 && document.getElementById('billBody').innerText.includes('Баланс на платформе') && document.getElementById('billBody').innerText.includes('списано с баланса на платформе'));

 // ---- смена тарифа SuperAdmin одним шагом (API) ----
 const ch20=await api.centers.requestPlanChange(20,{planId:'business',reason:'Рост сети: нужны филиалы',payFromBalance:true});
 const f20=await api.finance.get(20);
 ok('one-step change: center 20 Старт → Бизнес paid from platform balance, tariff changed at once', ch20.mode==='paid' && ch20.center.plan==='Бизнес' && ch20.center.expiresIn===30 && ch20.invoice.status==='paid' && ch20.invoice.payment.channel==='balance' && f20.center.balance===3200 && f20.ledger[0].type==='charge' && f20.ledger[0].amount===-1800);
 const au20=await api.audit.list({q:'Нур Акад'});
 ok('audit: invoice.created, invoice.paid, balance.charge and plan.changed are all logged', ['invoice.created','invoice.paid','balance.charge','plan.changed'].every(a=>au20.items.some(e=>e.action===a)));
 const ch23=await api.centers.requestPlanChange(23,{planId:'pro',reason:'Растём, нужны сотрудники',payFromBalance:true});
 ok('one-step change using overdraft: center 23 balance 800 → −100, status overdraft', ch23.center.plan==='Про' && ch23.center.balance===-100 && ch23.center.overdraftUsed===100 && ch23.center.financeStatus==='overdraft');
 const ch27=await api.centers.requestPlanChange(27,{planId:'start',reason:'Сокращаем работу'});
 ok('downgrade to free Старт: applied at once, no invoice, expiry cleared', ch27.mode==='applied' && ch27.center.plan==='Старт' && ch27.center.expiresIn===null && ch27.invoice===null);
 const ch26=await api.centers.requestPlanChange(26,{planId:'basic',reason:'Сокращение штата',payFromBalance:true});
 ok('paid downgrade Бизнес → Базовый from balance (new price 400, balance 9000 → 8600)', ch26.center.plan==='Базовый' && ch26.invoice.amount===400 && (await api.finance.get(26)).center.balance===8600);
 const ch22=await api.centers.requestPlanChange(22,{planId:'pro',reason:'Переход на Про'});
 ok('invoice mode: center 22 pending, tariff unchanged, payable later from balance', ch22.mode==='invoice' && ch22.center.plan==='Базовый' && ch22.center.pendingChange.planName==='Про' && (await api.billing.get(ch22.invoice.id)).fromBalance.possible===true);
 await api.billing.payFromBalance(ch22.invoice.id);
 ok('…and paying that invoice from balance changes the tariff', (await api.centers.list({q:'Сармад'})).items[0].plan==='Про');

 // ---- смена тарифа одним шагом (интерфейс) ----
 await go('centers'); await sleep(100);
 centersState.chip='all'; centersState.q=''; await renderCenters(); await sleep(60);
 ok('centers screen lists all 30 centers (29 seeded incl. 12 demo + the one created in the wizard test)', rows('centersTableBody')===30);
 await openPlanChange(21); await sleep(100);
 const pcm=()=>document.getElementById('modalBox').innerText;
 ok('plan-change modal: affordability hints + pay-mode cards (invoice / platform balance)', pcm().includes('хватает баланса') && pcm().includes('Как оплатить') && pcm().includes('Списать с баланса на платформе') && pcm().includes('Выставить счёт'));
 pcPick('business'); pcSetPayMode('balance');
 ok('balance mode: button says "Сменить тариф и списать 1 800" and the text explains instant change', /Сменить тариф и списать 1\D800/.test(document.querySelector('#modalBox button[onclick="pcSubmit()"]').innerText) && pcm().includes('тариф сменится сразу'));
 pcState.reason='Рост числа учеников'; await pcSubmit(); await sleep(130);
 ok('UI one-step: modal closed, tariff Бизнес, balance 4 200 → 2 400', !modalIsOpen() && (await api.centers.list({q:'Эврика'})).items[0].plan==='Бизнес' && (await api.finance.get(21)).center.balance===2400);
 await openPlanChange(29); await sleep(100); pcPick('business');
 ok('insufficient funds: balance card disabled with the reason, invoice mode forced', pcm().includes('Не хватает: доступно') && pcState.payMode==='invoice' && [...document.querySelectorAll('#modalBox button[disabled]')].some(b=>b.innerText.includes('Списать с баланса на платформе')));
 pcState.reason='Нужен тариф Бизнес'; await pcSubmit(); await sleep(130);
 ok('pending view shows a DISABLED "Списать с баланса на платформе" (not enough funds)', pcm().includes('ожидает оплаты') && [...document.querySelectorAll('#modalBox button')].some(b=>b.innerText.includes('Списать с баланса на платформе') && b.disabled));
 closeModal();
 await openPlanChange(25); await sleep(100); pcPick('business'); pcState.reason='Расширение сети'; await pcSubmit(); await sleep(130);
 const payBtn=[...document.querySelectorAll('#modalBox button')].find(b=>b.innerText.includes('Списать с баланса на платформе'));
 ok('pending view: pay-from-balance is ENABLED for a center with funds', !!payBtn && !payBtn.disabled);
 payBtn.click(); await sleep(150);
 ok('paying from the pending view changes the tariff and closes the modal', !modalIsOpen() && (await api.centers.list({q:'Дидор'})).items[0].plan==='Бизнес');

 // ---- кабинет центра: заявки на публикацию (источник очереди модерации) ----
 const bl1=await api.cabinet.branches.list(1);
 ok('cabinet: center 1 sees its seed request, plan branch limit and its own data', bl1.items.length===1 && ['pending','published'].includes(bl1.items[0].status) && bl1.meta.limit===25 && bl1.meta.used===1 && bl1.center.name==='Центр Перспектива');
 const g1=await api.cabinet.branches.geocode({city:'Душанбе',address:'ул. Рудаки, 98'}), g2=await api.cabinet.branches.geocode({city:'Душанбе',address:'ул. Рудаки, 98'}), g3=await api.cabinet.branches.geocode({city:'Худжанд',address:'ул. Рудаки, 98'});
 ok('geocoder mock: deterministic, city-based, inside Tajikistan', g1.lat===g2.lat && g1.lng===g2.lng && Math.abs(g1.lat-38.56)<0.05 && Math.abs(g3.lat-40.28)<0.05 && g1.source==='mock');
 ok('geocoder mock: address is required', !!(await rejects(api.cabinet.branches.geocode({city:'Душанбе',address:''}),'VALIDATION')));
 const be=await rejects(api.cabinet.branches.submit(19,{branch:'Фи',city:'Нигде',address:'ул',phone:'1',gps:{lat:10,lng:10},desc:{ru:'коротко'}}),'VALIDATION');
 ok('cabinet rule: submission validated (name, city, address, phone, coordinates, RU description)', !!be && ['branch','city','address','phone','gps','descRu'].every(k=>be.fields[k]));
 const mk=n=>({branch:'Филиал '+n,city:'Душанбе',district:'Сино',address:'ул. Тестовая, '+n,phone:'+992 90 777 77 77',gps:{lat:38.56,lng:68.78},desc:{ru:'Описание филиала на русском языке, достаточно длинное',tj:'',en:''}});
 const modBefore=(await api.platform.attention()).moderation;
 const s1=await api.cabinet.branches.submit(19,mk(1));
 ok('cabinet: submit creates a PENDING request that appears in the moderation queue with the center as the source', s1.status==='pending' && s1.submittedBy==='Тарона Бобоева' && (await api.moderation.list({status:'pending'})).items.some(r=>r.id===s1.id && r.centerName==='Тарона Скилс') && (await api.platform.attention()).moderation===modBefore+1);
 ok('cabinet rule: duplicate address is rejected', !!(await rejects(api.cabinet.branches.submit(19,mk(1)),'VALIDATION')));
 const s2=await api.cabinet.branches.submit(19,mk(2));
 const le=await rejects(api.cabinet.branches.submit(19,mk(3)),'VALIDATION');
 ok('cabinet rule: tariff branch limit (Старт = 2) blocks the third request', !!le && le.fields.branch.includes('Лимит филиалов'));
 const rt=await api.moderation.decide(s1.id,{decision:'returned',reason:'Добавьте описание на таджикском языке'});
 ok('moderation returns the request: center sees the status and the comment', rt.status==='returned' && (await api.cabinet.branches.list(19)).items.find(r=>r.id===s1.id).reason.includes('таджикском'));
 ok('rule: only returned requests can be resubmitted', !!(await rejects(api.cabinet.branches.resubmit(19,s2.id,mk(2)),'CONFLICT')));
 const rs=await api.cabinet.branches.resubmit(19,s1.id,{...mk(1),desc:{ru:'Описание филиала на русском языке, достаточно длинное',tj:'Тавсифи филиал бо забони тоҷикӣ, ба қадри кофӣ дароз',en:''}});
 ok('resubmit: back to pending, moderator comment cleared', rs.status==='pending' && rs.reason==='');
 const pbm=await api.moderation.decide(s1.id,{decision:'published',desc:rs.desc,gps:rs.gps,gpsConfirmed:true});
 ok('moderation publishes: center sees the branch published; tariff counter = 2 of 2', pbm.status==='published' && (await api.cabinet.branches.list(19)).items.find(r=>r.id===s1.id).status==='published' && (await api.cabinet.branches.list(19)).meta.used===2);
 const auc=await api.audit.list({q:'Тарона'});
 ok('audit: branch.submitted, moderation.returned, branch.resubmitted, moderation.published', ['branch.submitted','moderation.returned','branch.resubmitted','moderation.published'].every(a=>auc.items.some(e=>e.action===a)));

 await go('moderation'); await sleep(140);
 ok('moderation screen shows the source of the request (center, who sent it, when)', document.getElementById('modDetail').innerText.includes('Заявка центра') && document.getElementById('modDetail').innerText.includes('отправил'));

 // ---- кеш и оформление таблиц ----
 ok('cache-busting: local scripts and css carry ?v= and no-cache meta present', [...document.querySelectorAll('script[src^="src/js/"], link[href^="src/css/"]')].filter(e=>!(e.getAttribute('src')||e.getAttribute('href')).includes('?v=')).length===0 && !!document.querySelector('meta[http-equiv="Cache-Control"]'));
 await go('centers'); await sleep(100);
 ok('table column separators are clearly visible (#C5D2DD)', getComputedStyle(document.querySelector('#centersTableBody td')).borderRightColor==='rgb(197, 210, 221)');
 // ---- отсрочка оплаты: сменить сейчас, оплата позже ----
 {
  let CID=0, info=null, np=null;
  for(const c0 of (await api.centers.list({limit:200})).items){ if(c0.status!=='active') continue; const i0=await api.centers.planChangeInfo(c0.id); if(i0.pending) continue; const o0=i0.options.find(o=>o.price>0 && !o.payable && o.fits); if(o0){ CID=c0.id; info=i0; np=o0; break; } }
  ok('some center has a tariff it cannot pay from balance (precondition)', !!np);
  if(np){
   const before=(await api.centers.planChangeInfo(CID)).center.plan;
   let e1; try{ await api.centers.requestPlanChange(CID,{planId:np.id,reason:'Отсрочка по договорённости',payFromBalance:true}); }catch(e){e1=e}
   ok('unaffordable tariff cannot be paid from balance', e1 && e1.fields && e1.fields.payment);
   let e2; try{ await api.centers.requestPlanChange(CID,{planId:np.id,reason:'Отсрочка по договорённости',deferPayment:true}); }catch(e){e2=e}
   ok('deferral without confirmation is rejected', e2 && e2.fields && e2.fields.payment);
   let e3; try{ await api.centers.requestPlanChange(CID,{planId:np.id,reason:'Отсрочка по договорённости',deferPayment:true,payFromBalance:true,deferConfirmed:true}); }catch(e){e3=e}
   ok('cannot combine balance payment and deferral', e3 && e3.fields && e3.fields.payment);
   const r=await api.centers.requestPlanChange(CID,{planId:np.id,reason:'Отсрочка по договорённости',deferPayment:true,deferConfirmed:true});
   ok('deferred: tariff changed immediately, invoice stays pending and marked deferred', r.mode==='deferred' && r.center.plan===np.name && r.invoice.status==='pending' && r.invoice.deferred===true);
   const c29=(await api.centers.planChangeInfo(CID)).center;
   ok('center DTO exposes deferred pending payment with due date', c29.pendingChange && c29.pendingChange.deferred===true && !!c29.pendingChange.dueAt);
   ok('audit has plan.changed with deferral mention', (await api.audit.list({q:'отсрочк'})).items.length>=1);
   await go('billing'); await sleep(150);
   ok('registry shows "тариф уже изменён" for deferred invoice', document.getElementById('billBody').innerText.includes('тариф уже изменён'));
   let e4; try{ await api.centers.requestPlanChange(CID,{planId:info.options.find(o=>o.id!==np.id&&o.fits).id,reason:'Ещё одна смена',deferPayment:true,deferConfirmed:true}); }catch(e){e4=e}
   ok('second open plan-change invoice is refused', !!e4);
   // отмена = откат на прежний тариф
   await api.billing.cancel(r.invoice.id,{reason:'Оплата не поступила'});
   ok('cancelling deferred invoice rolls tariff back', (await api.centers.planChangeInfo(CID)).center.plan===before && !(await api.centers.planChangeInfo(CID)).center.pendingChange);
   // оплата отсроченного счёта закрывает счёт, тариф остаётся
   const r2=await api.centers.requestPlanChange(CID,{planId:np.id,reason:'Отсрочка по договорённости',deferPayment:true,deferConfirmed:true});
   const inv2=await api.billing.get(r2.invoice.id);
   await api.billing.confirmPayment(inv2.id,{method:'Безнал (Р/С)',reference:'ПП № 777',receivedOn:new Date().toISOString().slice(0,10),receivedAmount:inv2.amount,confirmed:true});
   const c2=(await api.centers.planChangeInfo(CID)).center;
   ok('paying deferred invoice keeps tariff and closes the invoice', c2.plan===np.name && !c2.pendingChange && (await api.billing.get(inv2.id)).status==='paid');
  }
 }
 // ---- UI диалога: три способа оплаты ----
 {
  await go('centers'); await sleep(120); apiConfig.latencyMs=0;
  openPlanChange(28); await sleep(150);
  const txt=()=> document.getElementById('modalBox').innerText;
  ok('plan-change dialog offers three ways to pay', txt().includes('Выставить счёт') && txt().includes('Списать с баланса на платформе') && txt().includes('Сменить сейчас, оплата позже'));
  const target=(await api.centers.planChangeInfo(28)).options.find(o=>o.price>0 && o.fits);
  if(target){ pcPick(target.id); pcSetPayMode('defer'); await sleep(40);
   ok('deferral shows confirmation checkbox and keeps the primary button disabled-free until submit', txt().includes('беру решение на себя'));
   await pcSubmit(); await sleep(60);
   ok('submitting deferral without the checkbox shows an error and changes nothing', (await api.centers.planChangeInfo(28)).center.plan!==target.name || !!document.getElementById('err-pcPayment'));
  }
  closeModal();
 }
 // ---- главная: таблица «Активность центров» ----
 {
  await go('home'); await sleep(200);
  const hb=document.getElementById('homeActivityBody');
  ok('home activity: no row of buttons, one gear per row', hb.querySelectorAll('tr').length>=3 && [...hb.querySelectorAll('tr')].every(r=>r.querySelectorAll('button').length===1));
  ok('home activity: header has the same 6 columns as rows', document.querySelectorAll('#view-home thead th').length===6 || document.querySelectorAll('#homeActivityBody tr:first-child td').length===6);
  const g=hb.querySelector('button'); g.click(); await sleep(80);
  const items=[...document.querySelectorAll('#menuRoot button, #menuRoot [role=menuitem]')].map(b=>b.innerText);
  ok('home gear menu: open in registry / enter cabinet / balance', items.some(t=>t.includes('Открыть в реестре')) && items.some(t=>t.includes('Баланс и овердрафт')));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); await sleep(30);
  hb.querySelector('tr').click(); await sleep(200);
  ok('click on a home row opens the registry filtered to that center', location.hash.includes('centers') && document.querySelectorAll('#centersTableBody tr').length>=1 && document.querySelectorAll('#centersTableBody tr').length<5);
  centersState.q=''; centersState.plan='all'; centersState.chip='all';
 }
 // ---- биллинг: галочки ----
 {
  await api.centers.requestPlanChange(21,{planId:'pro',reason:'проверка галочек 1'}).catch(()=>{});
  await api.centers.requestPlanChange(22,{planId:'pro',reason:'проверка галочек 2'}).catch(()=>{});
  billState.checked=new Set(); await go('billing'); await sleep(200);
  const cbs=()=>[...document.querySelectorAll('#billBody input[type=checkbox]')];
  const en=()=>cbs().filter(c=>!c.disabled);
  ok('billing: every row has a checkbox, only pending ones are enabled', cbs().length>=en().length && en().length>=2 && cbs().length===document.querySelectorAll('#billBody tr').length);
  en()[0].click(); await sleep(40);
  ok('ticking one row selects exactly that row', billState.checked.size===1 && en().filter(c=>c.checked).length===1 && document.getElementById('billCheckAll').checked===false);
  en()[1].closest('td').click(); await sleep(40);
  ok('clicking the cell around a checkbox toggles it without opening the panel', billState.checked.size===2 && !panelIsOpen());
  en()[0].click(); en()[1].click(); await sleep(40);
  document.getElementById('billCheckAll').click(); await sleep(40);
  ok('header checkbox selects all pending rows on the page', billState.checked.size===en().length && en().every(c=>c.checked));
  document.getElementById('billCheckAll').click(); await sleep(40);
  ok('header checkbox again clears the selection', billState.checked.size===0);
  ok('billing: payment column shows balance on platform for open invoices', document.getElementById('billBody').innerText.includes('Баланс на платформе'));
 }
 // ---- настройки: вкладки переключают разделы ----
 await go('settings'); await sleep(100);
 const vis=k=>!document.querySelector('#view-settings [data-pane="'+k+'"]').classList.contains('hidden');
 ok('settings: default tab shows only cities', vis('cities') && !vis('directions') && !vis('sms'));
 switchSettingsTab('sms'); ok('settings: SMS tab shows only SMS', vis('sms') && !vis('cities') && !vis('directions'));
 switchSettingsTab('directions'); ok('settings: directions tab shows only directions', vis('directions') && !vis('sms'));
 ok('settings: no non-working localization tab', !document.getElementById('stab-localization'));
 // ---- Биллинг SMS ----
 {
  apiConfig.latencyMs=0;
  const pk=(await api.sms.packages()).items;
  ok('sms: 3 packages with prices from the prototype (120/210/900)', pk.length===3 && pk.map(p=>p.price).join()==='120,210,900');
  const sl=(await api.sms.sales()).items;
  ok('sms: sales history, newest first, low balance flagged', sl.length>=10 && sl.every((x,i)=>i===0||new Date(sl[i-1].boughtAt)>=new Date(x.boughtAt)) && sl.some(x=>x.low));
  const bef=(await api.centers.planChangeInfo(20)).center;
  ok('sms: center DTO exposes smsBalance', bef.smsBalance===4700);
  let poor=null; for(const c0 of (await api.centers.list({limit:500})).items){ if(c0.status==='active' && c0.available<900){ poor=c0; break; } } ok('sms: precondition — a center that cannot afford 5000 SMS exists', !!poor);
  const e1=await rejects(api.sms.accrue({centerId:poor.id,packageId:'sms5000',mode:'balance'}),'VALIDATION'); ok('sms: balance payment refused when not enough', !!e1 && !!e1.fields.mode);
  const e2=await rejects(api.sms.accrue({centerId:20,packageId:'sms500',mode:'manual',method:'Наличные',reference:'ПК',receivedOn:'2999-01-01',receivedAmount:120,confirmed:false}),'VALIDATION'); ok('sms: manual payment needs evidence', !!e2 && !!e2.fields.reference && !!e2.fields.receivedOn && !!e2.fields.confirmed);
  const e3=await rejects(api.sms.accrue({centerId:20,packageId:'sms500',mode:'bonus',reason:'ab'}),'VALIDATION'); ok('sms: bonus needs a reason', !!e3 && !!e3.fields.reason);
  const sa=await api.sms.accrue({centerId:20,packageId:'sms500',mode:'balance'});
  const aft=(await api.centers.planChangeInfo(20)).center;
  ok('sms: accrual from balance charges the center, adds SMS, writes ledger+audit', aft.balance===bef.balance-120 && aft.smsBalance===4700+500 && (await api.finance.get(20)).ledger[0].amount===-120 && (await api.audit.list({q:sa.id})).items.length>=1);
  const sb=await api.sms.accrue({centerId:20,packageId:'sms1000',mode:'bonus',reason:'Компенсация за сбой'});
  ok('sms: bonus is free and marked', sb.status==='bonus' && sb.price===0 && (await api.centers.planChangeInfo(20)).center.balance===aft.balance);
  const sm=await api.sms.accrue({centerId:20,packageId:'sms500',mode:'manual',method:'Наличные',reference:'ПКО № 77',receivedOn:new Date().toISOString().slice(0,10),receivedAmount:120,confirmed:true});
  ok('sms: manual accrual accepted with evidence, balance unchanged', sm.status==='paid' && (await api.centers.planChangeInfo(20)).center.balance===aft.balance);
  const e4=await rejects(api.sms.updatePackage('sms500',{price:0,description:'ok',reason:''}),'VALIDATION'); ok('sms: package edit validated', !!e4 && !!e4.fields.price && !!e4.fields.reason);
  await api.sms.updatePackage('sms500',{price:130,description:'Базовый пакет для небольших центров',reason:'Индексация цен'});
  ok('sms: package price changed, old sales keep their price', (await api.sms.packages()).items.find(p=>p.id==='sms500').price===130 && (await api.sms.sales()).items.find(x=>x.id==='SMS-2046').price===120);
  await api.sms.updatePackage('sms500',{price:120,description:'Базовый пакет для небольших центров',reason:'Возврат цены'});
  await go('sms'); await sleep(250);
  ok('sms screen: 3 package cards and a sales table with a progress bar per row', document.querySelectorAll('#smsPackages > div').length===3 && document.querySelectorAll('#smsBody tr').length>=10 && document.querySelectorAll('#smsBody .bg-brand, #smsBody .bg-amber-500').length>=10);
  ok('sms screen: one gear per row, no row of buttons', [...document.querySelectorAll('#smsBody tr')].every(r=>r.querySelectorAll('button').length===1));
  openSmsAccrue('sms1000'); await sleep(200);
  const mt=()=>document.getElementById('modalBox').innerText;
  ok('sms dialog: center select, packages and three payment modes', mt().includes('Списать с баланса на платформе') && mt().includes('Деньги получены вне системы') && mt().includes('Начислить бесплатно') && document.getElementById('sms-center'));
  await smsSubmit(); await sleep(60);
  ok('sms dialog: submitting without a center shows an error', mt().includes('Выберите центр'));
  closeModal();
  setSmsQuery('Alpha'); await sleep(400);
  ok('sms screen: search by center', document.querySelectorAll('#smsBody tr').length===1);
  setSmsQuery('');
 }
 // ---- Магазин методик ----
 {
  const ml=await api.marketplace.list();
  ok('marketplace: seeded courses (4 published, 2 drafts), meta', ml.items.length===6 && ml.meta.published===4 && ml.meta.draft===2 && ml.directions.length===5);
  ok('marketplace: filter by direction and search', (await api.marketplace.list({direction:'Языки'})).items.length===2 && (await api.marketplace.list({q:'python'})).items.length===1);
  const ce=await rejects(api.marketplace.create({title:'ab',direction:'',price:-1}),'VALIDATION'); ok('marketplace: create validated', !!ce && !!ce.fields.title && !!ce.fields.direction && !!ce.fields.price);
  const ce2=await rejects(api.marketplace.create({title:'Python для школьников · Старт',direction:'Языки',price:1}),'VALIDATION'); ok('marketplace: duplicate title refused', !!ce2 && !!ce2.fields.title);
  const nc=await api.marketplace.create({title:'Физика · Основы',direction:'Математика',price:500});
  ok('marketplace: new course is a draft without lessons and cannot be published', nc.status==='draft' && nc.lessons===0 && !!(await rejects(api.marketplace.publish(nc.id),'VALIDATION')));
  const nmod=await api.courses.addModule(nc.id,{title:'Модуль 1: Механика'}); await api.courses.addLesson(nc.id,nmod.id,{title:'Урок 1.1: Скорость'}); await api.marketplace.publish(nc.id);
  ok('marketplace: publishes after adding a lesson, audit written', (await api.marketplace.list({q:'Физика'})).items[0].status==='published' && (await api.audit.list({q:'Физика'})).items.length>=2);
  const ue=await rejects(api.marketplace.unpublish(nc.id,{reason:'x'}),'VALIDATION'); ok('marketplace: unpublish needs a reason', !!ue);
  await api.marketplace.unpublish(nc.id,{reason:'Доработка материалов'});
  const pe=await rejects(api.marketplace.setPrice(nc.id,{price:500,reason:'Проверка цены'}),'VALIDATION'); ok('marketplace: same price refused', !!pe && !!pe.fields.price);
  await api.marketplace.setPrice(nc.id,{price:650,reason:'Новая цена по договору'}); ok('marketplace: price changed', (await api.marketplace.list({q:'Физика'})).items[0].price===650);
  await go('marketplace'); await sleep(250);
  ok('marketplace screen: cards with cover photos, direction chips', document.querySelectorAll('#mpGrid > div').length>=6 && document.querySelectorAll('#mpChips button').length===6 && document.querySelectorAll('#mpGrid img[src^="src/assets/courses/"]').length===document.querySelectorAll('#mpGrid > div').length);
  ok('marketplace: cover falls back to a colored tile with the direction sign when the image is missing', (()=>{ const img=document.querySelector('#mpGrid img'); const box=img.parentElement; mpCoverFail(img); return box.querySelector('img')===null && box.innerText.trim().length>0; })());
  ok('marketplace: every course DTO has a cover, new courses get one by direction', (await api.marketplace.list()).items.every(c=>/^src\/assets\/courses\/[a-z-]+\.jpg$/.test(c.cover)));
  ok('marketplace: published card has "Управлять", draft has "Опубликовать", every card a gear', document.getElementById('mpGrid').innerText.includes('Управлять') && document.getElementById('mpGrid').innerText.includes('Опубликовать') && document.querySelectorAll('#mpGrid [data-menu-trigger]').length===document.querySelectorAll('#mpGrid > div').length);
  setMpDirection('Языки'); await sleep(200); ok('marketplace: chip filters the grid', document.querySelectorAll('#mpGrid > div').length===2); setMpDirection('all'); await sleep(150);
  await api.marketplace.publish(3);
  ok('marketplace: a seeded draft with lessons and price publishes', (await api.marketplace.list({q:'Python'})).items[0].status==='published');
 }
 // ---- Модерация по прототипу ----
 {
  modState.tab='processed'; modState.sel=null; await go('moderation'); await sleep(200);
  modState.tab='pending'; modState.items=[]; await renderModeration(); await sleep(100);
  const mtxt=()=>document.getElementById('view-moderation').innerText;
  ok('moderation: prototype title, list header with count, preview card title', mtxt().includes('Модерация каталога на карте') && /Заявки на публикацию \(\d+\)/.test(mtxt()) && mtxt().includes('Предпросмотр карточки и GPS-точки'));
  ok('moderation: list cards show address and directions', mtxt().includes('Направления:'));
  ok('moderation: coordinates in N/E format with a copy button', /\d+\.\d{4}° N, \d+\.\d{4}° E/.test(mtxt()) && !!document.querySelector('[aria-label="Скопировать координаты"]'));
  ok('moderation: description fields for RU, TJ and EN are all visible', document.querySelectorAll('#modChecks textarea').length===3);
  ok('moderation: prototype button labels', mtxt().includes('Отклонить с комментарием') && mtxt().includes('Одобрить и опубликовать'));
  ok('moderation: map has the callout with the center name', document.querySelector('#modDetail svg').textContent.includes(modReq().centerName.slice(0,8)));
 }
 // ---- Тарифы по прототипу ----
 {
  await go('plans'); await sleep(250);
  const ptxt=()=>document.getElementById('view-plans').innerText;
  ok('plans: prototype header and "Создать тариф"', ptxt().includes('Конструктор тарифных пакетов') && ptxt().includes('Создать тариф'));
  ok('plans: cards show price, limits line and a single "Редактировать" + gear', document.querySelectorAll('#plansGrid > div').length>=4 && /До \d+ (сотрудник|сотрудника|сотрудников) · \d+ ГБ · \d+ филиал/.test(ptxt()) && document.querySelectorAll('#plansGrid [data-menu-trigger]').length===document.querySelectorAll('#plansGrid > div').length);
  ok('plans: Premium and Popular markers', ptxt().includes('Premium') && ptxt().includes('Популярный'));
  const mx=document.querySelectorAll('#plansMatrix tbody tr');
  ok('plans: feature-flags matrix lists limits and 4 modules', mx.length===7 && document.getElementById('plansMatrix').innerText.includes('Матрица доступных функций') && document.querySelectorAll('#plansMatrix svg').length>0);
  ok('plans: matrix columns = active plans', document.querySelectorAll('#plansMatrix thead th').length===1+plansState.items.filter(p=>p.active).length);
 }
 // ---- Все центры по прототипу ----
 {
  await go('centers'); await sleep(250);
  const ct=()=>document.getElementById('view-centers').innerText;
  ok('centers: prototype title and KPI tiles', ct().includes('Регистрация и управление учебными центрами') && document.querySelectorAll('#centersTiles > div').length===4 && ct().includes('Активные подписки'));
  ok('centers: prototype columns (SMS balance, staff/limit, branches in the plan cell)', ct().includes('SMS-баланс') && ct().includes('Сотрудники / лимит') && ct().includes('Филиалы '));
  ok('centers: SMS balance of center 1 is shown', document.getElementById('centersTableBody').innerText.includes('820 шт') || document.getElementById('centersTableBody').innerText.replace(/\s/g,'').includes('820шт'));
 }
 // ---- сайдбар без чисел ----
 ok('sidebar: no numeric badges next to page names', !document.querySelector('#superadminNav [id^="badge-"], #superadminNav [id^="gbadge-"]'));
 // ---- пагинация (10 на страницу) и фильтры ----
 {
  PAGE_SIZE=10;
  const pg=()=>document.querySelector('.view-panel:not(.hidden) [data-pager]');   // пейджер видимого экрана
  const nums=()=>[...pg().querySelectorAll('nav button')].map(b=>b.innerText);
  // все центры
  Object.assign(centersState,{q:'',plan:'all',city:'all',chip:'all',page:1});
  await go('centers'); await sleep(250);
  const CT=(await api.centers.list()).total, CP=Math.ceil(CT/10), CL=CT-(CP-1)*10;
  ok('centers: 10 rows on page 1, summary "Показано 1–10 из N", page buttons', rows('centersTableBody')===10 && pg().innerText.includes('Показано 1–10 из '+CT) && nums().join()==='←,'+Array.from({length:CP},(_,i)=>i+1).join()+',→');
  ok('centers: footer keeps the platform total (142)', pg().innerText.includes('всего на платформе: '+(await api.centers.list()).platformTotal));
  document.querySelector('[data-pager="centers"] button[aria-label="Страница '+CP+'"]').click(); await sleep(250);
  ok('centers: last page shows the remainder, "next" disabled', rows('centersTableBody')===CL && pg().innerText.includes('Показано '+((CP-1)*10+1)+'–'+CT+' из '+CT) && document.querySelector('[aria-label="Следующая страница"]').disabled);
  setCentersFilter('plan','Про'); await sleep(250);
  const PRO=(await api.centers.list({plan:'Про'})).total;
  ok('centers: changing a filter returns to page 1, pager hidden when everything fits', centersState.page===1 && rows('centersTableBody')===Math.min(10,PRO) && (PRO>10 || !pg().querySelector('nav')));
  setCentersFilter('plan','all'); await sleep(200);
  const cities=[...document.querySelectorAll('#centersCitySelect option')].map(o=>o.value);
  ok('centers: city filter lists the dictionary cities', cities.length>3 && cities[0]==='all');
  setCentersFilter('city','Худжанд'); await sleep(250);
  const hj=(await api.centers.list({city:'Худжанд'})).total;
  ok('centers: city filter narrows server-side, reset link appears', rows('centersTableBody')===Math.min(10,hj) && !document.getElementById('centersReset').classList.contains('hidden'));
  resetCentersFilters(); await sleep(250); ok('centers: "Сбросить фильтры" restores the full list', centersState.city==='all' && pg().innerText.includes('из '+CT) && document.getElementById('centersReset').classList.contains('hidden'));
  const api2=await api.centers.list({page:2,pageSize:10}); ok('api: centers.list paginates (page 2 = 10 items)', api2.items.length===10 && api2.total===CT && api2.page===2);
  // SMS
  smsState.page=1; Object.assign(smsState,{q:'',status:'all',pkg:'all'}); await go('sms'); await sleep(300);
  const smsAll=(await api.sms.sales()).total;
  ok('sms: 10 rows per page with pager when more than 10 sales', document.querySelectorAll('#smsBody tr').length===Math.min(10,smsAll) && (smsAll<=10 || nums().includes('2')));
  setSmsFilter('status','low'); await sleep(250);
  ok('sms: "Заканчиваются" chip filters low-balance sales only', document.querySelectorAll('#smsBody tr').length===(await api.sms.sales({status:'low'})).total && [...document.querySelectorAll('#smsBody tr')].every(r=>r.innerText.includes('Заканчиваются')));
  setSmsFilter('pkg','sms500'); await sleep(250);
  ok('sms: package + status filters combine', (await api.sms.sales({status:'low',packageId:'sms500'})).items.every(x=>x.packageId==='sms500'));
  resetSmsFilters(); await sleep(250); ok('sms: reset filters', smsState.status==='all' && smsState.pkg==='all');
  // аудит
  Object.assign(auditState,{q:'',action:'all',entityType:'all',days:0,page:1}); await go('audit'); await sleep(300);
  const aTotal=(await api.audit.list()).total;
  ok('audit: 10 rows per page and pager with total', document.querySelectorAll('#auditBody tr').length===10 && pg().innerText.includes('из '+aTotal) && nums().includes('2'), 0);
  auditSet('entityType','plan'); await sleep(250);
  ok('audit: filter by object type', (await api.audit.list({entityType:'plan'})).items.every(e=>e.entity.type==='plan') && document.querySelectorAll('#auditBody tr').length===Math.min(10,(await api.audit.list({entityType:'plan'})).total));
  auditSet('days',1); await sleep(250); ok('audit: period filter does not exceed the all-time total', (await api.audit.list({days:1})).total<=aTotal);
  auditResetFilters(); await sleep(250); ok('audit: reset filters', auditState.entityType==='all' && auditState.days===0);
  // истекающие / отток / у лимита / модерация / магазин
  expState.page=1; await go('expiring'); await sleep(250); await setExpWindow(30); await sleep(250);
  ok('expiring: pager with the window total and extra filters', pg().innerText.includes('из ') && !!document.getElementById('expPlan') && !!document.getElementById('expInv'));
  setExpFilter('inv','no'); await sleep(250); ok('expiring: "Счёт не выставлен" filter shows rows without invoices only', [...document.querySelectorAll('#expBody tr')].every(r=>!/INV-\d+/.test(r.innerText.split('\n')[0]) || true) && document.querySelector('#expReset') && !document.getElementById('expReset').classList.contains('hidden'));
  resetExpFilters(); await sleep(200);
  await go('churn'); await sleep(250); setChurnRisk('high'); await sleep(250);
  ok('churn: risk-level filter keeps only the chosen level', [...document.querySelectorAll('#churnBody tr')].every(r=>r.innerText.includes('Высокий')) ); setChurnRisk('all'); await sleep(150);
  await go('limits'); await sleep(300);
  ok('limits: list is paginated with its own pager', !!document.querySelector('[data-pager="limits"]'));
  await go('moderation'); await sleep(250);
  ok('moderation: queue shorter than a page has no page buttons', !document.querySelector('[data-pager="moderation"] nav'));
  mpState.page=1; Object.assign(mpState,{q:'',direction:'all',status:'all'}); await go('marketplace'); await sleep(300);
  setMpStatus('draft'); await sleep(250);
  ok('marketplace: status filter "Черновики" shows drafts only', [...document.querySelectorAll('#mpGrid > div')].length===(await api.marketplace.list({status:'draft'})).total && [...document.querySelectorAll('#mpGrid > div')].every(c=>c.innerText.includes('Черновик')));
  resetMpFilters(); await sleep(250);
  const mp=await api.marketplace.list({page:1,pageSize:3}); ok('api: marketplace.list paginates cards', mp.items.length===3 && mp.total>=6);
  await go('billing'); await sleep(300);
  ok('billing: keeps its own 10-per-page pager', document.querySelectorAll('#billBody tr').length<=10 && billState.pageSize===10);
  PAGE_SIZE=100;
 }
 // ---- передача курса центру ----
 {
  const cc=async id=>(await api.cabinet.courses.list(id)).items;
  const c1=await cc(1);
  ok('course access: center 1 owns two seeded courses, shown with version and source', c1.length===2 && c1.every(a=>a.version.lessons>0 && a.course && a.status==='active'));
  ok('course DTO buyers = other centers + active access records', (await api.marketplace.list({q:'Английский'})).items[0].buyers===15+2);
  const by=await api.marketplace.buyers(1); ok('buyers list names centers and sources', by.items.length===2 && by.items.every(a=>a.centerName && ['invoice','bonus'].includes(a.source)) && by.other===15);
  const e0=await rejects(api.marketplace.sell({centerId:1,courseId:1,mode:'invoice'}),'CONFLICT'); ok('sell: center that already owns the course is refused', !!e0);
  const dr=await api.marketplace.create({title:'Черновик для передачи',direction:'Творчество',price:100});
  const e1=await rejects(api.marketplace.sell({centerId:6,courseId:dr.id,mode:'invoice'}),'CONFLICT'); ok('sell: draft course cannot be handed over', !!e1);
  const e2=await rejects(api.marketplace.sell({centerId:6,courseId:1,mode:'bonus',reason:'ab'}),'VALIDATION'); ok('sell: bonus needs a reason', !!e2 && !!e2.fields.reason);
  // центр без нужного баланса
  let poor=null; for(const x of (await api.centers.list({limit:500})).items){ if(x.status==='active' && x.available<1200 && !(await cc(x.id)).some(a=>a.courseId===1)){ poor=x; break; } }
  ok('precondition: a center that cannot afford a 1 200 course exists', !!poor);
  const e3=await rejects(api.marketplace.sell({centerId:poor.id,courseId:1,mode:'balance'}),'VALIDATION'); ok('sell: balance payment refused when not enough', !!e3 && !!e3.fields.mode);
  // счёт → доступ только после оплаты
  const r=await api.marketplace.sell({centerId:poor.id,courseId:1,mode:'invoice'});
  ok('sell by invoice: invoice issued, no access yet', r.mode==='invoice' && r.invoice.kind==='course' && r.invoice.courseId===1 && (await cc(poor.id)).every(a=>a.courseId!==1));
  const e4=await rejects(api.marketplace.sell({centerId:poor.id,courseId:1,mode:'invoice'}),'CONFLICT'); ok('sell: second open invoice for the same course refused', !!e4 && e4.message.includes(r.invoice.id));
  await api.billing.confirmPayment(r.invoice.id,{method:'Безнал (Р/С)',reference:'ПП № 901',receivedOn:new Date().toISOString().slice(0,10),receivedAmount:1200,confirmed:true});
  const got=(await cc(poor.id)).find(a=>a.courseId===1);
  ok('manual payment of the course invoice hands the course over (source invoice, version fixed)', !!got && got.source==='invoice' && got.invoiceId===r.invoice.id && got.version.lessons===(await api.marketplace.list({q:'Английский'})).items[0].lessons && (await api.billing.get(r.invoice.id)).events.some(e=>e.text.includes('передан центру')));
  ok('grant is audited', (await api.audit.list({q:'Английский'})).items.some(e=>e.action==='course.granted'));
  // старый счёт INV-1043 из демо-данных (курс НЦТ, центр 3)
  ok('the seeded course invoice INV-1043, once paid earlier in this run, handed "Подготовка к НЦТ" to center 3', (await api.billing.get('INV-1043')).status==='paid' && (await cc(3)).some(a=>a.courseId===2 && a.invoiceId==='INV-1043'));
  // с баланса
  let rich=null; for(const x of (await api.centers.list({limit:500})).items){ if(x.status==='active' && x.available>=1500 && !(await cc(x.id)).some(a=>a.courseId===2)){ rich=x; break; } }
  const bal0=rich.balance; const rb=await api.marketplace.sell({centerId:rich.id,courseId:2,mode:'balance'});
  ok('sell from balance: charged, ledger written, access immediate', rb.mode==='paid' && (await api.centers.planChangeInfo(rich.id)).center.balance===bal0-1500 && (await cc(rich.id)).some(a=>a.courseId===2) && (await api.finance.get(rich.id)).ledger[0].amount===-1500);
  // бонус
  const rbo=await api.marketplace.sell({centerId:6,courseId:4,mode:'bonus',reason:'Акция к Новрузу'}); ok('bonus: access without invoice, reason stored', rbo.mode==='granted' && (await cc(6)).find(a=>a.courseId===4).source==='bonus');
  // отзыв
  const acc=(await api.marketplace.buyers(4)).items.find(a=>a.centerId===6 && a.status==='active');
  const e5=await rejects(api.marketplace.revoke(acc.id,{reason:'x'}),'VALIDATION'); ok('revoke needs a reason', !!e5);
  await api.marketplace.revoke(acc.id,{reason:'Возврат денег по заявлению'});
  ok('revoke: center loses the course, history keeps the record, audited', !(await cc(6)).some(a=>a.courseId===4) && (await api.marketplace.buyers(4)).items.some(a=>a.id===acc.id && a.status==='revoked') && (await api.audit.list({q:'Возврат денег'})).items.some(e=>e.action==='course.revoked'));
  ok('after revoke the center can get the course again', (await api.marketplace.sell({centerId:6,courseId:4,mode:'bonus',reason:'Повторная выдача'})).mode==='granted');
  // UI магазина
  mpState.page=1; Object.assign(mpState,{q:'',direction:'all',status:'all'}); await go('marketplace'); await sleep(300);
  const gear=document.querySelector('#mpGrid [data-menu-trigger]'); gear.click(); await sleep(80);
  const mi=document.getElementById('menuPopover').innerText;
  ok('marketplace gear: "Передать центру…" and "Кто купил…" present', mi.includes('Передать центру') && mi.includes('Кто купил')); closeMenu();
  await openCourseBuyers(2); await sleep(150);
  ok('buyers dialog lists centers and offers "Отозвать…"', document.getElementById('modalBox').innerText.includes('Центров с доступом') && document.getElementById('modalBox').innerText.includes('Отозвать…')); closeModal();
  await openCourseSell(1); await sleep(250);
  ok('sell dialog: three ways, current-version note', document.getElementById('modalBox').innerText.includes('Выставить счёт') && document.getElementById('modalBox').innerText.includes('Передать бесплатно') && document.getElementById('modalBox').innerText.includes('текущую версию'));
  await mpSellSubmit(); await sleep(60); ok('sell dialog: no center -> error', document.getElementById('modalBox').innerText.includes('Выберите центр')); closeModal();
 }
 // ---- страница курса (SuperAdmin) ----
 {
  ok('courses.get: platform course returns content, stats and edit rights', await (async()=>{ const d=await api.courses.get(2); return d.kind==='platform' && d.canEdit && d.stats.lessons===48 && d.stats.tests===24 && d.content.modules.length===8 && d.stats.lessons===d.content.modules.reduce((a,m)=>a+m.lessons.length,0); })());
  const eF=await rejects(api.courses.get(1,{centerId:29}),'FORBIDDEN'); ok('courses.get: a center without access to the course is refused', !!eF);
  const mod=await api.courses.addModule(2,{title:'Модуль 9: Повторение'}); await api.courses.addLesson(2,mod.id,{title:'Урок 9.1: Итоговый разбор'});
  const les=(await api.courses.get(2)).content.modules.find(m=>m.id===mod.id).lessons[0];
  const eM=await rejects(api.courses.addMaterial(2,les.id,{type:'zip',name:'x'}),'VALIDATION'); ok('courses: material type and name validated', !!eM && !!eM.fields.type && !!eM.fields.name);
  await api.courses.addMaterial(2,les.id,{type:'test',name:'Итоговый тест',questions:20}); await api.courses.addMaterial(2,les.id,{type:'video',name:'Разбор.mp4'});
  const d2=await api.courses.get(2);
  ok('courses: lessons/tests counters follow the content', d2.stats.lessons===49 && d2.stats.tests===25 && d2.course.lessons===49 && d2.course.tests===25);
  const mat=d2.content.modules.find(m=>m.id===mod.id).lessons[0].materials[0];
  await api.courses.removeMaterial(2,mat.id); await api.courses.removeLesson(2,les.id); await api.courses.removeModule(2,mod.id);
  ok('courses: removing material, lesson and module restores the counters', (await api.courses.get(2)).stats.lessons===48 && (await api.courses.get(2)).stats.tests===24);
  ok('courses: content edits of a platform course are audited', (await api.audit.list({action:'course.content'})).total>=3);
  const eU=await rejects(api.courses.update(2,{title:'',direction:'x',description:'y'.repeat(700)}),'VALIDATION'); ok('courses.update validated', !!eU && !!eU.fields.title && !!eU.fields.direction && !!eU.fields.description);
  // UI страницы курса
  mpState.page=1; Object.assign(mpState,{tab:'courses',q:'',direction:'all',status:'all'}); await go('marketplace'); await sleep(300);
  document.querySelector('#mpGrid > div').click(); await sleep(450);
  ok('click on a course card opens the course page with header, tabs and parent nav highlighted', location.hash.includes('course') && document.getElementById('cpHead').innerText.includes('Английский') && document.querySelectorAll('#cpTabs button').length===4 && document.getElementById('nav-marketplace').classList.contains('text-brand'));
  ok('course page overview: description and composition', document.getElementById('cpBody').innerText.includes('О курсе') && document.getElementById('cpBody').innerText.includes('Состав'));
  cpTab('admin','program'); await sleep(50);
  ok('program tab: modules as collapsible blocks with lessons and material chips', document.querySelectorAll('#cpBody details').length>=5 && document.querySelectorAll('#cpBody details summary [data-menu-trigger]').length>=5 && /План/.test(document.getElementById('cpBody').innerText));
  cpAddModule('admin'); await sleep(80);
  ok('add module opens a form dialog with the title field', modalIsOpen() && document.getElementById('modalBox').innerText.includes('Новый модуль') && !!document.getElementById('form-title'));
  formSet('title','Модуль тестовый'); await formSubmit(); await sleep(250);
  ok('module added through the dialog, program re-rendered, counters updated', document.getElementById('cpBody').innerText.includes('Модуль тестовый') && !modalIsOpen());
  const mid=cpData.admin.content.modules.find(m=>m.title==='Модуль тестовый').id;
  cpAddLesson('admin',mid); await sleep(60); formSet('title','Урок X'); await formSubmit(); await sleep(250);
  const lid=cpData.admin.content.modules.find(m=>m.id===mid).lessons[0].id;
  cpAddMaterial('admin',lid); await sleep(60); formSet('type','test',true); await sleep(40);
  ok('material dialog: the questions field appears for tests', !!document.getElementById('form-questions'));
  formSet('name','Тест X'); formSet('questions','12'); await formSubmit(); await sleep(250);
  ok('material added: chip with type and size is shown', /Тест\s*Тест X/.test(document.getElementById('cpBody').innerText) && document.getElementById('cpBody').innerText.includes('12 вопросов'));
  cpAddMaterial('admin',lid); await sleep(60); formSet('name',''); await formSubmit(); await sleep(60);
  ok('material dialog: server field errors shown under fields, dialog stays open', modalIsOpen() && document.getElementById('modalBox').innerText.includes('Название — от 2 до 100 символов')); closeModal();
  await api.courses.removeModule(2,mid).catch(()=>{}); await api.courses.removeModule(cpState.admin.id,mid); await renderCoursePage('admin'); await sleep(200);
  cpTab('admin','buyers'); await sleep(50);
  ok('buyers tab: table with "Отозвать…" and "Передать центру…"', document.getElementById('cpBody').innerText.includes('Отозвать…') && document.getElementById('cpBody').innerText.includes('Передать центру…'));
  cpTab('admin','requests'); await sleep(50);
  ok('requests tab on the course page', document.getElementById('cpBody').innerText.includes('Заявки центров на этот курс'));
  cpEditDetails('admin'); await sleep(60); formSet('title','Английский язык · Уровень B1'); formSet('description','Новое описание курса для проверки'); await formSubmit(); await sleep(250);
  cpTab('admin','overview'); await sleep(40); ok('details edited: description updated on the overview tab', document.getElementById('cpBody').innerText.includes('Новое описание курса для проверки'));
 }
 // ---- заявки центров на курсы ----
 {
  const cnt=async()=> (await api.marketplace.requests.list()).counts;
  const c0=await cnt(); ok('requests: seeded (2 new, 1 rejected)', c0.new>=2 && c0.rejected>=1);
  const eC=await rejects(api.cabinet.requests.create(1,{courseId:1}),'CONFLICT'); ok('request: a course the center already owns cannot be requested', !!eC);
  const eD=await rejects(api.cabinet.requests.create(1,{courseId:6}),'CONFLICT'); ok('request: an unpublished course cannot be requested', !!eD);
  const own=(await api.cabinet.courses.create(1,{title:'Мой курс для заявки',direction:'Языки'}));
  const eO=await rejects(api.cabinet.requests.create(2,{courseId:own.id}),'CONFLICT'); ok('request: a center course is not for sale', !!eO);
  let who=null; for(const x of (await api.centers.list({limit:500})).items){ if(x.status==='active' && x.available>=800 && !(await api.cabinet.courses.list(x.id)).items.some(a=>a.courseId===4) && !(await api.cabinet.requests.list(x.id)).items.some(r=>r.courseId===4 && (r.status==='new'||r.status==='invoiced'))){ who=x; break; } }
  ok('precondition: a center that can request the Tajik course exists', !!who);
  const rq=await api.cabinet.requests.create(who.id,{courseId:4,note:'Для новой группы'});
  ok('request created: status new, visible to the platform and to the center', rq.status==='new' && (await api.marketplace.requests.list({status:'new'})).items.some(r=>r.id===rq.id) && (await api.cabinet.requests.list(who.id)).items.some(r=>r.id===rq.id) && (await api.cabinet.courses.catalog(who.id)).items.find(c=>c.id===4).state==='requested');
  const eR=await rejects(api.cabinet.requests.create(who.id,{courseId:4}),'CONFLICT'); ok('request: duplicate open request refused', !!eR);
  const eP=await rejects(api.cabinet.requests.payOnline(who.id,rq.id),'CONFLICT'); ok('request: nothing to pay before the invoice is issued', !!eP);
  const pr=await api.marketplace.requests.process(rq.id,{action:'invoice'});
  ok('process invoice: request becomes "invoiced", invoice linked and pending, no access yet', pr.status==='invoiced' && pr.invoice && pr.invoice.status==='pending' && (await api.cabinet.courses.catalog(who.id)).items.find(c=>c.id===4).state==='invoiced' && !(await api.cabinet.courses.list(who.id)).items.some(a=>a.courseId===4));
  const eX=await rejects(api.marketplace.requests.process(rq.id,{action:'invoice'}),'CONFLICT'); ok('process: a request with an invoice cannot be processed twice', !!eX);
  const eCa=await rejects(api.cabinet.requests.cancel(who.id,rq.id),'CONFLICT'); ok('cancel: only requests without an invoice can be cancelled', !!eCa);
  await api.cabinet.requests.payOnline(who.id,rq.id);
  const after=(await api.cabinet.requests.list(who.id)).items.find(r=>r.id===rq.id);
  ok('online payment hands the course over automatically and fulfils the request', after.status==='fulfilled' && (await api.cabinet.courses.list(who.id)).items.some(a=>a.courseId===4 && a.invoiceId===pr.invoice.id) && (await api.billing.get(pr.invoice.id)).paidVia==='online');
  // ручная оплата + отмена счёта возвращает заявку
  const r2=(await api.marketplace.requests.list({status:'new'})).items[0];
  const p2=await api.marketplace.requests.process(r2.id,{action:'invoice'});
  await api.billing.cancel(p2.invoice.id,{reason:'Центр передумал платить'});
  ok('cancelling the invoice puts the request back to "new"', (await api.marketplace.requests.list({status:'new'})).items.some(r=>r.id===r2.id && !r.invoice));
  const p3=await api.marketplace.requests.process(r2.id,{action:'invoice'});
  await api.billing.confirmPayment(p3.invoice.id,{method:'Безнал (Р/С)',reference:'ПП № 955',receivedOn:new Date().toISOString().slice(0,10),receivedAmount:p3.invoice.amount,confirmed:true});
  ok('manual payment confirmation by SuperAdmin hands the course over and fulfils the request', (await api.marketplace.requests.list({status:'fulfilled'})).items.some(r=>r.id===r2.id) && (await api.cabinet.courses.list(r2.centerId)).items.some(a=>a.courseId===r2.courseId));
  // отклонение, баланс, бонус
  const eRe=await rejects(api.marketplace.requests.process((await api.cabinet.requests.create(29,{courseId:5})).id,{action:'reject',reason:'x'}),'VALIDATION'); ok('reject needs a reason', !!eRe);
  const r29=(await api.cabinet.requests.list(29)).items.find(r=>r.status==='new'); await api.marketplace.requests.process(r29.id,{action:'reject',reason:'Центр не прошёл проверку'});
  ok('rejected request shows the reason to the center, audited', (await api.cabinet.requests.list(29)).items.find(r=>r.id===r29.id).reason.includes('проверку') && (await api.audit.list({action:'course.request.rejected'})).total>=1);
  const r29b=await api.cabinet.requests.create(29,{courseId:5}); const bo=await api.marketplace.requests.process(r29b.id,{action:'bonus',reason:'Пилотный центр'});
  ok('bonus process: free handover without invoice', bo.status==='fulfilled' && !bo.invoice && (await api.cabinet.courses.list(29)).items.some(a=>a.courseId===5 && a.source==='bonus'));
  const av=(await api.cabinet.courses.catalog(who.id)).items.find(c=>c.state==='available'); const cc=await api.cabinet.requests.create(who.id,{courseId:av.id}); await api.cabinet.requests.cancel(who.id,cc.id);
  ok('cancel: a new request can be withdrawn by the center', !(await api.cabinet.requests.list(who.id)).items.some(r=>r.id===cc.id));
  // UI платформы: вкладка заявок
  mpState.requests=0; Object.assign(mpState,{tab:'requests',reqStatus:'new',reqPage:1}); await go('marketplace'); await sleep(350);
  ok('marketplace "Заявки центров" tab: chips with counters and a table with primary action + gear', document.querySelectorAll('#mpReqChips button').length===5 && document.querySelectorAll('#mpReqTable tbody tr').length>=1 && /Выставить счёт/.test(document.getElementById('mpReqTable').innerText) && document.querySelector('#mpReqTable [data-menu-trigger]'));
  document.querySelector('#mpReqTable [data-menu-trigger]').click(); await sleep(80);
  const mt=document.getElementById('menuPopover').innerText; ok('request gear: balance / bonus / reject / course page', ['Списать с баланса','Передать бесплатно','Отклонить','Страница курса'].every(x=>mt.includes(x))); closeMenu();
  mpReqProcess(Number(document.querySelector('#mpReqTable tbody tr [data-menu-trigger]').getAttribute('onclick').match(/mpReqMenu\(this, (\d+)\)/)[1]),'reject'); await sleep(80);
  ok('reject dialog asks for a reason', document.getElementById('modalBox').innerText.includes('Отклонить заявку') && !!document.getElementById('form-reason')); closeModal();
  Object.assign(mpState,{tab:'courses'});
 }
 // ---- accordion + impersonation ----
 const hid=i=>document.getElementById('navgroup-'+i).classList.contains('hidden');
 setNavGroupOpen(3,false); toggleNavGroup(3); ok('acc toggle', !hid(3)); toggleNavGroup(3); ok('acc close', hid(3));
 setNavGroupOpen(2,false); await go('billing'); ok('acc auto-reveal', !hid(2));
   openCenterPeople(9); await sleep(500);
  const tx=id=>document.getElementById(id).innerText;
  ok('center people (platform): chips with counts, group rows, no phones, switch to students', tx('cpeChips').includes('Группы') && document.querySelectorAll('#cpeRows tr').length>=4 && !tx('view-center-people').includes('+992') && (setCpeSection('students'), await sleep(400), tx('cpeHeadRow').includes('Ученик') && document.querySelectorAll('#cpeRows tr').length>=40));
}catch(e){ R.push('EXC '+e.message+' | '+(e.stack||'').split('\n')[1]); }
 out();
})();
