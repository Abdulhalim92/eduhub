/* Слой данных. Сейчас — mock-бэкенд в памяти; при подключении реального API заменяется только IIFE `api`. */
/* =====================================================================
   1. API LAYER — единственная точка доступа к данным
   ---------------------------------------------------------------------
   UI НЕ читает и НЕ мутирует данные напрямую: только `await api.*`.
   Каждый метод асинхронный, возвращает копию данных (как JSON по сети)
   и может отклониться с ApiError.

   Сейчас api = mock-бэкенд в памяти (блок ниже). При подключении
   реального бэкенда заменяется ТОЛЬКО этот блок, сигнатуры остаются.

   Контракт (метод → предполагаемый REST):
     dictionaries.get()                 GET   /dictionaries
     plans.list()                       GET   /plans
     plans.create(payload)              POST  /plans
     plans.update(id,patch)             PATCH /plans/{id}
     plans.nearLimit({threshold,metric,q,plan,status,sort})
                                        GET   /plans/near-limit?threshold=&metric=&q=&plan=&status=&sort=
     centers.sendOffer({ids,planId})    POST  /centers/offers
     centers.planChangeInfo(id)         GET   /centers/{id}/plan-change
     centers.requestPlanChange(id,{planId,reason,payFromBalance,deferPayment,deferConfirmed})
                                        POST  /centers/{id}/plan-change   (по умолчанию выставляет счёт, тариф сменится после оплаты;
                                        payFromBalance — сразу списать с баланса; deferPayment — сменить сейчас, оплата позже по решению SuperAdmin)
     billing.list({status,kind,q})      GET   /billing/invoices?status=&kind=&q=
     billing.get(id)                    GET   /billing/invoices/{id}       (с историей событий и платёжными данными)
     billing.remind({ids})              POST  /billing/invoices/remind
     billing.payFromBalance(id)         POST  /billing/invoices/{id}/pay-from-balance   (списание с баланса на платформе, с учётом овердрафта)
     finance.get(centerId)              GET   /centers/{id}/finance        (баланс, овердрафт, журнал операций, открытые счета)
     finance.topUp(centerId,{...})      POST  /centers/{id}/balance/top-up (SuperAdmin: деньги уже поступили; те же основания, что при подтверждении оплаты)
     finance.setOverdraft(centerId,{limit,reason})
                                        PUT   /centers/{id}/overdraft
     billing.confirmPayment(id,{method,reference,receivedAmount,receivedOn,comment,confirmed})
                                        POST  /billing/invoices/{id}/confirm   (SuperAdmin: оплата уже поступила вне системы — по выписке, кассе, переводу)
     billing.simulateOnlinePayment(id)  — МОК платёжного шлюза: на проде это webhook шлюза на сервер, из UI не вызывается
     billing.cancel(id,{reason})        POST  /billing/invoices/{id}/cancel
     audit.list({q,action,entityType,days,page,pageSize})
                                        GET   /audit?q=&action=&entityType=&days=&page=&pageSize=
     support.enter({centerId})          POST  /support/sessions            (вход в режим поддержки пишется в журнал)
     cabinet.profileCenters()           GET   /cabinet/centers             (центры с профилем: переключатель в eduhub.html)
     cabinet.schedule(c,{branch,teacherId})  GET /cabinet/centers/{c}/schedule
     cabinet.dashboard(c)               GET   /cabinet/centers/{c}/dashboard
     cabinet.users.list(c,{role,branch,q,page,pageSize})  GET /cabinet/centers/{c}/users
     cabinet.users.add(c,d)             POST  /cabinet/centers/{c}/students
     cabinet.users.setStatus(c,id,d)    PATCH /cabinet/centers/{c}/students/{id}/status
     cabinet.groups.list/get/create/update(c,…)  GET|POST|PATCH /cabinet/centers/{c}/groups[/{id}]
     cabinet.groups.addStudent/removeStudent(c,id,sid)  POST|DELETE /cabinet/centers/{c}/groups/{id}/students[/{sid}]
          cabinet.coinRules.list/create/update(c,…)   GET|POST|PATCH /cabinet/centers/{c}/coin-rules[/{id}]
     cabinet.analytics.list(c,{…})  GET /cabinet/centers/{c}/analytics
     cabinet.profile(centerId)          GET   /centers/{id}/profile        (профиль центра: карточка, показатели, лимиты, баланс, курсы; CTR-PRF-010)
     sync.enabled() / sync.reset()      —     (только прототип: общее состояние mock между index.html и eduhub.html через localStorage)
     cabinet.staff.list(centerId,{role,q,page,pageSize})   GET /centers/{id}/staff        (сотрудники центра; meta — использование лимита тарифа)
     cabinet.staff.add(centerId,{name,role,phone})         POST /centers/{id}/staff       (сверх лимита тарифа — CONFLICT, BR-023)
     cabinet.staff.remove(centerId,id,{reason})            DELETE /centers/{id}/staff/{id}
     cabinet.invoices.payOnline(centerId,id)               POST /centers/{id}/invoices/{id}/pay-online   (мок шлюза; только свой счёт)
     cabinet.branches.list(centerId)    GET   /centers/{id}/branches       (кабинет центра: свои филиалы и статусы модерации)
     cabinet.branches.geocode({city,address})
                                        GET   /geocode?city=&address=      (МОК геокодера; на проде — внешний сервис)
     cabinet.branches.submit(centerId,{...})
                                        POST  /centers/{id}/branches       (заявка на публикацию в каталоге → очередь модерации)
     cabinet.branches.resubmit(centerId,id,{...})
                                        PUT   /centers/{id}/branches/{id}  (исправленная заявка после «возврата на доработку»)
     sms.packages()                     GET   /sms/packages               (каталог пакетов + сколько продано)
     sms.sales({q,status,packageId,page,pageSize})
                                        GET   /sms/sales?q=&status=&packageId=&page=&pageSize=   (история продаж и остатки SMS по центрам)
     sms.accrue({centerId,packageId,mode,...})
                                        POST  /sms/sales                  (начисление пакета: mode = balance | manual | bonus)
     sms.updatePackage(id,{price,description,reason})
                                        PUT   /sms/packages/{id}
     marketplace.list({q,direction,status,page,pageSize})
                                        GET   /marketplace/courses?q=&direction=&status=&page=&pageSize=
     marketplace.create({title,direction,price})
                                        POST  /marketplace/courses        (создаёт черновик)
     marketplace.setPrice(id,{price,reason})
                                        PUT   /marketplace/courses/{id}/price
     marketplace.sell({centerId,courseId,mode,reason})
                                        POST  /marketplace/courses/{id}/grants   (передать курс центру: mode = invoice | balance | bonus; доступ появляется после оплаты)
     marketplace.buyers(courseId)       GET   /marketplace/courses/{id}/buyers   (кто владеет курсом: центр, дата, основание)
     marketplace.revoke(accessId,{reason})
                                        POST  /marketplace/access/{id}/revoke    (отозвать доступ с причиной)
     cabinet.courses.list(centerId)     GET   /centers/{id}/courses              (кабинет центра: купленные методики)
     courses.get(id,{centerId})         GET   /courses/{id}                     (страница курса: данные, программа, материалы; centerId — вызов из кабинета центра)
     courses.update(id,{title,description,direction},{centerId})   PATCH /courses/{id}
     courses.addModule / renameModule / removeModule / addLesson / renameLesson / removeLesson / addMaterial / removeMaterial
                                        POST|PATCH|DELETE /courses/{id}/modules|lessons|materials   (правит SuperAdmin платформенный курс, центр — только свой)
     marketplace.requests.list({status,courseId,page,pageSize})
                                        GET   /marketplace/requests             (заявки центров на получение курса)
     marketplace.requests.process(id,{action,reason})
                                        POST  /marketplace/requests/{id}/process   (action = invoice | balance | bonus | reject)
     cabinet.courses.list(centerId)     GET   /centers/{id}/courses             (купленные и собственные курсы центра)
     cabinet.courses.catalog(centerId)  GET   /centers/{id}/courses/catalog     (опубликованные курсы платформы со статусом для центра)
     cabinet.courses.create(centerId,{title,direction,description})   POST /centers/{id}/courses   (собственный курс центра)
     cabinet.requests.list|create|cancel|payOnline(centerId,...)      /centers/{id}/course-requests   (заявка центра на курс; оплата онлайн — мок шлюза)
     marketplace.publish(id)            POST  /marketplace/courses/{id}/publish
     marketplace.unpublish(id,{reason}) POST  /marketplace/courses/{id}/unpublish
     platform.attention()               GET   /platform/attention
     centers.list({q,plan,city,filter,page,pageSize})
                                        GET   /centers?q=&plan=&city=&filter=&page=&pageSize=
     centers.recentActivity({limit})    GET   /centers/activity?limit=
     centers.expiring({withinDays})     GET   /centers/expiring?withinDays=
     centers.churn({filter})            GET   /centers/churn?filter=
     centers.nameAvailable({name})      GET   /centers/name-available?name=
     centers.adminAccess(id,{reason})     POST  /centers/{id}/admin-access     (выдать или сбросить данные для входа администратора центра)
     auth.login / auth.changePassword  POST  /auth/login · /auth/password
     cabinet.access.reset(c,{kind,id,login,reason})  POST /cabinet/centers/{c}/access
     centers.people(id,{section,q,page})  GET   /centers/{id}/people?section=groups|students|staff
     centers.create(payload)            POST  /centers                     (в ответе credentials: логин и одноразовый пароль администратора центра)
     centers.remind({ids})              POST  /centers/remind
     centers.invoice(id)                POST  /centers/{id}/invoice        (счёт на продление; подписка продлится после оплаты)
     centers.setManager(id,{manager})   PUT   /centers/{id}/manager
     centers.markContacted(id)          POST  /centers/{id}/contact
     globalId.lookup({phone})           GET   /global-ids/lookup?phone=
     moderation.list({status})          GET   /moderation?status=
     moderation.decide(id,{...})        POST  /moderation/{id}/decision
     moderation.requeue(id)             POST  /moderation/{id}/requeue

   Правила, которые на проде живут на сервере (здесь — внутри mock):
   isChurn / isExpiring / nearLimit / riskScore / riskLevel, уникальность названия,
   условия публикации в каталог, валидация create, правила тарифов (лимит не ниже
   текущего использования, нельзя архивировать тариф с центрами), смена тарифа и продление
   только через счёт (активация после оплаты), баланс и овердрафт центра (списание только в пределах
   «баланс + лимит овердрафта», лимит не ниже уже использованного), журнал аудита. UI-проверки полей —
   только для удобства, источник истины — ответ сервера.
   В реальном API вместо loginDays / expiresIn лучше отдавать даты
   (lastLoginAt / expiresAt в ISO) и считать «дней назад» на клиенте.
   ===================================================================== */
class ApiError extends Error {
  constructor(code, message, fields) { super(message); this.name = 'ApiError'; this.code = code; this.fields = fields || {}; }
}
const apiConfig = { latencyMs: 150 };           // задержка имитации сети; в тестах 0
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const digits = s => String(s || '').replace(/\D/g, '');

const api = (() => {
  /* ---------- mock database (серверное состояние) ---------- */
  // баланс на платформе (предоплаченные средства центра, сомони) и лимит овердрафта (на сколько можно уйти в минус)
  const FINANCE_SEED = { 1: [2400, 2000], 2: [850, 2000], 3: [120, 800], 4: [310, 800], 5: [-150, 300], 6: [0, 300], 7: [1200, 800], 8: [45, 300], 9: [0, 0], 10: [-420, 500], 11: [30, 300], 12: [3900, 800], 13: [1500, 2000], 14: [-80, 300], 15: [600, 300], 16: [90, 300], 17: [-250, 300] };
  // 18–29: «демо-центры для смены тарифа» — не у лимита, не в оттоке, подписка не истекает; разный баланс и нагрузка (кто куда вмещается)
  Object.assign(FINANCE_SEED, { 18: [3500, 0], 19: [1000, 0], 20: [5000, 0], 21: [4200, 300], 22: [2600, 300], 23: [800, 300], 24: [6000, 800], 25: [3000, 800], 26: [9000, 2000], 27: [7500, 2000], 28: [1500, 300], 29: [450, 800] });
  const OVERDRAFT_DEFAULT = { 'Старт': 0, 'Базовый': 300, 'Про': 800, 'Бизнес': 2000 };   // лимит овердрафта по умолчанию для нового центра
  const OVERDRAFT_MAX = 100000;
  const SEED_ADMIN = { name: 'Алексей К.', role: 'SuperAdmin' };
  const ago = (days, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();   // «N дней назад» для моков
  const NEAR_LIMIT = 0.8;                       // доля использования лимита, с которой центр считается «у лимита»
  const MANAGERS = ['Нигора Р.', 'Фарход С.', 'Мадина Т.'];
  const CITIES = ['Душанбе', 'Худжанд', 'Бохтар', 'Куляб', 'Турсунзода', 'Исфара', 'Хорог'];
  const DIRECTIONS = ['Математика', 'Английский язык', 'Программирование', 'Робототехника', 'Подготовка к НЦТ', 'Творчество', 'Шахматы', 'Музыка'];
  const KNOWN_GLOBAL_IDS = { '901001001': 'Рустам Х. · родитель, 2 центра', '927000001': 'Дилшод А. · преподаватель, 1 центр' };

  const db = {
    totalCenters: 142,
    invoiceSeq: 1045,
    auditSeq: 4,
    // kind: renewal (продление) | plan_change (смена тарифа) | course; status: pending | paid | cancelled
    invoices: [
      { id: 'INV-1042', centerId: 1, kind: 'renewal', purpose: 'Подписка Бизнес (1 мес)', amount: 1800, status: 'paid', issuedAt: ago(5), dueAt: ago(-2), paidAt: ago(3), paidVia: 'manual',
        method: 'Безнал (Р/С)', channel: 'bank', reference: 'ПП № 18', plan: null, reason: '', remindedAt: null,
        payment: { channel: 'bank', method: 'Безнал (Р/С)', reference: 'ПП № 18', receivedAmount: 1800, receivedOn: ago(3).slice(0, 10), comment: '', via: 'manual', txId: null, cardMask: null, confirmedBy: SEED_ADMIN },
        events: [
          { at: ago(5), type: 'issued', actor: SEED_ADMIN, text: 'Счёт выставлен' },
          { at: ago(3), type: 'paid', actor: SEED_ADMIN, text: 'Оплата подтверждена вручную: Безнал (Р/С) · ПП № 18' },
          { at: ago(3), type: 'applied', actor: SEED_ADMIN, text: 'Подписка продлена на 30 дней' }
        ] },
      { id: 'INV-1043', centerId: 3, kind: 'course', courseId: 2, purpose: 'Курс: Подготовка к НЦТ', amount: 1500, status: 'pending', issuedAt: ago(9), dueAt: ago(2), paidAt: null, paidVia: null,
        method: null, channel: null, reference: '', plan: null, reason: '', remindedAt: ago(4), payment: null,
        events: [
          { at: ago(9), type: 'issued', actor: SEED_ADMIN, text: 'Счёт выставлен' },
          { at: ago(4), type: 'reminded', actor: SEED_ADMIN, text: 'Напоминание отправлено владельцу центра' }
        ] }
    ],
    audit: [
      { id: 3, at: ago(0, 5), actor: { name: 'Алексей К.', role: 'SuperAdmin' }, ip: '10.0.0.5', device: 'Chrome · macOS', action: 'support.entered', entity: { type: 'center', id: 3, name: 'Alpha School' }, before: null, after: null, reason: '' },
      { id: 2, at: ago(3), actor: { name: 'Алексей К.', role: 'SuperAdmin' }, ip: '10.0.0.5', device: 'Chrome · macOS', action: 'invoice.paid', entity: { type: 'center', id: 1, name: 'Центр Перспектива' }, before: { status: 'pending' }, after: { status: 'paid', method: 'Безнал (Р/С)', reference: 'ПП № 18' }, reason: 'INV-1042' },
      { id: 1, at: ago(6), actor: { name: 'Алексей К.', role: 'SuperAdmin' }, ip: '10.0.0.5', device: 'Chrome · macOS', action: 'plan.updated', entity: { type: 'plan', id: 'pro', name: 'Про' }, before: { price: 800 }, after: { price: 900 }, reason: 'Индексация цен' }
    ],
    planSeq: 5,
    plans: [
      { id: 'start',    name: 'Старт',   price: 0,    limits: { staff: 5,   storageGb: 2,   branches: 2 },  modules: { payroll: false, inventory: false, crm: false, geo: true },  active: true },
      { id: 'basic',    name: 'Базовый', price: 400,  limits: { staff: 10,  storageGb: 10,  branches: 3 },  modules: { payroll: true,  inventory: false, crm: false, geo: true },  active: true },
      { id: 'pro',      name: 'Про',     price: 900,  limits: { staff: 50,  storageGb: 50,  branches: 10 }, modules: { payroll: true,  inventory: true,  crm: false, geo: true },  active: true },
      { id: 'business', name: 'Бизнес',  price: 1800, limits: { staff: 100, storageGb: 200, branches: 25 }, modules: { payroll: true,  inventory: true,  crm: true,  geo: true },  active: true }
    ],
    // loginDays: дней с последнего входа; expiresIn: дней до конца подписки (<0 — просрочена, null — не истекает)
    centers: [
      { id: 1,  name: 'Центр Перспектива', city: 'Душанбе',    owner: 'Анна Смирнова',     phone: '+992 90 100 10 01', plan: 'Бизнес',  staffUsed: 14, storageUsedGb: 45, branchesUsed: 4, loginDays: 0,  lessons7d: 84,  status: 'active',  expiresIn: 41 },
      { id: 2,  name: 'Indigo Academy',    city: 'Душанбе',    owner: 'Рустам Хакимов',    phone: '+992 90 100 10 02', plan: 'Бизнес',  staffUsed: 17, storageUsedGb: 40, branchesUsed: 6, loginDays: 0,  lessons7d: 120, status: 'active',  expiresIn: 6 },
      { id: 3,  name: 'Alpha School',      city: 'Душанбе',    owner: 'Дилшод Азизов',     phone: '+992 90 100 10 03', plan: 'Про',     staffUsed: 28, storageUsedGb: 20, branchesUsed: 3, loginDays: 11, lessons7d: 0,   status: 'active',  expiresIn: 52, manager: 'Нигора Р.' },
      { id: 4,  name: 'Дониш',             city: 'Худжанд',    owner: 'Шахноза Юсупова',   phone: '+992 92 200 20 04', plan: 'Про',     staffUsed: 22, storageUsedGb: 44, branchesUsed: 4, loginDays: 0,  lessons7d: 66,  status: 'active',  expiresIn: 3 },
      { id: 5,  name: 'Умед Плюс',         city: 'Душанбе',    owner: 'Фарида Рахимова',   phone: '+992 90 100 10 05', plan: 'Базовый', staffUsed: 9, storageUsedGb: 7, branchesUsed: 2,   loginDays: 13, lessons7d: 3,   status: 'active',  expiresIn: 9 },
      { id: 6,  name: 'Рушд',              city: 'Бохтар',     owner: 'Мансур Шарипов',    phone: '+992 93 300 30 06', plan: 'Базовый', staffUsed: 3, storageUsedGb: 2, branchesUsed: 1,  loginDays: 16, lessons7d: 0,   status: 'active',  expiresIn: 12 },
      { id: 7,  name: 'Sitora Kids',       city: 'Душанбе',    owner: 'Ситора Назарова',   phone: '+992 90 100 10 07', plan: 'Про',     staffUsed: 19, storageUsedGb: 12, branchesUsed: 9, loginDays: 1,  lessons7d: 41,  status: 'active',  expiresIn: 5 },
      { id: 8,  name: 'Zebo Lingua',       city: 'Худжанд',    owner: 'Зебо Каримова',     phone: '+992 92 200 20 08', plan: 'Базовый', staffUsed: 7, storageUsedGb: 9, branchesUsed: 3,  loginDays: 0,  lessons7d: 30,  status: 'active',  expiresIn: 2 },
      { id: 9,  name: 'Math Lab',          city: 'Душанбе',    owner: 'Парвиз Исмоилов',   phone: '+992 90 100 10 09', plan: 'Старт',   staffUsed: 4, storageUsedGb: 1, branchesUsed: 2,   loginDays: 2,  lessons7d: 12,  status: 'active',  expiresIn: null },
      { id: 10, name: 'English Hub',       city: 'Куляб',      owner: 'Нодира Ахмедова',   phone: '+992 98 400 40 10', plan: 'Про',     staffUsed: 12, storageUsedGb: 8, branchesUsed: 2, loginDays: 12, lessons7d: 2,   status: 'active',  expiresIn: 20 },
      { id: 11, name: 'Бахор',             city: 'Турсунзода', owner: 'Гулнора Саидова',   phone: '+992 90 100 10 11', plan: 'Базовый', staffUsed: 6, storageUsedGb: 4, branchesUsed: 1,  loginDays: 0,  lessons7d: 27,  status: 'active',  expiresIn: -2 },
      { id: 12, name: 'Navigator',         city: 'Душанбе',    owner: 'Бахтиёр Умаров',    phone: '+992 90 100 10 12', plan: 'Про',     staffUsed: 31, storageUsedGb: 30, branchesUsed: 5, loginDays: 0,  lessons7d: 98,  status: 'active',  expiresIn: 60 },
      { id: 13, name: 'Огни знаний',       city: 'Худжанд',    owner: 'Ойниса Мирзоева',   phone: '+992 92 200 20 13', plan: 'Бизнес',  staffUsed: 16, storageUsedGb: 40, branchesUsed: 8, loginDays: 1,  lessons7d: 74,  status: 'active',  expiresIn: 85 },
      { id: 14, name: 'Pamir Coding',      city: 'Хорог',      owner: 'Алишер Назаров',    phone: '+992 93 300 30 14', plan: 'Базовый', staffUsed: 6, storageUsedGb: 3, branchesUsed: 1,  loginDays: 15, lessons7d: 1,   status: 'active',  expiresIn: 27 },
      { id: 15, name: 'Kids Planet',       city: 'Душанбе',    owner: 'Мехрангез Олимова', phone: '+992 90 100 10 15', plan: 'Базовый', staffUsed: 8, storageUsedGb: 5, branchesUsed: 2,  loginDays: 0,  lessons7d: 44,  status: 'active',  expiresIn: 120 },
      { id: 16, name: 'Лидер',             city: 'Исфара',     owner: 'Карим Тураев',      phone: '+992 92 200 20 16', plan: 'Базовый', staffUsed: 5, storageUsedGb: 6, branchesUsed: 2,  loginDays: 5,  lessons7d: 9,   status: 'active',  expiresIn: 45 },
      { id: 17, name: 'Школа будущего',    city: 'Душанбе',    owner: 'Саидаъзам Р.',      phone: '+992 90 100 10 17', plan: 'Базовый', staffUsed: 0, storageUsedGb: 0, branchesUsed: 1,  loginDays: 40, lessons7d: 0,   status: 'blocked', expiresIn: -30 },
      { id: 18, name: 'Дониёр Лингва',    city: 'Худжанд',    owner: 'Дониёр Рахмонов',   phone: '+992 92 200 20 18', plan: 'Старт',   staffUsed: 2, storageUsedGb: 1, branchesUsed: 1, loginDays: 0, lessons7d: 22, status: 'active', expiresIn: null },
      { id: 19, name: 'Тарона Скилс',      city: 'Душанбе',    owner: 'Тарона Бобоева',    phone: '+992 90 100 10 19', plan: 'Старт',   staffUsed: 3, storageUsedGb: 1, branchesUsed: 1, loginDays: 1, lessons7d: 31, status: 'active', expiresIn: null },
      { id: 20, name: 'Нур Академия',      city: 'Бохтар',     owner: 'Нурулло Кароматов', phone: '+992 93 300 30 20', plan: 'Старт',   staffUsed: 1, storageUsedGb: 1, branchesUsed: 1, loginDays: 0, lessons7d: 12, status: 'active', expiresIn: null },
      { id: 21, name: 'Эврика',            city: 'Душанбе',    owner: 'Эмина Саидова',     phone: '+992 90 100 10 21', plan: 'Базовый', staffUsed: 4, storageUsedGb: 1, branchesUsed: 2, loginDays: 0, lessons7d: 48, status: 'active', expiresIn: 70 },
      { id: 22, name: 'Сармад',            city: 'Худжанд',    owner: 'Сарвар Мирзоев',    phone: '+992 92 200 20 22', plan: 'Базовый', staffUsed: 6, storageUsedGb: 6, branchesUsed: 2, loginDays: 2, lessons7d: 57, status: 'active', expiresIn: 65 },
      { id: 23, name: 'Фаро',              city: 'Куляб',      owner: 'Фарход Давлатов',   phone: '+992 98 400 40 23', plan: 'Базовый', staffUsed: 3, storageUsedGb: 2, branchesUsed: 1, loginDays: 1, lessons7d: 25, status: 'active', expiresIn: 55 },
      { id: 24, name: 'Паёмбар IT',        city: 'Душанбе',    owner: 'Пайомбар Одинаев',  phone: '+992 90 100 10 24', plan: 'Про',     staffUsed: 6, storageUsedGb: 4, branchesUsed: 2, loginDays: 0, lessons7d: 64, status: 'active', expiresIn: 90 },
      { id: 25, name: 'Дидор',             city: 'Исфара',     owner: 'Дилором Шарипова',  phone: '+992 92 200 20 25', plan: 'Про',     staffUsed: 4, storageUsedGb: 1, branchesUsed: 1, loginDays: 3, lessons7d: 36, status: 'active', expiresIn: 80 },
      { id: 26, name: 'Лидерс Хаб',        city: 'Душанбе',    owner: 'Леонид Исмоилов',   phone: '+992 90 100 10 26', plan: 'Бизнес',  staffUsed: 9, storageUsedGb: 8, branchesUsed: 3, loginDays: 0, lessons7d: 91, status: 'active', expiresIn: 100 },
      { id: 27, name: 'Мактаби Нав',       city: 'Худжанд',    owner: 'Мастура Каримова',  phone: '+992 92 200 20 27', plan: 'Бизнес',  staffUsed: 3, storageUsedGb: 1, branchesUsed: 1, loginDays: 1, lessons7d: 40, status: 'active', expiresIn: 110 },
      { id: 28, name: 'Ситораи Шарқ',      city: 'Хорог',      owner: 'Ситора Назарова',   phone: '+992 93 300 30 28', plan: 'Базовый', staffUsed: 5, storageUsedGb: 3, branchesUsed: 2, loginDays: 2, lessons7d: 33, status: 'active', expiresIn: 60 },
      { id: 29, name: 'Бахт Эдьюкейшн',    city: 'Турсунзода', owner: 'Бахтиёр Назаров',   phone: '+992 90 100 10 29', plan: 'Про',     staffUsed: 7, storageUsedGb: 12, branchesUsed: 4, loginDays: 1, lessons7d: 52, status: 'active', expiresIn: 75 }
    ].map(c => ({ balance: FINANCE_SEED[c.id][0], overdraftLimit: FINANCE_SEED[c.id][1], reminded: false, invoice: null, contacted: false, manager: null, offer: c.id === 4 ? { planId: 'business' } : null, ...c })),
    moderation: [
      {
        id: 1, centerId: 1, branch: 'Филиал «Сино»', address: 'ул. Рудаки, 98', city: 'Душанбе', district: 'Сино',
        phone: '+992 90 100 10 01', submitted: 'сегодня, 09:40',
        gps: { lat: 38.5601, lng: 68.7794 }, geo: { lat: 38.5603, lng: 68.7791 },
        desc: {
          ru: 'Центр «Перспектива» — подготовка к НЦТ, математика и английский для школьников 7–17 лет. Малые группы до 10 человек, преподаватели-практики.',
          tj: 'Маркази «Перспектива» — омодагӣ ба НЦТ, математика ва забони англисӣ барои хонандагони 7–17 сола. Гурӯҳҳои хурд то 10 нафар.',
          en: ''
        },
        status: 'pending', reason: '', gpsOk: false
      },
      {
        id: 2, centerId: 7, branch: 'Филиал «Фирдавси»', address: 'пр. Айни, 24', city: 'Душанбе', district: 'Фирдавси',
        phone: '+992 90 100 10 07', submitted: 'сегодня, 08:15',
        gps: { lat: 38.5530, lng: 68.7960 }, geo: { lat: 38.5568, lng: 68.7955 },
        desc: {
          ru: 'Sitora Kids — развивающие занятия для детей 4–10 лет: рисование, шахматы, подготовка к школе и английский в игровой форме.',
          tj: 'Sitora Kids — машғулотҳои рушддиҳанда барои кӯдакони 4–10 сола: наққошӣ, шоҳмот, омодагӣ ба мактаб ва забони англисӣ.',
          en: 'Sitora Kids offers developmental classes for children aged 4–10: drawing, chess, school preparation and playful English.'
        },
        status: 'pending', reason: '', gpsOk: false
      },
      {
        id: 3, centerId: 4, branch: 'Главный филиал', address: 'ул. Мавлонбекова, 15', city: 'Худжанд', district: 'Центр',
        phone: '+992 92 200 20 04', submitted: 'вчера, 17:30',
        gps: { lat: 40.2826, lng: 69.6220 }, geo: { lat: 40.2828, lng: 69.6224 },
        desc: {
          ru: 'Дониш — программирование и робототехника для подростков. Собственная лаборатория, проектная работа, участие в олимпиадах.',
          tj: '',
          en: 'Donish teaches programming and robotics to teenagers: own lab, project work, olympiad preparation.'
        },
        status: 'pending', reason: '', gpsOk: false
      },
      {
        id: 4, centerId: 8, branch: 'Филиал «Центр»', address: 'ул. Исмоили Сомони, 7', city: 'Худжанд', district: 'Центр',
        phone: '+992 92 200 20 08', submitted: 'вчера, 12:05',
        gps: { lat: 40.2790, lng: 69.6180 }, geo: { lat: 40.2791, lng: 69.6183 },
        desc: {
          ru: 'Zebo Lingua — языковая студия: английский, русский, турецкий. Группы по уровням, разговорные клубы, подготовка к IELTS.',
          tj: 'Zebo Lingua — студияи забонҳо: англисӣ, русӣ, туркӣ. Гурӯҳҳо аз рӯи сатҳ, клубҳои гуфтугӯӣ, омодагӣ ба IELTS.',
          en: 'Zebo Lingua is a language studio: English, Russian, Turkish. Level-based groups, speaking clubs, IELTS preparation.'
        },
        status: 'pending', reason: '', gpsOk: false
      }
    ]
  };

  // МОК геокодера: детерминированно превращает «город + адрес» в координаты рядом с центром города
  const CITY_COORDS = { 'Душанбе': [38.5598, 68.7870], 'Худжанд': [40.2826, 69.6220], 'Бохтар': [37.8365, 68.7802], 'Куляб': [37.9114, 69.7840], 'Турсунзода': [38.5133, 68.2308], 'Исфара': [40.1269, 70.6283], 'Хорог': [37.4896, 71.5535] };
  const geocode = (city, address) => {
    const base = CITY_COORDS[city] || CITY_COORDS['Душанбе'];
    let h = 0; String(address || '').toLowerCase().split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    const r4 = n => Math.round(n * 1e4) / 1e4;
    return { lat: r4(base[0] + ((h % 200) - 100) / 10000), lng: r4(base[1] + (((h >> 8) % 200) - 100) / 10000) };
  };
  const planOf = name => db.plans.find(p => p.name === name);
  const priceOf = name => (planOf(name) || { price: 0 }).price;
  // использование трёх лимитов; plan можно подставить другой — «что будет после перехода»
  const usageOf = (c, plan = planOf(c.plan)) => {
    const l = plan.limits, m = (key, label, used, limit) => ({ key, label, used, limit, pct: Math.round(used / limit * 100) });
    return [m('staff', 'Сотрудники', c.staffUsed, l.staff), m('storage', 'Хранилище, ГБ', c.storageUsedGb, l.storageGb), m('branches', 'Филиалы', c.branchesUsed, l.branches)];
  };
  const worstUsage = c => usageOf(c).reduce((a, b) => (b.pct > a.pct ? b : a));

  // журнал операций по балансу. Для демо у каждого центра две записи: пополнение и списание, итог = текущий баланс
  db.ledger = [];
  db.ledgerSeq = 1;
  db.centers.forEach(c => {
    const top = Math.max(c.balance, 0) + 200, charge = top - c.balance;
    db.ledger.push({ id: db.ledgerSeq++, centerId: c.id, at: ago(12, 3), type: 'charge', amount: -charge, balanceAfter: c.balance, method: 'Списание с баланса на платформе', reference: 'Подписка (1 мес)', invoiceId: null, actor: SEED_ADMIN, comment: '' });
    db.ledger.push({ id: db.ledgerSeq++, centerId: c.id, at: ago(20), type: 'topup', amount: top, balanceAfter: top, method: 'Безнал (Р/С)', reference: 'ПП № ' + (100 + c.id), invoiceId: null, actor: SEED_ADMIN, comment: '' });
  });
  const ledgerAdd = (c, e) => { db.ledger.unshift({ id: db.ledgerSeq++, centerId: c.id, at: new Date().toISOString(), balanceAfter: c.balance, invoiceId: null, comment: '', ...e }); };

  // SMS-пакеты: каталог и продажи (остаток считается по продажам). status: paid | bonus (начислено бесплатно, по причине)
  db.smsPackages = [
    { id: 'sms500',  sms: 500,  price: 120, description: 'Базовый пакет для небольших центров', active: true },
    { id: 'sms1000', sms: 1000, price: 210, description: 'Популярный пакет для активных групп', active: true },
    { id: 'sms5000', sms: 5000, price: 900, description: 'Выгодный пакет для крупных сетей', active: true }
  ];
  db.smsSeq = 2050;
  db.smsSales = [
    [1, 'sms1000', 820, 6, 'Списание с баланса на платформе', 'Подписка'], [3, 'sms5000', 3400, 11, 'Безнал (Р/С)', 'ПП № 211'], [2, 'sms500', 45, 3, 'Перевод на карту', '4821'],
    [4, 'sms1000', 950, 19, 'Безнал (Р/С)', 'ПП № 198'], [5, 'sms500', 310, 8, 'Наличные', 'ПКО № 31'], [6, 'sms1000', 130, 14, 'Безнал (Р/С)', 'ПП № 187'],
    [18, 'sms500', 500, 2, 'Списание с баланса на платформе', 'SMS-пакет 500'], [20, 'sms5000', 4700, 5, 'Безнал (Р/С)', 'ПП № 230'], [26, 'sms5000', 1200, 24, 'Безнал (Р/С)', 'ПП № 176'], [27, 'sms1000', 60, 21, 'Наличные', 'ПКО № 28']
  ].map(([centerId, packageId, remaining, d, method, reference], i) => {
    const pk = db.smsPackages.find(x => x.id === packageId);
    return { id: 'SMS-' + (2040 + i), centerId, packageId, sms: pk.sms, remaining, price: pk.price, boughtAt: ago(d), status: 'paid', method, reference, actor: SEED_ADMIN, reason: '' };
  });
  const smsBalanceOf = id => db.smsSales.filter(x => x.centerId === id).reduce((a, x) => a + x.remaining, 0);

  // методики (B2B-магазин): центры покупают готовые курсы. status: published | draft
  const COURSE_DIRECTIONS = ['Языки', 'Подготовка к НЦТ', 'IT и программирование', 'Математика', 'Творчество'];
  db.courses = [
    { id: 1, title: 'Английский язык · Уровень B1', direction: 'Языки', lessons: 36, tests: 12, note: 'PDF-планы', status: 'published', price: 1200, buyersOther: 15 },
    { id: 2, title: 'Подготовка к НЦТ · Математика', direction: 'Подготовка к НЦТ', lessons: 48, tests: 24, note: 'Автопроверка', status: 'published', price: 1500, buyersOther: 26 },
    { id: 3, title: 'Python для школьников · Старт', direction: 'IT и программирование', lessons: 24, tests: 0, note: 'Практикум', status: 'draft', price: 950, buyersOther: 0 },
    { id: 4, title: 'Таджикский язык · Базовый курс', direction: 'Языки', lessons: 30, tests: 10, note: 'Аудиоматериалы', status: 'published', price: 800, buyersOther: 10 },
    { id: 5, title: 'Ментальная арифметика · Уровень 1', direction: 'Математика', lessons: 20, tests: 8, note: 'Карточки и игры', status: 'published', price: 700, buyersOther: 6 },
    { id: 6, title: 'Scratch и основы алгоритмов', direction: 'IT и программирование', lessons: 18, tests: 6, note: 'Проекты', status: 'draft', price: 600, buyersOther: 0 }
  ];
  const COURSE_COVERS = { 1: 'english', 2: 'nct-math', 3: 'python', 4: 'tajik', 5: 'mental', 6: 'scratch' };
  const DIRECTION_COVERS = { 'Языки': 'english', 'Подготовка к НЦТ': 'nct-math', 'IT и программирование': 'python', 'Математика': 'mental', 'Творчество': 'creative' };   // обложка нового курса — по направлению
  // доступ центров к купленным методикам (передача курса). Покупка даёт текущую версию курса: число уроков и тестов фиксируется в момент выдачи.
  // source: invoice (оплаченный счёт) | bonus (бесплатно, по причине); status: active | revoked
  db.courseAccess = [
    [1, 1, 'invoice', 'INV-1030', 34], [1, 2, 'invoice', 'INV-1031', 30], [2, 2, 'invoice', 'INV-1032', 21], [4, 1, 'bonus', null, 9], [18, 4, 'invoice', 'INV-1038', 4], [5, 5, 'invoice', 'INV-1035', 12]
  ].map(([centerId, courseId, source, invoiceId, d], i) => { const c = db.courses.find(x => x.id === courseId); return { id: i + 1, centerId, courseId, source, invoiceId, reason: source === 'bonus' ? 'Бонус за долгое сотрудничество' : '', grantedAt: ago(d), status: 'active', revokedAt: null, revokeReason: '', version: { lessons: c.lessons, tests: c.tests } }; });
  db.accessSeq = 7;
  db.courseSeq = 7;
  // страница курса: описание, владелец (null — курс платформы; id центра — собственный курс центра), программа «модули → уроки → материалы»
  const COURSE_DESCRIPTIONS = {
    1: 'Курс общего английского уровня B1: грамматика, лексика по темам, аудирование и письмо. К каждому уроку приложен методический план для преподавателя.',
    2: 'Системная подготовка к национальному централизованному тестированию по математике: темы, типовые задачи и тесты с автоматической проверкой.',
    3: 'Первое знакомство школьников с программированием на Python: переменные, условия, циклы и небольшие проекты.',
    4: 'Базовый курс таджикского языка для детей и взрослых: письмо, чтение, разговорная практика с аудиоматериалами.',
    5: 'Ментальная арифметика, уровень 1: счёты, формулы пальцевого и ментального счёта, игры и карточки для закрепления.',
    6: 'Алгоритмическое мышление через визуальное программирование в Scratch: циклы, ветвления, проекты-игры.'
  };
  const COURSE_TOPICS = {
    'Языки': ['Знакомство и грамматика', 'Лексика по теме', 'Аудирование', 'Чтение и письмо', 'Разговорная практика', 'Повторение'],
    'Подготовка к НЦТ': ['Алгебра и уравнения', 'Функции и графики', 'Геометрия', 'Тригонометрия', 'Неравенства', 'Пробный тест'],
    'IT и программирование': ['Основы и переменные', 'Условия', 'Циклы', 'Функции', 'Проект', 'Разбор ошибок'],
    'Математика': ['Счёт и формулы', 'Сложение', 'Вычитание', 'Умножение', 'Игры и карточки', 'Контроль'],
    'Творчество': ['Материалы и приёмы', 'Цвет', 'Композиция', 'Проект']
  };
  db.cSeq = 1;
  db.courseContent = {};
  const hash = n => (n * 2654435761 >>> 0);
  const sizeLabel = n => (0.4 + (hash(n) % 38) / 10).toFixed(1).replace('.', ',') + ' МБ';
  // содержимое демо-курса строится так, чтобы число уроков и тестов совпало с заявленным в карточке: 6 уроков в модуле, тесты равномерно по урокам
  function genContent(c) {
    const topics = COURSE_TOPICS[c.direction] || COURSE_TOPICS['Языки'], N = c.lessons, T = c.tests, modules = [];
    for (let i = 0; i < N; i++) {
      const m = Math.floor(i / 6), l = i % 6;
      if (!modules[m]) modules.push({ id: db.cSeq++, title: 'Модуль ' + (m + 1) + ': ' + topics[m % topics.length], lessons: [] });
      const lesson = { id: db.cSeq++, title: 'Урок ' + (m + 1) + '.' + (l + 1) + ': ' + topics[(m + l) % topics.length], materials: [] };
      lesson.materials.push({ id: db.cSeq++, type: 'plan', name: 'План урока ' + (m + 1) + '.' + (l + 1) + '.pdf', size: sizeLabel(i + 1) });
      if (i % 4 === 1) lesson.materials.push({ id: db.cSeq++, type: 'video', name: 'Видео ' + (m + 1) + '.' + (l + 1) + '.mp4', size: (12 + hash(i) % 60) + ' МБ' });
      if (T && Math.floor((i + 1) * T / N) > Math.floor(i * T / N)) lesson.materials.push({ id: db.cSeq++, type: 'test', name: 'Тест по уроку ' + (m + 1) + '.' + (l + 1), size: (8 + hash(i) % 13) + ' вопросов' });
      modules[m].lessons.push(lesson);
    }
    return { modules };
  }
  db.courses.forEach(c => { c.ownerCenterId = null; c.description = COURSE_DESCRIPTIONS[c.id] || ''; db.courseContent[c.id] = genContent(c); });
  // заявки центров на получение курса. status: new | invoiced | fulfilled | rejected
  db.requestSeq = 4;
  db.courseRequests = [
    { id: 1, centerId: 2, courseId: 4, status: 'new', note: 'Нужен для новой группы таджикского языка', createdAt: ago(1), invoiceId: null, reason: '', decidedAt: null },
    { id: 2, centerId: 18, courseId: 2, status: 'new', note: '', createdAt: ago(0, 5), invoiceId: null, reason: '', decidedAt: null },
    { id: 3, centerId: 5, courseId: 1, status: 'rejected', note: '', createdAt: ago(6), invoiceId: null, reason: 'Центр уже получил курс другим способом, заявка продублирована', decidedAt: ago(5) }
  ];

  // профили демо-центров (кабинет центра): направление, число учеников, логотип, баннер; сотрудники центра — отдельные записи db.staff.
  // Роли: teacher | admin; число активных сотрудников = staffUsed центра (лимит тарифа, BR-023). Состав [преподаватели, администраторы, менеджеры]
  // для первых девяти центров задан явно, у остальных считается по доле. Центры, подключённые позже (centers.create), получают пустой профиль (CTR-PRF-010)
  const STAFF_ROLES = { teacher: 'Преподаватель', admin: 'Администратор' };
  const STAFF_MALE = ['Рустам', 'Дилшод', 'Фарход', 'Зафар', 'Бахтиёр', 'Умед', 'Парвиз', 'Мансур', 'Сухроб', 'Алишер', 'Саид', 'Бехруз'];
  const STAFF_FEMALE = ['Фарида', 'Нигора', 'Мадина', 'Ситора', 'Гулнора', 'Шахноза', 'Лайло', 'Мехрона', 'Дильбар', 'Зарина', 'Мунира', 'Нодира'];
  const STAFF_LAST = ['Каримов', 'Назаров', 'Хакимов', 'Исмоилов', 'Саидов', 'Азизов', 'Юсупов', 'Шарипов', 'Олимов', 'Умаров', 'Мирзоев', 'Бобоев', 'Давлатов', 'Одинаев', 'Ахмедов'];
  const staffName = (centerId, i) => { const f = (centerId + i * 5) % 24, l = STAFF_LAST[(centerId * 3 + i * 7) % STAFF_LAST.length]; return f < 12 ? STAFF_MALE[f] + ' ' + l : STAFF_FEMALE[f - 12] + ' ' + l + 'а'; };
  const staffPhone = (centerId, i) => { const h = hashN(centerId * 131 + i * 17); return '+992 9' + (h % 10) + ' ' + String(100 + h % 900) + ' ' + String(10 + (h >>> 5) % 90) + ' ' + String(10 + (h >>> 9) % 90); };
  function hashN(n) { return (n * 2654435761) >>> 0; }
  db.profiles = {};
  db.staff = [];
  db.staffSeq = 1;
  [
    [1,  'Школьная подготовка: НЦТ, математика, английский', 'Подготовка к НЦТ, математика и английский для школьников 7–17 лет. Малые группы до 10 человек, преподаватели-практики.', 2016, 428, [9, 3, 2], 'school'],
    [2,  'Английский язык и IELTS', 'Английский язык и подготовка к международным экзаменам IELTS и TOEFL. Группы по уровням, разговорные клубы, пробное тестирование.', 2014, 610, [12, 3, 2], 'english'],
    [3,  'Школьное образование и олимпиады', 'Углублённая подготовка по школьным предметам и олимпиадам. Преподаватели-предметники, еженедельные контрольные.', 2012, 520, null, 'school'],
    [4,  'Программирование и робототехника', 'Программирование и робототехника для подростков. Собственная лаборатория, проектная работа, участие в олимпиадах.', 2019, 190, [15, 4, 3], 'robotics'],
    [5,  'Творчество и музыка', 'Творческая студия для детей: рисование, музыка и театр. Занятия по вечерам и выходным, выставка работ в конце семестра.', 2018, 120, [6, 2, 1], 'school'],
    [6,  'Подготовка к школе', 'Развитие речи, счёт и письмо для детей 5–7 лет. Занятия в малых группах.', 2021, 85, null, 'school'],
    [7,  'Детское развитие 4–10 лет', 'Развивающие занятия для детей 4–10 лет: рисование, шахматы, подготовка к школе и английский в игровой форме.', 2018, 340, [13, 4, 2], 'robotics'],
    [8,  'Иностранные языки', 'Языковая студия: английский, русский, турецкий. Группы по уровням, разговорные клубы, подготовка к IELTS.', 2020, 95, [5, 1, 1], 'library'],
    [9,  'Математика и ментальная арифметика', 'Математика и ментальная арифметика для школьников 6–14 лет. Небольшая студия, индивидуальный темп.', 2022, 48, [3, 1, 0], 'math'],
    [10, 'Английский язык', 'Английский для детей и взрослых: общий курс, деловой английский, разговорные клубы с преподавателями-носителями.', 2017, 260, null, 'english'],
    [11, 'Детские кружки', 'Кружки для детей: рукоделие, рисование, лепка. Занятия после школы и по выходным.', 2019, 70, null, 'school'],
    [12, 'Профориентация и подготовка в вузы', 'Подготовка к поступлению в вузы, профориентационное тестирование, консультации по выбору специальности.', 2015, 640, null, 'library'],
    [13, 'Школьные предметы и НЦТ', 'Сеть центров школьной подготовки: математика, физика, химия, подготовка к НЦТ. Филиалы в разных районах города.', 2013, 480, null, 'school'],
    [14, 'Программирование для школьников', 'Школа программирования в Хороге: Python и Scratch для школьников, занятия офлайн и онлайн.', 2021, 36, [4, 1, 1], 'robotics'],
    [15, 'Раннее развитие', 'Развивающие занятия для малышей 2–6 лет: речь, мелкая моторика, музыка, адаптация к детскому саду.', 2020, 210, null, 'robotics'],
    [16, 'Подготовка к экзаменам', 'Индивидуальная и групповая подготовка к школьным и вступительным экзаменам.', 2018, 110, null, 'library'],
    [17, 'Подготовка к школе', 'Подготовка детей к школе. Центр заблокирован: профиль доступен только для просмотра.', 2023, 0, [0, 0, 0], 'library'],
    [18, 'Языки: английский и немецкий', 'Небольшая языковая студия: английский и немецкий для школьников и студентов, разговорная практика.', 2023, 40, null, 'english'],
    [19, 'Навыки общения и выступлений', 'Ораторское мастерство, дебаты и работа в команде для подростков.', 2023, 55, null, 'library'],
    [20, 'Арабский язык и каллиграфия', 'Арабский язык с нуля, основы каллиграфии, чтение и письмо.', 2022, 30, null, 'english'],
    [21, 'Естествознание и эксперименты', 'Научные эксперименты, физика и химия в играх для школьников 8–14 лет.', 2021, 130, null, 'robotics'],
    [22, 'Программирование и веб-дизайн', 'Основы программирования и веб-дизайна для подростков: от первых скриптов до собственного сайта.', 2020, 150, null, 'robotics'],
    [23, 'Таджикский язык и литература', 'Таджикский язык, литература и риторика для школьников и взрослых.', 2019, 75, null, 'english'],
    [24, 'Профессиональное IT-обучение', 'Курсы для начинающих разработчиков: веб, мобильная разработка, тестирование.', 2020, 210, null, 'robotics'],
    [25, 'Рисование и дизайн', 'Студия рисования, графического дизайна и скетчинга для детей и взрослых.', 2019, 90, null, 'school'],
    [26, 'Бизнес-навыки и лидерство', 'Предпринимательство, финансовая грамотность и лидерство для подростков и студентов.', 2021, 310, null, 'library'],
    [27, 'Начальная школа и продлёнка', 'Группы продлённого дня и подготовка домашних заданий для учеников начальной школы.', 2022, 125, null, 'school'],
    [28, 'Музыка и танцы', 'Вокал, фортепиано и народные танцы для детей от 5 лет.', 2018, 140, null, 'english'],
    [29, 'Шахматы и логика', 'Шахматная школа и логические игры: турниры, разборы партий, подготовка к соревнованиям.', 2017, 160, null, 'math']
  ].forEach(([id, direction, description, foundedYear, students, roles, banner]) => {
    const c = db.centers.find(x => x.id === id), n = c.staffUsed;
    const [t, a0, m] = roles || (() => { const m = Math.round(n * 0.1), t = Math.round(n * 0.68); return [t, n - t - m, m]; })();
    db.profiles[id] = { direction, description, foundedYear, students, logo: 'src/assets/centers/logo-' + id + '.svg', banner: 'src/assets/centers/banner-' + banner + '.jpg' };
    const a = a0 + m;   // роли менеджера центра нет: бывшие менеджеры учтены администраторами
    let i = 0;
    [['teacher', t], ['admin', a]].forEach(([role, k]) => { for (let j = 0; j < k; j++, i++) db.staff.push({ id: db.staffSeq++, centerId: id, name: staffName(id, i), role, phone: staffPhone(id, i), status: 'active', hiredAt: ago(30 + (i * 37 + id * 11) % 700), dismissedAt: null }); });
  });

  /* ---------- учётные данные для входа (PLT-CTR-020, CTR-STF-010, CTR-USR-010, BR-025) ----------
     Администратору центра логин задаёт платформа (номер телефона владельца), сотрудникам и ученикам — администратор центра сам; пароль всегда случайный и
     показывается один раз. Логин уникален на всей платформе. В записи хранится только отпечаток пароля (на проде — bcrypt/argon2 на сервере);
     пароль временный, при первом входе его нужно сменить. Ключ записи: 'center:<id>' | 'staff:<id>' | 'student:<id>'. */
  db.credentials = {};
  const PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без 0/O, 1/l/I: пароль читают с экрана
  const genPassword = () => {
    const buf = new Uint32Array(10);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf); else buf.forEach((_, i) => { buf[i] = Math.floor(Math.random() * 4294967296); });
    return Array.from(buf, n => PW_ALPHABET[n % PW_ALPHABET.length]).join('');
  };
  const pwFingerprint = pw => { let h = 5381; for (const ch of pw) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 'mock$' + h.toString(16); };
  const credByLogin = login => Object.entries(db.credentials).find(([, v]) => v.login === login);
  const loginTaken = login => Object.values(db.credentials).some(x => x.login === login);
  // проверка логина, который придумал администратор: формат и уникальность; возвращает нормализованный логин или бросает VALIDATION
  function checkLogin(raw, e) {
    const login = String(raw || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{3,31}$/.test(login)) e.login = 'Логин — от 4 до 32 символов: латинские буквы, цифры, точка, дефис, подчёркивание';
    else if (loginTaken(login)) e.login = 'Этот логин уже занят, придумайте другой';
    return login;
  }
  function issueCredentials(key, login) {
    const password = genPassword();
    db.credentials[key] = { login, passwordHash: pwFingerprint(password), issuedAt: new Date().toISOString(), mustChange: true };
    return { login, password, mustChange: true };
  }
  // логин администратора центра = телефон владельца; если занят другим центром — по номеру центра
  const ownerLogin = (c, phone) => { const l = digits(phone); return l.length >= 9 && !loginTaken(l) ? l : 'center' + c.id; };

  /* ---------- вход (AUTH-010): проверка логина и пароля, блокировка подбора, принудительная смена временного пароля ---------- */
  db.loginFails = {};
  const LOCK_AFTER = 5, LOCK_MS = 15 * 60 * 1000;
  const CABINET_ROLES = ['center_admin', 'admin'];   // веб-кабинет есть у владельца и администратора; преподаватели, менеджеры и ученики работают в мобильных приложениях
  function principal(key) {
    const [kind, sid] = key.split(':'), id = Number(sid);
    if (kind === 'center') { const c = db.centers.find(x => x.id === id); return c && { role: 'center_admin', roleLabel: 'Владелец центра', name: c.owner, c, active: true }; }
    if (kind === 'staff') { const t = db.staff.find(x => x.id === id), c = t && db.centers.find(x => x.id === t.centerId); return t && { role: t.role, roleLabel: STAFF_ROLES[t.role], name: t.name, c, active: t.status === 'active' }; }
    const st = db.students.find(x => x.id === id), c = st && db.centers.find(x => x.id === st.centerId);
    return st && { role: 'student', roleLabel: 'Студент', name: studentName(st), c, active: st.status === 'active' };
  }
  function authenticate(rawLogin, password) {
    const login = String(rawLogin || '').trim().toLowerCase(), f = db.loginFails[login] || { n: 0, until: 0 };
    if (f.until > Date.now()) throw new ApiError('LOCKED', 'Слишком много неудачных попыток. Повторите через ' + Math.ceil((f.until - Date.now()) / 60000) + ' мин');
    const hit = credByLogin(login);
    if (!hit || hit[1].passwordHash !== pwFingerprint(String(password || ''))) {
      f.n++; if (f.n >= LOCK_AFTER) { f.n = 0; f.until = Date.now() + LOCK_MS; }
      db.loginFails[login] = f;
      throw new ApiError('UNAUTHORIZED', 'Неверный логин или пароль');       // одно сообщение для «нет такого логина» и «не тот пароль»
    }
    delete db.loginFails[login];
    const who = principal(hit[0]);
    if (!who || !who.active) throw new ApiError('FORBIDDEN', 'Доступ закрыт. Обратитесь к администратору центра');
    return { key: hit[0], rec: hit[1], who };
  }
  const sessionDto = ({ rec, who }) => ({ login: rec.login, role: who.role, roleLabel: who.roleLabel, name: who.name, centerId: who.c.id, centerName: who.c.name, mustChange: rec.mustChange, cabinet: CABINET_ROLES.includes(who.role) });

  /* ---------- кабинет центра: ученики, группы, автоправила баллов (CTR-USR/GRP/CIN/COI) ----------
     Ученики есть у каждого центра с профилем: их число = profile.students. Имя и телефон сидовых учеников считаются по (центр, номер),
     у добавленных вручную хранятся в записи. Группа привязана к курсу центра, филиалу и преподавателю; у ученика не больше одной группы. */
  const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const SCHEDULES = { 'Пн, Ср, Пт': [0, 2, 4], 'Вт, Чт, Сб': [1, 3, 5], 'Пн, Чт': [0, 3], 'Сб, Вс': [5, 6], 'Пн–Пт': [0, 1, 2, 3, 4] };
  const SCHEDULE_KEYS = Object.keys(SCHEDULES);
  const GROUP_COURSES = ['Базовый курс', 'Интенсив', 'Подготовка к экзаменам', 'Разговорный клуб', 'Начальный уровень', 'Продвинутый уровень'];
  const COIN_SCOPES = { academy: 'Вся академия', course: 'Курс', group: 'Группа' };
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const studentName = s => s.name || staffName(s.centerId, 1000 + s.i);
  const studentPhone = s => s.phone || staffPhone(s.centerId, 1000 + s.i);
  db.students = []; db.studentSeq = 1;
  db.groups = []; db.groupSeq = 1;
  db.coinRules = []; db.coinRuleSeq = 1;
  Object.keys(db.profiles).forEach(key => {
    const id = Number(key), p = db.profiles[id];
    const teachers = db.staff.filter(s => s.centerId === id && s.role === 'teacher');
    const branches = db.moderation.filter(r => r.centerId === id).map(r => r.branch);
    if (!branches.length) branches.push('Главный филиал');
    const gCount = p.students ? Math.ceil(p.students / 14) : 0, first = db.groups.length;
    for (let g = 0; g < gCount; g++) {
      const h = hashN(id * 977 + g * 31), course = GROUP_COURSES[(id + g) % GROUP_COURSES.length], sched = SCHEDULE_KEYS[h % 3];
      db.groups.push({ id: db.groupSeq++, centerId: id, name: course + ' · группа ' + (g + 1), course, branch: branches[g % branches.length],
        teacherId: teachers.length ? teachers[g % teachers.length].id : null, status: g % 7 === 6 ? 'archived' : 'active', days: SCHEDULES[sched],
        startTime: hhmm(8 * 60 + 120 * (Math.floor(g / Math.max(1, teachers.length)) % 8)), durationMin: 90, hwPoints: 5 * (1 + h % 3), visitPoints: 1 + (h >>> 3) % 2, examDay: (h >>> 5) % 7, examPoints: 50 * (1 + (h >>> 7) % 3), capacity: 16 + (h >>> 9) % 17,
        startsAt: ago(60 + (g * 9) % 120).slice(0, 10), endsAt: ago(-(30 + (g * 11) % 90)).slice(0, 10) });
    }
    const open = db.groups.slice(first).filter(g => g.status === 'active');
    for (let i = 0; i < p.students; i++) {
      const g = open[hashN(id * 7919 + i) % open.length];
      db.students.push({ id: db.studentSeq++, centerId: id, i, status: i % 23 === 5 ? 'blocked' : 'active', groupId: g.id, joinedAt: ago(10 + (i * 13) % 300), coin: hashN(id * 31 + i) % 600 });
    }
    if (p.students) {
      [['Отличная посещаемость', 'academy', 90, 30, true], ['Отличная успеваемость по курсу', 'course', 80, 50, false]]
        .forEach(([name, scope, threshold, coin, active]) => db.coinRules.push({ id: db.coinRuleSeq++, centerId: id, name, scope, threshold, coin, active }));
    }
  });

  /* ---------- бизнес-правила (на проде — на сервере) ---------- */
  const rules = {
    isChurn: c => c.status === 'active' && !c.neverLogged && c.loginDays > 10,
    isExpiring: (c, w = 14) => c.status === 'active' && priceOf(c.plan) > 0 && c.expiresIn !== null && c.expiresIn <= w,
    riskScore(c) {
      let s = 40 + (c.loginDays - 10) * 4;
      if (c.lessons7d === 0) s += 20;
      if (rules.isExpiring(c)) s += 15;
      return Math.max(0, Math.min(100, s));
    },
    riskLevel: s => (s >= 75 ? 'high' : s >= 50 ? 'medium' : 'low'),
    staffLimit: c => planOf(c.plan).limits.staff,
    nearLimit: (c, t = NEAR_LIMIT) => c.status === 'active' && usageOf(c).some(u => u.pct >= Math.round(t * 100)),
    publishBlockers(r) {
      const b = [];
      if (r.desc.ru.trim().length < 20) b.push('описание RU обязательно (от 20 символов)');
      if (r.desc.tj.trim().length < 20) b.push('описание TJ обязательно (от 20 символов)');
      if (!r.gpsOk) b.push('подтвердите координаты на карте');
      return b;
    }
  };
  // «овердрафт использован» = сколько центр должен платформе, когда баланс ушёл в минус; доступно к расходу = баланс + лимит овердрафта
  const financeDto = c => {
    const used = Math.max(0, -c.balance), pct = c.overdraftLimit ? Math.round(used / c.overdraftLimit * 100) : null;
    return { overdraftUsed: used, available: c.balance + c.overdraftLimit, overdraftPct: pct, financeStatus: c.balance >= 0 ? 'ok' : (pct !== null && pct >= 80 ? 'critical' : 'overdraft') };
  };
  const centerDto = c => {
    const churn = rules.isChurn(c), score = churn ? rules.riskScore(c) : null;
    return { ...c, isChurn: churn, isExpiring: rules.isExpiring(c), monthlyPrice: priceOf(c.plan), smsBalance: smsBalanceOf(c.id), staff: [c.staffUsed, rules.staffLimit(c)], staffPct: Math.round(c.staffUsed / rules.staffLimit(c) * 100), nearLimit: rules.nearLimit(c), limits: planOf(c.plan).limits, usage: usageOf(c), worst: worstUsage(c), offer: c.offer ? { planId: c.offer.planId, planName: (db.plans.find(p => p.id === c.offer.planId) || {}).name } : null, pendingChange: pendingChangeDto(c), ...financeDto(c), riskScore: score, riskLevel: churn ? rules.riskLevel(score) : null };
  };
  const MODULE_KEYS = ['payroll', 'inventory', 'crm', 'geo'];
  const pickModules = m => Object.fromEntries(MODULE_KEYS.map(k => [k, !!(m && m[k])]));
  const planDto = p => {
    const cs = db.centers.filter(c => c.plan === p.name && c.status === 'active');
    return { ...p, isFree: p.price === 0, centers: cs.length, mrr: cs.length * p.price };
  };
  function findPlan(id) { const p = db.plans.find(x => x.id === id); if (!p) throw new ApiError('NOT_FOUND', 'Тариф не найден'); return p; }
  // existing = null при создании. Возвращает { поле: сообщение }
  function validatePlan(d, existing) {
    const e = {}, isInt = v => Number.isInteger(v) && v >= 1 && v <= 100000;
    if (!existing) {
      const name = String(d.name || '').trim();
      if (name.length < 2) e.name = 'Укажите название (минимум 2 символа)';
      else if (db.plans.some(p => p.name.toLowerCase() === name.toLowerCase())) e.name = 'Тариф с таким названием уже есть';
    }
    const free = existing && existing.price === 0;
    if (!Number.isInteger(d.price) || d.price < 0 || d.price > 1000000) e.price = 'Цена — целое число сомони';
    else if (free && d.price !== 0) e.price = 'Стартовый тариф остаётся бесплатным';
    else if (!free && d.price < 1) e.price = 'Цена должна быть больше 0';
    const l = d.limits || {};
    const onPlan = existing ? db.centers.filter(c => c.plan === existing.name && c.status === 'active') : [];
    const check = (key, field, usedKey, label) => {
      if (!isInt(l[key])) { e[field] = 'Целое число от 1'; return; }
      const worst = onPlan.slice().sort((a, b) => b[usedKey] - a[usedKey])[0];
      if (worst && l[key] < worst[usedKey]) e[field] = 'Ниже текущего использования: у центра «' + worst.name + '» сейчас ' + worst[usedKey] + ' (' + label + ')';
    };
    check('staff', 'staff', 'staffUsed', 'сотрудники');
    check('storageGb', 'storageGb', 'storageUsedGb', 'ГБ');
    check('branches', 'branches', 'branchesUsed', 'филиалы');
    return e;
  }
  // варианты смены тарифа: все активные тарифы, кроме текущего; рекомендуемый — самый дешёвый из более дорогих, где всё ниже порога «у лимита»
  function planOptions(c) {
    const cur = planOf(c.plan);
    const options = db.plans.filter(p => p.active && p.id !== cur.id).sort((a, b) => a.price - b.price).map(p => {
      const after = usageOf(c, p), exceeded = after.filter(u => u.used > u.limit);
      return { id: p.id, name: p.name, price: p.price, delta: p.price - cur.price, limits: p.limits, modules: p.modules, after, exceeded, fits: !exceeded.length,
        payable: p.price === 0 || c.balance + c.overdraftLimit >= p.price, balanceAfter: p.price > 0 ? c.balance - p.price : c.balance, comfortable: after.every(u => u.pct < Math.round(NEAR_LIMIT * 100)) };
    });
    const rec = options.find(o => o.delta > 0 && o.comfortable) || null;
    options.forEach(o => { o.recommended = !!rec && o.id === rec.id; });
    return options;
  }
  const upgradeOptions = c => planOptions(c).filter(o => o.delta > 0);

  /* ---------- аудит и биллинг (мок) ---------- */
  const ADMIN = { name: 'Алексей К.', role: 'SuperAdmin', ip: '10.0.0.5', device: 'Chrome · macOS' };
  const SYSTEM = { name: 'Платёжный шлюз', role: 'Система', ip: '—', device: 'webhook (мок)' };
  // способы ручного подтверждения: что считается основанием (документом) и как называется его номер
  const PAY_METHODS = [
    { method: 'Безнал (Р/С)', channel: 'bank', evidence: 'Банковская выписка', docLabel: '№ платёжного поручения', docHint: 'Например, ПП № 123' },
    { method: 'Наличные', channel: 'cash', evidence: 'Кассовый документ', docLabel: '№ приходного кассового ордера', docHint: 'Например, ПКО № 45' },
    { method: 'Перевод на карту', channel: 'card', evidence: 'Чек или скриншот перевода', docLabel: 'ID перевода или последние 4 цифры карты', docHint: 'Например, 4821' }
  ];
  // основание «деньги поступили вне системы»: способ, документ, дата, сумма, явное подтверждение. expected = точная сумма счёта; null — любая положительная (пополнение)
  function validateEvidence(d, { expected = null, notBefore = null } = {}) {
    const e = {}, pm = payMethodOf(d.method);
    if (!pm) e.method = 'Выберите способ оплаты';
    if (String(d.reference || '').trim().length < 3) e.reference = 'Укажите ' + (pm ? pm.docLabel.toLowerCase() : 'номер документа');
    const amount = Number(d.receivedAmount);
    if (expected !== null) { if (amount !== expected) e.receivedAmount = 'Сумма поступления должна совпадать со счётом (' + expected + ' сомони). Частичная оплата не поддерживается'; }
    else if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) e.receivedAmount = 'Сумма — целое число сомони от 1 до 1 000 000';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.receivedOn || ''))) e.receivedOn = 'Укажите дату поступления';
    else if (d.receivedOn > todayIso()) e.receivedOn = 'Дата поступления не может быть в будущем';
    else if (notBefore && d.receivedOn < notBefore) e.receivedOn = 'Оплата не могла поступить раньше выставления счёта';
    if (d.confirmed !== true) e.confirmed = 'Подтвердите, что деньги действительно поступили';
    return { e, pm, amount };
  }
  const payMethodOf = name => PAY_METHODS.find(m => m.method === name) || null;
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const addEvent = (inv, type, actor, text) => inv.events.push({ at: new Date().toISOString(), type, actor: { name: actor.name, role: actor.role }, text });
  const log = (action, entity, { before = null, after = null, reason = '', actor = ADMIN } = {}) => {
    db.audit.unshift({ id: db.auditSeq++, at: new Date().toISOString(), actor: { name: actor.name, role: actor.role }, ip: actor.ip, device: actor.device, action, entity, before, after, reason });
  };
  const centerEntity = c => ({ type: 'center', id: c.id, name: c.name });
  const pendingChangeOf = c => db.invoices.find(i => i.centerId === c.id && i.kind === 'plan_change' && i.status === 'pending') || null;
  const pendingChangeDto = c => {
    const i = pendingChangeOf(c);
    return i ? { invoiceId: i.id, planId: i.plan.toId, planName: i.plan.toName, amount: i.amount, deferred: !!i.deferred, dueAt: i.dueAt, overdue: !!i.dueAt && new Date(i.dueAt) < Date.now() } : null;
  };
  // «Просрочен» — не отдельный статус, а признак открытого счёта (как в Stripe): считается от срока оплаты
  const invoiceDto = i => {
    const c = findCenter(i.centerId), now = Date.now();
    const left = i.dueAt ? Math.ceil((new Date(i.dueAt) - now) / 864e5) : null;
    const overdue = i.status === 'pending' && left !== null && new Date(i.dueAt) < now;
    return { ...i, centerName: c.name, center: { id: c.id, name: c.name, city: c.city, owner: c.owner, phone: c.phone, plan: c.plan }, overdue, daysLeft: left, daysOverdue: overdue ? -left : 0, payLink: i.status === 'pending' ? 'https://pay.liniya.tj/' + i.id : null,
      fromBalance: i.status === 'pending' ? { balance: c.balance, overdraftLimit: c.overdraftLimit, available: c.balance + c.overdraftLimit, after: c.balance - i.amount, usesOverdraft: c.balance - i.amount < 0, possible: c.status === 'active' && c.balance + c.overdraftLimit >= i.amount } : null };
  };
  function findInvoice(id) { const i = db.invoices.find(x => x.id === id); if (!i) throw new ApiError('NOT_FOUND', 'Счёт не найден'); return i; }
  function newInvoice(c, fields, actor = ADMIN) {
    const now = new Date();
    const inv = { id: 'INV-' + (db.invoiceSeq++), centerId: c.id, method: null, channel: null, reference: '', status: 'pending', issuedAt: now.toISOString(), dueAt: new Date(now.getTime() + 7 * 864e5).toISOString(), paidAt: null, paidVia: null, payment: null, plan: null, reason: '', remindedAt: null, events: [], ...fields };
    addEvent(inv, 'issued', actor, 'Счёт выставлен');
    db.invoices.unshift(inv);
    return inv;
  }
  // оплата счёта с баланса на платформе (внутри уже проверено, что хватает средств с учётом овердрафта)
  function settleFromBalance(inv) {
    const c = findCenter(inv.centerId), before = c.balance;
    applyPaid(inv, { method: 'Списание с баланса на платформе', channel: 'balance', reference: 'BAL-' + inv.id.slice(4), via: 'balance', actor: ADMIN, receivedAmount: inv.amount, receivedOn: todayIso() });   // может отказать до списания (центр уже не вмещается в тариф)
    c.balance -= inv.amount;
    ledgerAdd(c, { type: 'charge', amount: -inv.amount, method: 'Списание с баланса на платформе', reference: inv.purpose, invoiceId: inv.id, actor: ADMIN });
    log('balance.charge', centerEntity(c), { before: { balance: before }, after: { balance: c.balance }, reason: inv.id + (c.balance < 0 ? ' · использован овердрафт ' + (-c.balance) : '') });
  }
  // тариф меняется ТОЛЬКО здесь: после оплаты счёта (или сразу, если новый тариф бесплатный)
  function applyPlanChange(c, p, { actor, reason, invoiceId }) {
    const before = { plan: c.plan, expiresIn: c.expiresIn };
    c.plan = p.name; c.expiresIn = p.price > 0 ? 30 : null; c.offer = null; c.reminded = false;
    db.invoices.filter(i => i.centerId === c.id && i.kind === 'renewal' && i.status === 'pending').forEach(i => {   // счёт на продление старого тарифа больше не нужен
      i.status = 'cancelled'; i.reason = 'Заменён сменой тарифа';
    });
    c.invoice = null;
    log('plan.changed', centerEntity(c), { before, after: { plan: c.plan, expiresIn: c.expiresIn }, reason: reason + (invoiceId ? ' · ' + invoiceId : ''), actor });
  }
  // оплата счёта: ручная (SuperAdmin подтвердил поступление) или онлайн (мок шлюза) — результат один и тот же
  function applyPaid(inv, { method, channel, reference, via, actor, receivedAmount, receivedOn, comment = '', txId = null, cardMask = null }) {
    const c = findCenter(inv.centerId);
    let plan = null;
    if (inv.kind === 'plan_change' && !inv.deferred) {
      plan = findPlan(inv.plan.toId);
      const over = usageOf(c, plan).find(u => u.used > u.limit);
      if (over) throw new ApiError('CONFLICT', 'Центр уже не вмещается в тариф «' + plan.name + '» (' + over.label.toLowerCase() + ': ' + over.used + ' > ' + over.limit + '). Отмените счёт и выберите другой тариф');
    }
    if (inv.kind === 'course' && inv.courseId && hasCourse(c.id, inv.courseId)) throw new ApiError('CONFLICT', 'Центр уже владеет этим курсом. Отмените счёт');
    inv.status = 'paid'; inv.method = method; inv.channel = channel; inv.reference = reference; inv.paidAt = new Date().toISOString(); inv.paidVia = via;
    inv.payment = { channel, method, reference, receivedAmount, receivedOn, comment, via, txId, cardMask, confirmedBy: { name: actor.name, role: actor.role } };
    addEvent(inv, 'paid', actor, (via === 'online' ? 'Оплата получена онлайн, подтверждена платёжным шлюзом: ' : via === 'balance' ? 'Оплата списана с баланса на платформе: ' : 'Оплата подтверждена вручную: ') + method + ' · ' + reference);
    log('invoice.paid', centerEntity(c), { before: { status: 'pending' }, after: { status: 'paid', method, reference }, reason: inv.id + ' · ' + inv.purpose, actor });
    if (inv.kind === 'renewal') {
      const before = { expiresIn: c.expiresIn };
      c.expiresIn = Math.max(c.expiresIn, 0) + 30; c.reminded = false; c.invoice = null;
      log('subscription.extended', centerEntity(c), { before, after: { expiresIn: c.expiresIn }, reason: inv.id, actor });
      addEvent(inv, 'applied', actor, 'Подписка продлена на 30 дней');
    } else if (inv.kind === 'plan_change' && inv.deferred) {
      addEvent(inv, 'applied', actor, 'Оплата отсроченного счёта получена: тариф «' + inv.plan.toName + '» уже действует');
    } else if (inv.kind === 'plan_change') {
      const from = c.plan;
      applyPlanChange(c, plan, { actor, reason: inv.reason, invoiceId: inv.id });
      addEvent(inv, 'applied', actor, 'Тариф изменён: «' + from + '» → «' + plan.name + '»');
    } else if (inv.kind === 'course' && inv.courseId) {
      const course = db.courses.find(x => x.id === inv.courseId);
      grantCourse(c, course, { source: 'invoice', invoiceId: inv.id, actor });
      const rq = db.courseRequests.find(r => r.invoiceId === inv.id); if (rq) { rq.status = 'fulfilled'; rq.decidedAt = new Date().toISOString(); }
      addEvent(inv, 'applied', actor, 'Курс «' + course.title + '» передан центру: он появился в кабинете, раздел «Материалы и тесты»');
    } else {
      addEvent(inv, 'applied', actor, 'Покупка зачтена');
    }
    return inv;
  }
  // Заявка центра на публикацию филиала в каталоге. Центр заполняет RU-описание (обязательно), TJ/EN — по желанию:
  // отсутствие TJ — как раз то, что ловит модерация. Лимит заявок — по лимиту филиалов тарифа.
  function validateBranch(d, center, ignoreId = null) {
    const e = {}, num = v => (v === '' || v === null || v === undefined ? NaN : Number(v));
    if (String(d.branch || '').trim().length < 3) e.branch = 'Укажите название филиала (минимум 3 символа)';
    if (!CITIES.includes(d.city)) e.city = 'Выберите город';
    if (String(d.address || '').trim().length < 5) e.address = 'Укажите адрес (улица и дом)';
    if (digits(d.phone).length < 9) e.phone = 'Введите корректный номер телефона';
    const lat = num(d.gps && d.gps.lat), lng = num(d.gps && d.gps.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) e.gps = 'Укажите координаты или нажмите «Определить по адресу»';
    else if (lat < 36.6 || lat > 41.1 || lng < 67.3 || lng > 75.2) e.gps = 'Координаты вне Таджикистана — проверьте широту и долготу';
    if (String((d.desc || {}).ru || '').trim().length < 20) e.descRu = 'Описание на русском обязательно (от 20 символов)';
    const dup = db.moderation.find(r => r.centerId === center.id && r.id !== ignoreId && r.status !== 'rejected' && r.address.trim().toLowerCase() === String(d.address || '').trim().toLowerCase() && r.city === d.city);
    if (!e.address && dup) e.address = 'Филиал с таким адресом уже подан: ' + dup.branch;
    const limit = planOf(center.plan).limits.branches, active = db.moderation.filter(r => r.centerId === center.id && r.id !== ignoreId && (r.status === 'pending' || r.status === 'published')).length;
    if (ignoreId === null && active >= limit) e.branch = 'Лимит филиалов тарифа «' + center.plan + '»: ' + limit + '. Повысьте тариф, чтобы добавить ещё';
    return e;
  }
  const branchFields = d => ({ branch: String(d.branch).trim(), city: d.city, district: String(d.district || '').trim() || 'Центр', address: String(d.address).trim(), phone: String(d.phone).trim(), gps: { lat: Number(d.gps.lat), lng: Number(d.gps.lng) }, geo: geocode(d.city, d.address), desc: { ru: String(d.desc.ru).trim(), tj: String((d.desc && d.desc.tj) || '').trim(), en: String((d.desc && d.desc.en) || '').trim() } });
  const nowLabel = () => 'сегодня, ' + new Date().toTimeString().slice(0, 5);
  // направления центра в заявке: пока филиал не указывает их сам, берём два детерминированных по id центра
  const directionsOf = r => r.directions || [DIRECTIONS[r.centerId % DIRECTIONS.length], DIRECTIONS[(r.centerId + 3) % DIRECTIONS.length]];
  const modDto = r => ({ ...r, centerName: findCenter(r.centerId).name, submittedBy: r.submittedBy || findCenter(r.centerId).owner, directions: directionsOf(r) });
  function findCenter(id) { const c = db.centers.find(x => x.id === id); if (!c) throw new ApiError('NOT_FOUND', 'Центр не найден'); return c; }
  function findMod(id) { const r = db.moderation.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND', 'Заявка не найдена'); return r; }
  const smsDto = x => { const c = db.centers.find(k => k.id === x.centerId); return { ...x, center: c ? c.name : '—', low: x.remaining / x.sms <= 0.1, usedPct: Math.round((1 - x.remaining / x.sms) * 100) }; };
  const buyersOf = c => (c.buyersOther || 0) + db.courseAccess.filter(a => a.courseId === c.id && a.status === 'active').length;
  const hasCourse = (centerId, courseId) => db.courseAccess.some(a => a.centerId === centerId && a.courseId === courseId && a.status === 'active');
  // передача курса центру: единственное место, где появляется доступ (после оплаты счёта, списания с баланса или бонуса)
  function grantCourse(c, course, { source, invoiceId = null, reason = '', actor = ADMIN }) {
    const a = { id: db.accessSeq++, centerId: c.id, courseId: course.id, source, invoiceId, reason, grantedAt: new Date().toISOString(), status: 'active', revokedAt: null, revokeReason: '', version: { lessons: course.lessons, tests: course.tests } };
    db.courseAccess.unshift(a);
    log('course.granted', centerEntity(c), { after: { course: course.title, source }, reason: course.title + (invoiceId ? ' · ' + invoiceId : '') + (reason ? ' · ' + reason : ''), actor });
    return a;
  }
  const accessDto = a => { const c = db.courses.find(x => x.id === a.courseId), ce = db.centers.find(x => x.id === a.centerId); return { ...a, centerName: ce ? ce.name : '—', city: ce ? ce.city : '', course: c ? courseDto(c) : null }; };
  const contentOf = c => (db.courseContent[c.id] || (db.courseContent[c.id] = { modules: [] }));
  const allLessons = c => contentOf(c).modules.flatMap(m => m.lessons);
  const courseStats = c => { const ls = allLessons(c), ms = ls.flatMap(l => l.materials); return { modules: contentOf(c).modules.length, lessons: ls.length, materials: ms.length, tests: ms.filter(x => x.type === 'test').length }; };
  const recount = c => { const st = courseStats(c); c.lessons = st.lessons; c.tests = st.tests; };
  // доступ к курсу. ctx.centerId — вызов из кабинета центра; без него — SuperAdmin платформы.
  // чтение: платформа видит платформенные курсы; центр — свои и купленные. Запись: платформа — платформенные, центр — только собственные.
  function courseFor(id, ctx = {}, { write = false } = {}) {
    const c = findCourse(id);
    if (ctx.centerId) {
      const own = c.ownerCenterId === ctx.centerId;
      if (write ? !own : !(own || hasCourse(ctx.centerId, c.id))) throw new ApiError('FORBIDDEN', write ? 'Править можно только собственные курсы центра' : 'У центра нет доступа к этому курсу');
    } else if (c.ownerCenterId) throw new ApiError('FORBIDDEN', 'Это собственный курс центра: управлять им может только центр');
    return c;
  }
  const courseLog = (c, ctx, text) => { if (!ctx.centerId) log('course.content', courseEntity(c), { reason: text }); };
  const requestDto = r => { const c = db.courses.find(x => x.id === r.courseId), ce = db.centers.find(x => x.id === r.centerId), inv = r.invoiceId ? db.invoices.find(i => i.id === r.invoiceId) : null; return { ...r, centerName: ce ? ce.name : '—', city: ce ? ce.city : '', course: c ? courseDto(c) : null, invoice: inv ? invoiceDto(inv) : null }; };
  const openRequest = (centerId, courseId) => db.courseRequests.find(r => r.centerId === centerId && r.courseId === courseId && (r.status === 'new' || r.status === 'invoiced'));
  function sellCourse(centerId, courseId, mode, reason = '') {
    const c = findCenter(centerId), course = findCourse(courseId);
    if (course.ownerCenterId) throw new ApiError('CONFLICT', 'Это собственный курс центра: передавать его нельзя');
    if (course.status !== 'published') throw new ApiError('CONFLICT', 'Курс не опубликован: передать его центру нельзя');
    if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: передача курса недоступна');
    if (hasCourse(c.id, course.id)) throw new ApiError('CONFLICT', 'Центр уже владеет курсом «' + course.title + '»');
    const open = db.invoices.find(i => i.centerId === c.id && i.kind === 'course' && i.courseId === course.id && i.status === 'pending');
    if (open) throw new ApiError('CONFLICT', 'По этому курсу уже выставлен счёт ' + open.id + ': оплатите или отмените его');
    if (!['invoice', 'balance', 'bonus'].includes(mode)) throw new ApiError('VALIDATION', 'Выберите способ передачи', { mode: 'Выберите способ передачи' });
    if (mode === 'bonus') {
      if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
      grantCourse(c, course, { source: 'bonus', reason: String(reason).trim() });
      return { mode: 'granted', course: courseDto(course) };
    }
    if (mode === 'balance' && c.balance + c.overdraftLimit < course.price) throw new ApiError('VALIDATION', 'Недостаточно средств на балансе на платформе (доступно ' + (c.balance + c.overdraftLimit) + ' сомони, нужно ' + course.price + ')', { mode: 'Не хватает баланса на платформе' });
    const inv = newInvoice(c, { kind: 'course', courseId: course.id, purpose: 'Курс: ' + course.title, amount: course.price });
    log('invoice.created', centerEntity(c), { after: { id: inv.id, amount: course.price, kind: 'course' }, reason: inv.purpose });
    if (mode === 'balance') { settleFromBalance(inv); return { mode: 'paid', invoice: invoiceDto(inv), course: courseDto(course) }; }
    return { mode: 'invoice', invoice: invoiceDto(inv), course: courseDto(course) };
  }
  const courseDto = c => ({ ...c, buyers: buyersOf(c), cover: 'src/assets/courses/' + (COURSE_COVERS[c.id] || DIRECTION_COVERS[c.direction] || 'english') + '.jpg', publishBlockers: courseBlockers(c), stats: courseStats(c) });
  const courseBlockers = c => { const b = []; if (!(c.price > 0)) b.push('укажите цену'); if (c.lessons < 1) b.push('добавьте хотя бы один урок'); return b; };
  function findCourse(id) { const c = db.courses.find(x => x.id === id); if (!c) throw new ApiError('NOT_FOUND', 'Курс не найден'); return c; }
  const courseEntity = c => ({ type: 'course', id: c.id, name: c.title });
  // МОК шлюза: оплата счёта картой (на проде шлюз сообщает серверу webhook'ом). Используется и платформой, и кабинетом центра
  function payOnlineMock(inv) {
    if (inv.status !== 'pending') throw new ApiError('CONFLICT', 'Счёт ' + inv.id + ' уже ' + (inv.status === 'paid' ? 'оплачен' : 'закрыт'));
    applyPaid(inv, { method: 'Онлайн (карта)', channel: 'online', reference: 'ONL-' + inv.id.slice(4), via: 'online', actor: SYSTEM, receivedAmount: inv.amount, receivedOn: todayIso(), txId: 'TX-' + inv.id.slice(4) + '-' + Math.floor(Math.random() * 9000 + 1000), cardMask: '•••• 4242' });
    return inv;
  }
  const centerActor = c => ({ name: c.owner, role: 'Владелец центра', ip: '—', device: 'Кабинет центра' });
  const staffDto = s => ({ ...s, roleLabel: STAFF_ROLES[s.role], hasAccess: !!db.credentials['staff:' + s.id] });

  /* ---------- общее состояние между страницами (демо) ----------
     Включается флагом window.LINIYA_SYNC (index.html, eduhub.html): снимок db лежит в localStorage, и кабинет SuperAdmin
     и кабинет центра видят одни данные. Ключ зависит от «отпечатка» начальных данных (без дат): правка seed в коде
     автоматически начинает с чистого состояния. Тесты запускаются без флага. На проде этого слоя нет — один бэкенд. */
  const SEED_JSON = JSON.stringify(db);
  const SYNC_PREFIX = 'liniya.db.';
  const fingerprint = s => { let h = 2166136261; s = s.replace(/\d{4}-\d\d-\d\d(T[\d:.]+Z)?/g, ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const syncOn = () => { try { return window.LINIYA_SYNC === true && !!window.localStorage; } catch (e) { return false; } };
  const SYNC_KEY = SYNC_PREFIX + fingerprint(SEED_JSON);
  let lastSaved = '';
  const syncApply = json => { const snap = JSON.parse(json); Object.keys(db).forEach(k => { delete db[k]; }); Object.assign(db, snap); lastSaved = json; };
  const syncSave = () => { if (!syncOn()) return; try { const s = JSON.stringify(db); if (s !== lastSaved) { localStorage.setItem(SYNC_KEY, s); lastSaved = s; } } catch (e) { /* хранилище недоступно или переполнено — работаем в памяти страницы */ } };
  if (syncOn()) {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(SYNC_PREFIX) && k !== SYNC_KEY).forEach(k => localStorage.removeItem(k));   // снимки прежних версий seed
      const saved = localStorage.getItem(SYNC_KEY);
      if (saved) syncApply(saved);
    } catch (e) { /* битый снимок — остаёмся на начальных данных */ }
    window.addEventListener('storage', e => {
      if (e.key !== SYNC_KEY) return;
      try { syncApply(e.newValue || SEED_JSON); window.dispatchEvent(new Event('liniya:sync')); } catch (err) { /* ignore */ }   // другая вкладка изменила данные или сбросила демо
    });
  }
  const call = async fn => {
    if (apiConfig.latencyMs) await sleep(apiConfig.latencyMs);
    try { return clone(fn()); } finally { syncSave(); }
  };

  /* ---------- кабинет центра: дашборд, пользователи, группы, правила баллов, аналитика ---------- */
  const writable = (c, what) => { if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: ' + what + ' нельзя'); };
  const intIn = (v, min, max) => { const n = Number(v); return v !== '' && v !== null && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const isDay = s => /^\d{4}-\d\d-\d\d$/.test(String(s || '')) && !isNaN(new Date(s));
  const paging = (items, page, pageSize) => items.slice((page - 1) * pageSize, page * pageSize);
  const centerBranches = c => { const l = db.moderation.filter(r => r.centerId === c.id).map(r => r.branch); return l.length ? l : ['Главный филиал']; };
  const memberCounts = cid => { const m = new Map(); db.students.forEach(s => { if (s.centerId === cid && s.groupId) m.set(s.groupId, (m.get(s.groupId) || 0) + 1); }); return m; };
  const teacherName = id => { const t = db.staff.find(s => s.id === id); return t ? t.name : '—'; };
  const grpDto = (g, members) => ({ id: g.id, name: g.name, course: g.course, branch: g.branch, teacherId: g.teacherId, teacher: teacherName(g.teacherId),
    status: g.status, statusLabel: g.status === 'active' ? 'Активна' : 'В архиве', days: g.days, startTime: g.startTime, durationMin: g.durationMin, endTime: hhmm(toMin(g.startTime) + g.durationMin), schedule: g.days.map(d => WEEK_DAYS[d]).join(', '),
    hwPoints: g.hwPoints, visitPoints: g.visitPoints, examDay: g.examDay, examDayLabel: WEEK_DAYS[g.examDay], examPoints: g.examPoints,
    startsAt: g.startsAt, endsAt: g.endsAt, capacity: g.capacity, members, lowFill: g.status === 'active' && members / g.capacity < 0.5 });
  const findGroup = (c, id) => { const g = db.groups.find(x => x.id === id && x.centerId === c.id); if (!g) throw new ApiError('NOT_FOUND', 'Группа не найдена'); return g; };
  const findStudent = (c, id) => { const s = db.students.find(x => x.id === id && x.centerId === c.id); if (!s) throw new ApiError('NOT_FOUND', 'Ученик не найден'); return s; };
  const stuDto = (s, grp) => ({ id: s.id, name: studentName(s), phone: studentPhone(s), status: s.status, statusLabel: s.status === 'active' ? 'Активен' : 'Заблокирован',
    joinedAt: s.joinedAt, coin: s.coin, hasAccess: !!db.credentials['student:' + s.id], groupId: s.groupId, group: grp ? grp.name : '', branch: grp ? grp.branch : '' });
  function groupFields(c, d, partial, excludeId = null) {
    const e = {}, out = {}, name = String(d.name || '').trim(), course = String(d.course || '').trim();
    if (name.length < 3 || name.length > 60) e.name = 'Название — от 3 до 60 символов'; else out.name = name;
    if (course.length < 2 || course.length > 60) e.course = 'Укажите курс'; else out.course = course;
    if (!d.branch) e.branch = 'Выберите филиал'; else out.branch = String(d.branch);
    const t = db.staff.find(s => s.id === Number(d.teacherId) && s.centerId === c.id && s.role === 'teacher' && s.status === 'active');
    if (!t) e.teacherId = 'Выберите преподавателя центра'; else out.teacherId = t.id;
    if (!SCHEDULES[d.schedule]) e.schedule = 'Выберите дни занятий'; else out.days = SCHEDULES[d.schedule];
    [['hwPoints', 0, 100, 'Баллы за ДЗ — от 0 до 100'], ['visitPoints', 0, 100, 'Баллы за посещение — от 0 до 100'], ['examPoints', 0, 1000, 'Баллы за экзамен — от 0 до 1000'], ['capacity', 1, 50, 'Мест — от 1 до 50']]
      .forEach(([k, a, b, msg]) => { const n = intIn(d[k], a, b); if (n === null) e[k] = msg; else out[k] = n; });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.startTime || ''))) e.startTime = 'Укажите время начала в формате ЧЧ:ММ'; else out.startTime = d.startTime;
    const dm = intIn(d.durationMin, 30, 240); if (dm === null) e.durationMin = 'Длительность — от 30 до 240 минут'; else out.durationMin = dm;
    if (out.startTime && out.durationMin && toMin(out.startTime) + out.durationMin > 24 * 60) e.durationMin = 'Занятие должно закончиться до полуночи';
    const ed = intIn(d.examDay, 0, 6); if (ed === null) e.examDay = 'Выберите день экзамена'; else out.examDay = ed;
    if (!isDay(d.startsAt)) e.startsAt = 'Укажите дату начала'; else out.startsAt = d.startsAt;
    if (!isDay(d.endsAt)) e.endsAt = 'Укажите дату окончания'; else if (out.startsAt && d.endsAt <= out.startsAt) e.endsAt = 'Окончание должно быть позже начала'; else out.endsAt = d.endsAt;
    if (partial && d.status !== undefined) { if (!['active', 'archived'].includes(d.status)) e.status = 'Неизвестный статус'; else out.status = d.status; }
    // BR-024: у преподавателя не бывает двух занятий в одно время
    if (!Object.keys(e).length && (out.status || (excludeId ? findGroup(c, excludeId).status : 'active')) === 'active') {
      const a = toMin(out.startTime), b = a + out.durationMin;
      const clash = db.groups.find(x => x.centerId === c.id && x.id !== excludeId && x.status === 'active' && x.teacherId === out.teacherId && x.days.some(day => out.days.includes(day)) && a < toMin(x.startTime) + x.durationMin && toMin(x.startTime) < b);
      if (clash) e.startTime = 'Преподаватель занят: «' + clash.name + '» в это время (' + clash.startTime + '–' + hhmm(toMin(clash.startTime) + clash.durationMin) + ')';
    }
    if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные группы', e);
    return out;
  }
  const ruleDto = r => ({ ...r, scopeLabel: COIN_SCOPES[r.scope], condition: 'Средний % ≥ ' + r.threshold, statusLabel: r.active ? 'Активно' : 'Выключено' });
  function ruleFields(d) {
    const e = {}, name = String(d.name || '').trim(), th = intIn(d.threshold, 1, 100), coin = intIn(d.coin, 1, 10000);
    if (name.length < 3 || name.length > 80) e.name = 'Название — от 3 до 80 символов';
    if (!COIN_SCOPES[d.scope]) e.scope = 'Выберите область';
    if (th === null) e.threshold = 'Порог — от 1 до 100 %';
    if (coin === null) e.coin = 'Награда — от 1 до 10 000 баллов';
    if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные правила', e);
    return { name, scope: d.scope, threshold: th, coin };
  }
  const cabinetCenter = {
    // дашборд (CTR-DSH-010): показатели, филиалы, группы с низкой заполненностью; посещаемость по дням — демонстрационная
    dashboard: centerId => call(() => {
      const c = findCenter(centerId), st = db.students.filter(s => s.centerId === c.id), gr = db.groups.filter(g => g.centerId === c.id), mc = memberCounts(c.id);
      const teachers = db.staff.filter(s => s.centerId === c.id && s.status === 'active' && s.role === 'teacher').length;
      const LABEL = { published: 'Активен', pending: 'На модерации', returned: 'Возвращён', rejected: 'Отклонён' };
      const branches = db.moderation.filter(r => r.centerId === c.id).map(r => ({ name: r.branch, address: r.address, status: r.status, statusLabel: LABEL[r.status] || '—' }));
      const active = gr.filter(g => g.status === 'active');
      const now = new Date(), nowDay = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes(), up = [];
      active.forEach(g => g.days.forEach(day => {
        let off = (day - nowDay + 7) % 7, delta = off * 1440 + toMin(g.startTime) - nowMin;
        if (delta < 0) { delta += 7 * 1440; off = 7; }
        up.push({ groupId: g.id, group: g.name, teacher: teacherName(g.teacherId), start: g.startTime, end: hhmm(toMin(g.startTime) + g.durationMin), inMin: delta,
          when: off === 0 ? (delta < 60 ? 'через ' + delta + ' мин' : 'сегодня, ' + g.startTime) : off === 1 ? 'завтра, ' + g.startTime : WEEK_DAYS[day] + ', ' + g.startTime });
      }));
      return { center: centerDto(c), upcoming: up.sort((a, b) => a.inMin - b.inMin).slice(0, 3),
        kpis: { students: st.length, studentsBlocked: st.filter(s => s.status === 'blocked').length, teachers, groupsActive: active.length, groupsTotal: gr.length,
          branches: branches.length, branchesActive: branches.filter(b => b.status === 'published').length },
        branches,
        lowFill: active.map(g => grpDto(g, mc.get(g.id) || 0)).filter(g => g.lowFill).sort((a, b) => a.members / a.capacity - b.members / b.capacity).slice(0, 3),
        week: WEEK_DAYS.map((day, i) => ({ day, percent: 70 + hashN(c.id * 53 + i * 17) % 26 })) };
    }),
    // выдача и сброс данных для входа сотруднику или ученику (BR-025): с основанием, запись в журнал; у кого доступа ещё нет — нужен логин
    access: {
      reset: (centerId, d = {}) => call(() => {
        const c = findCenter(centerId), kind = d.kind, e = {};
        if (!['staff', 'student'].includes(kind)) throw new ApiError('VALIDATION', 'Неизвестный тип пользователя');
        const who = kind === 'staff' ? db.staff.find(x => x.id === Number(d.id) && x.centerId === c.id && x.status === 'active') : db.students.find(x => x.id === Number(d.id) && x.centerId === c.id);
        if (!who) throw new ApiError('NOT_FOUND', 'Пользователь не найден');
        const key = kind + ':' + who.id, had = db.credentials[key], name = kind === 'staff' ? who.name : studentName(who);
        if (String(d.reason || '').trim().length < 5) e.reason = 'Минимум 5 символов';
        const login = had ? had.login : checkLogin(d.login, e);
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные', e);
        writable(c, 'выдавать доступ');
        const creds = issueCredentials(key, login);
        log('access.reset', centerEntity(c), { after: { login, mode: had ? 'новый пароль' : 'доступ выдан' }, reason: name + ' · ' + String(d.reason).trim(), actor: centerActor(c) });
        return { ...creds, name, hadAccess: !!had };
      })
    },
    // пользователи (CTR-USR-010): сотрудники и ученики одним списком; сотрудниками управляют в разделе «Сотрудники» (лимит тарифа, BR-023)
    users: {
      list: (centerId, { role = '', branch = '', q = '', page = 1, pageSize = 10 } = {}) => call(() => {
        const c = findCenter(centerId), gm = new Map(db.groups.filter(g => g.centerId === c.id).map(g => [g.id, g])), term = String(q).trim().toLowerCase();
        const rows = [
          ...db.staff.filter(s => s.centerId === c.id && s.status === 'active').map(s => ({ key: 't' + s.id, kind: 'staff', id: s.id, name: s.name, phone: s.phone, role: s.role, roleLabel: STAFF_ROLES[s.role], branch: '', status: 'active', hasAccess: !!db.credentials['staff:' + s.id] })),
          ...db.students.filter(s => s.centerId === c.id).map(s => { const g = gm.get(s.groupId); return { key: 's' + s.id, kind: 'student', id: s.id, name: studentName(s), phone: studentPhone(s), role: 'student', roleLabel: 'Студент', branch: g ? g.branch : '', status: s.status, hasAccess: !!db.credentials['student:' + s.id] }; })
        ].filter(r => (!role || r.role === role) && (!branch || r.branch === branch) && (!term || r.name.toLowerCase().includes(term) || (digits(term) && digits(r.phone).includes(digits(term)))))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return { center: centerDto(c), items: paging(rows, page, pageSize).map(r => ({ ...r, statusLabel: r.status === 'active' ? 'Активен' : 'Заблокирован' })), total: rows.length, page, pageSize,
          roles: { student: 'Студент', ...STAFF_ROLES }, branches: [...new Set([...gm.values()].map(g => g.branch))].sort(),
          groups: [...gm.values()].filter(g => g.status === 'active').map(g => ({ id: g.id, name: g.name })) };
      }),
      add: (centerId, d = {}) => call(() => {
        const c = findCenter(centerId), e = {}, name = String(d.name || '').trim(), ph = digits(d.phone);
        if (name.length < 3 || name.length > 60) e.name = 'ФИО — от 3 до 60 символов';
        if (ph.length < 9 || ph.length > 12) e.phone = 'Телефон — от 9 до 12 цифр';
        else if (db.students.some(s => s.centerId === c.id && digits(studentPhone(s)) === ph)) e.phone = 'Ученик с таким телефоном уже есть';
        const login = checkLogin(d.login, e);
        let gid = null;
        if (d.groupId) { const g = db.groups.find(x => x.id === Number(d.groupId) && x.centerId === c.id && x.status === 'active'); if (!g) e.groupId = 'Выберите действующую группу'; else gid = g.id; }
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные ученика', e);
        writable(c, 'добавлять учеников');
        if (gid) { const g = findGroup(c, gid); if ((memberCounts(c.id).get(gid) || 0) >= g.capacity) throw new ApiError('CONFLICT', 'В группе нет свободных мест', { groupId: 'Мест нет' }); }
        const s = { id: db.studentSeq++, centerId: c.id, i: null, name, phone: '+' + ph, status: 'active', groupId: gid, joinedAt: new Date().toISOString(), coin: 0 };
        db.students.push(s); db.profiles[c.id].students++;
        const credentials = issueCredentials('student:' + s.id, login);
        log('student.added', centerEntity(c), { after: { student: name, login }, reason: 'Добавлен ученик: ' + name + ' (выданы данные для входа)', actor: centerActor(c) });
        return { ...stuDto(s, gid ? findGroup(c, gid) : null), credentials };
      }),
      // блокировка и возврат доступа — права: причина обязательна, запись в журнал аудита
      setStatus: (centerId, id, { status, reason = '' } = {}) => call(() => {
        const c = findCenter(centerId), s = findStudent(c, id);
        if (!['active', 'blocked'].includes(status)) throw new ApiError('VALIDATION', 'Неизвестный статус');
        if (s.status === status) throw new ApiError('CONFLICT', status === 'blocked' ? 'Ученик уже заблокирован' : 'Ученик уже активен');
        if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
        writable(c, 'менять доступ учеников');
        s.status = status;
        log(status === 'blocked' ? 'student.blocked' : 'student.unblocked', centerEntity(c), { before: { student: studentName(s), status: status === 'blocked' ? 'Активен' : 'Заблокирован' }, after: { status: status === 'blocked' ? 'Заблокирован' : 'Активен' }, reason: studentName(s) + ' · ' + String(reason).trim(), actor: centerActor(c) });
        return stuDto(s, db.groups.find(g => g.id === s.groupId));
      })
    },
    // расписание (CTR-SCH-010): недельная сетка занятий активных групп
    schedule: (centerId, { branch = '', teacherId = '' } = {}) => call(() => {
      const c = findCenter(centerId), mc = memberCounts(c.id);
      const groups = db.groups.filter(g => g.centerId === c.id && g.status === 'active' && (!branch || g.branch === branch) && (!teacherId || g.teacherId === Number(teacherId)));
      const days = WEEK_DAYS.map((day, index) => ({ day, index, lessons: groups.filter(g => g.days.includes(index)).sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(g => ({ groupId: g.id, group: g.name, course: g.course, branch: g.branch, teacherId: g.teacherId, teacher: teacherName(g.teacherId), start: g.startTime, end: hhmm(toMin(g.startTime) + g.durationMin), members: mc.get(g.id) || 0, capacity: g.capacity })) }));
      return { center: centerDto(c), days, totals: { groups: groups.length, lessons: days.reduce((n, d) => n + d.lessons.length, 0) },
        options: { branches: centerBranches(c), teachers: db.staff.filter(s => s.centerId === c.id && s.role === 'teacher' && s.status === 'active').map(s => ({ id: s.id, name: s.name })) } };
    }),
    // группы (CTR-GRP-010): курс, филиал, преподаватель, расписание, система оценивания, состав
    groups: {
      list: (centerId, { course = '', branch = '', teacherId = '', status = '', page = 1, pageSize = 10 } = {}) => call(() => {
        const c = findCenter(centerId), all = db.groups.filter(g => g.centerId === c.id), mc = memberCounts(c.id);
        const rows = all.filter(g => (!course || g.course === course) && (!branch || g.branch === branch) && (!teacherId || g.teacherId === Number(teacherId)) && (!status || g.status === status));
        const teachers = db.staff.filter(s => s.centerId === c.id && s.role === 'teacher' && s.status === 'active').map(s => ({ id: s.id, name: s.name }));
        return { center: centerDto(c), items: paging(rows, page, pageSize).map(g => grpDto(g, mc.get(g.id) || 0)), total: rows.length, page, pageSize,
          options: { courses: [...new Set(all.map(g => g.course))].sort(), branches: centerBranches(c), teachers, schedules: SCHEDULE_KEYS, days: WEEK_DAYS } };
      }),
      get: (centerId, id) => call(() => {
        const c = findCenter(centerId), g = findGroup(c, id), mine = db.students.filter(s => s.centerId === c.id && s.groupId === g.id);
        return { center: centerDto(c), group: grpDto(g, mine.length), students: mine.map(s => stuDto(s, g)).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
          available: db.students.filter(s => s.centerId === c.id && s.groupId !== g.id && s.status === 'active').slice(0, 150).map(s => ({ id: s.id, name: studentName(s), phone: studentPhone(s) })),
          options: { courses: [...new Set(db.groups.filter(x => x.centerId === c.id).map(x => x.course))].sort(), branches: centerBranches(c),
            teachers: db.staff.filter(s => s.centerId === c.id && s.role === 'teacher' && s.status === 'active').map(s => ({ id: s.id, name: s.name })), schedules: SCHEDULE_KEYS, days: WEEK_DAYS } };
      }),
      create: (centerId, d = {}) => call(() => {
        const c = findCenter(centerId), f = groupFields(c, d, false); writable(c, 'создавать группы');
        const g = { id: db.groupSeq++, centerId: c.id, status: 'active', ...f }; db.groups.push(g); return grpDto(g, 0);
      }),
      update: (centerId, id, d = {}) => call(() => {
        const c = findCenter(centerId), g = findGroup(c, id), f = groupFields(c, d, true, id); writable(c, 'менять группы');
        const mc = memberCounts(c.id).get(g.id) || 0;
        if (f.capacity < mc) throw new ApiError('VALIDATION', 'В группе уже ' + mc + ' учеников', { capacity: 'Не меньше текущего состава (' + mc + ')' });
        Object.assign(g, f); return grpDto(g, mc);
      }),
      addStudent: (centerId, id, studentId) => call(() => {
        const c = findCenter(centerId), g = findGroup(c, id), s = findStudent(c, Number(studentId));
        writable(c, 'менять состав групп');
        if (g.status !== 'active') throw new ApiError('CONFLICT', 'Группа в архиве: состав менять нельзя');
        if (s.status !== 'active') throw new ApiError('CONFLICT', 'Ученик заблокирован');
        if (s.groupId === g.id) throw new ApiError('CONFLICT', 'Ученик уже в этой группе');
        if ((memberCounts(c.id).get(g.id) || 0) >= g.capacity) throw new ApiError('CONFLICT', 'В группе нет свободных мест (' + g.capacity + ' из ' + g.capacity + ')');
        s.groupId = g.id; return stuDto(s, g);
      }),
      removeStudent: (centerId, id, studentId) => call(() => {
        const c = findCenter(centerId), g = findGroup(c, id), s = findStudent(c, Number(studentId));
        writable(c, 'менять состав групп');
        if (s.groupId !== g.id) throw new ApiError('CONFLICT', 'Ученика нет в этой группе');
        s.groupId = null; return stuDto(s, null);
      })
    },
    // автоправила баллов (CTR-CIN-010): условия начисления; в прототипе правила хранятся и включаются, но не исполняются (Q-019)
    coinRules: {
      list: (centerId, { scope = '', page = 1, pageSize = 10 } = {}) => call(() => {
        const c = findCenter(centerId), rows = db.coinRules.filter(r => r.centerId === c.id && (!scope || r.scope === scope));
        return { center: centerDto(c), items: paging(rows, page, pageSize).map(ruleDto), total: rows.length, page, pageSize, scopes: COIN_SCOPES };
      }),
      create: (centerId, d = {}) => call(() => {
        const c = findCenter(centerId), f = ruleFields(d); writable(c, 'добавлять правила');
        const r = { id: db.coinRuleSeq++, centerId: c.id, active: true, ...f }; db.coinRules.push(r); return ruleDto(r);
      }),
      update: (centerId, id, d = {}) => call(() => {
        const c = findCenter(centerId), r = db.coinRules.find(x => x.id === id && x.centerId === c.id);
        if (!r) throw new ApiError('NOT_FOUND', 'Правило не найдено');
        writable(c, 'менять правила');
        if (d.active !== undefined) r.active = !!d.active;
        if (d.name !== undefined || d.scope !== undefined || d.threshold !== undefined || d.coin !== undefined) Object.assign(r, ruleFields({ name: r.name, scope: r.scope, threshold: r.threshold, coin: r.coin, ...d }));
        return ruleDto(r);
      })
    },
    // аналитика (CTR-COI-010): баллы учеников; начисление только преподавателем и автоправилами (BR-030)
    analytics: {
      list: (centerId, { groupId = '', coinFrom = '', coinTo = '', q = '', page = 1, pageSize = 10 } = {}) => call(() => {
        const c = findCenter(centerId), gm = new Map(db.groups.filter(g => g.centerId === c.id).map(g => [g.id, g])), term = String(q).trim().toLowerCase();
        const lo = coinFrom === '' ? -Infinity : Number(coinFrom), hi = coinTo === '' ? Infinity : Number(coinTo);
        const all = db.students.filter(s => s.centerId === c.id);
        const rows = all.filter(s => (!groupId || s.groupId === Number(groupId)) && s.coin >= lo && s.coin <= hi && (!term || studentName(s).toLowerCase().includes(term)))
          .sort((a, b) => b.coin - a.coin || a.id - b.id);
        const total = all.reduce((n, s) => n + s.coin, 0);
        return { center: centerDto(c), items: paging(rows, page, pageSize).map(s => stuDto(s, gm.get(s.groupId))), total: rows.length, page, pageSize,
          totals: { students: all.length, coin: total, avg: all.length ? Math.round(total / all.length) : 0 },
          groups: [...gm.values()].map(g => ({ id: g.id, name: g.name })) };
      })
    }
  };

  return {
    // вход в веб-кабинет по логину и паролю (AUTH-010); сессия — на стороне страницы входа
    auth: {
      login: ({ login, password } = {}) => call(() => sessionDto(authenticate(login, password))),
      changePassword: ({ login, password, newPassword } = {}) => call(() => {
        const a = authenticate(login, password), np = String(newPassword || '');
        if (np.length < 8 || !/[A-Za-zА-Яа-я]/.test(np) || !/\d/.test(np)) throw new ApiError('VALIDATION', 'Пароль слишком простой', { newPassword: 'Не короче 8 символов, с буквой и цифрой' });
        if (np === String(password)) throw new ApiError('VALIDATION', 'Новый пароль совпадает с текущим', { newPassword: 'Придумайте другой пароль' });
        a.rec.passwordHash = pwFingerprint(np); a.rec.mustChange = false; a.rec.changedAt = new Date().toISOString();
        log('auth.password_changed', centerEntity(a.who.c), { reason: a.who.name + ' (' + a.who.roleLabel + ') сменил пароль', actor: { name: a.who.name, role: a.who.roleLabel, ip: '—', device: 'Страница входа' } });
        return sessionDto(a);
      })
    },
    sync: {
      enabled: syncOn,
      reset: () => { try { localStorage.removeItem(SYNC_KEY); } catch (e) { /* ignore */ } syncApply(SEED_JSON); }
    },
    dictionaries: {
      get: () => call(() => ({ cities: CITIES, directions: DIRECTIONS, managers: MANAGERS, payMethods: PAY_METHODS, plans: db.plans.filter(p => p.active).map(p => ({ id: p.id, name: p.name, price: p.price, limits: p.limits, modules: p.modules })) }))
    },
    platform: {
      attention: () => call(() => ({
        totalCenters: db.totalCenters,
        moderation: db.moderation.filter(r => r.status === 'pending').length,
        expiring: db.centers.filter(c => rules.isExpiring(c)).length,
        expiring7: db.centers.filter(c => rules.isExpiring(c, 7)).length,
        churn: db.centers.filter(rules.isChurn).length,
        blocked: db.centers.filter(c => c.status === 'blocked').length,
        nearLimit: db.centers.filter(c => rules.nearLimit(c)).length,
        overdraft: db.centers.filter(c => c.balance < 0).length,
        pendingInvoices: db.invoices.filter(i => i.status === 'pending').length
      }))
    },
    centers: {
      list: ({ q = '', plan = 'all', city = 'all', filter = 'all', limit, page = 1, pageSize = 0 } = {}) => call(() => {
        const s = q.trim().toLowerCase();
        let items = db.centers.filter(c =>
          (!s || (c.name + ' ' + c.city + ' ' + c.owner).toLowerCase().includes(s)) &&
          (plan === 'all' || c.plan === plan) && (city === 'all' || c.city === city) &&
          (filter === 'all' || (filter === 'expiring' && rules.isExpiring(c)) || (filter === 'churn' && rules.isChurn(c)) || (filter === 'blocked' && c.status === 'blocked') || (filter === 'overdraft' && c.balance < 0)));
        const total = items.length;
        if (pageSize) items = items.slice((page - 1) * pageSize, page * pageSize);
        else if (limit) items = items.slice(0, limit);
        return { items: items.map(centerDto), total, page, pageSize, platformTotal: db.totalCenters, meta: { activeSubs: 118, newMonth: 12, overdraft: db.centers.filter(c => c.balance < 0).length } };
      }),
      recentActivity: ({ limit = 5 } = {}) => call(() => ({ items: [1, 2, 3, 4, 5].slice(0, limit).map(id => centerDto(findCenter(id))) })),
      expiring: ({ withinDays = 14 } = {}) => call(() => {
        const items = db.centers.filter(c => rules.isExpiring(c, withinDays)).sort((a, b) => a.expiresIn - b.expiresIn);
        return {
          items: items.map(centerDto),
          meta: {
            count: items.length,
            within7: db.centers.filter(c => rules.isExpiring(c, 7)).length,
            amount: items.reduce((s, c) => s + priceOf(c.plan), 0),
            invoiced: items.filter(c => c.invoice).length,
            expired: items.filter(c => c.expiresIn < 0).length
          }
        };
      }),
      churn: ({ filter = 'all' } = {}) => call(() => {
        const all = db.centers.filter(rules.isChurn);
        const items = all
          .filter(c => filter === 'all' || (filter === 'nomanager' && !c.manager) || (filter === 'contacted' && c.contacted))
          .sort((a, b) => rules.riskScore(b) - rules.riskScore(a));
        return {
          items: items.map(centerDto),
          meta: {
            total: all.length,
            high: all.filter(c => rules.riskScore(c) >= 75).length,
            mrrAtRisk: all.reduce((s, c) => s + priceOf(c.plan), 0),
            withoutManager: all.filter(c => !c.manager).length,
            contacted: all.filter(c => c.contacted).length,
            activeCenters: db.centers.filter(c => c.status === 'active').length
          }
        };
      }),
      nameAvailable: ({ name }) => call(() => ({ available: !db.centers.some(c => c.name.toLowerCase() === String(name).trim().toLowerCase()) })),
      create: payload => call(() => {
        const d = payload || {}, e = {};
        if (String(d.name || '').trim().length < 3) e.name = 'Укажите название (минимум 3 символа)';
        else if (db.centers.some(c => c.name.toLowerCase() === d.name.trim().toLowerCase())) e.name = 'Центр с таким названием уже подключён';
        if (String(d.address || '').trim().length < 5) e.address = 'Укажите адрес филиала';
        if (digits(d.phone).length < 9) e.phone = 'Введите корректный номер телефона';
        if (String(d.ownerName || '').trim().length < 3) e.ownerName = 'Укажите ФИО владельца';
        if (digits(d.ownerPhone).length < 9) e.ownerPhone = 'Введите корректный номер телефона';
        if (!d.terms) e.terms = 'Нужно подтвердить принятие оферты';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные формы', e);
        const c = {
          id: Math.max(...db.centers.map(x => x.id)) + 1, name: d.name.trim(), city: d.city, owner: d.ownerName.trim(), phone: d.ownerPhone.trim(),
          plan: 'Старт', balance: 0, overdraftLimit: OVERDRAFT_DEFAULT['Старт'], staffUsed: 0, storageUsedGb: 0, branchesUsed: 1, loginDays: 0, neverLogged: true, lessons7d: 0, status: 'active', expiresIn: null,
          reminded: false, invoice: null, manager: null, contacted: false
        };
        db.centers.unshift(c); db.totalCenters++;
        const credentials = issueCredentials('center:' + c.id, ownerLogin(c, d.ownerPhone));
        log('center.credentials', centerEntity(c), { after: { login: credentials.login, passwordChange: 'при первом входе' }, reason: 'Выданы данные для входа администратору центра ' + c.owner });
        db.profiles[c.id] = { direction: 'Направление не указано', description: '', foundedYear: new Date().getFullYear(), students: 0, logo: 'src/assets/centers/logo-default.svg', banner: 'src/assets/centers/banner-school.jpg' };
        return { ...centerDto(c), credentials };
      }),
      // выдача или сброс данных для входа администратора центра (BR-025): основание обязательно, пароль показывается один раз
      adminAccess: (id, { reason = '' } = {}) => call(() => {
        const c = findCenter(id), key = 'center:' + c.id, had = db.credentials[key];
        if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите основание (минимум 5 символов)', { reason: 'Минимум 5 символов' });
        const creds = issueCredentials(key, had ? had.login : ownerLogin(c, c.phone));
        log('center.credentials', centerEntity(c), { after: { login: creds.login, mode: had ? 'новый пароль' : 'доступ выдан' }, reason: c.owner + ' · ' + String(reason).trim() });
        return { ...creds, name: c.owner, hadAccess: !!had };
      }),
      // состав центра для SuperAdmin (PLT-CTR-060): группы, ученики и сотрудники только для просмотра, без телефонов; касса и платежи не затрагиваются (BR-022)
      people: (id, { section = 'groups', q = '', page = 1, pageSize = 10 } = {}) => call(() => {
        const c = findCenter(id), term = String(q).trim().toLowerCase(), mc = memberCounts(c.id), gm = new Map(db.groups.filter(g => g.centerId === c.id).map(g => [g.id, g]));
        const groups = db.groups.filter(g => g.centerId === c.id), students = db.students.filter(s => s.centerId === c.id), staff = db.staff.filter(s => s.centerId === c.id && s.status === 'active');
        if (!['groups', 'students', 'staff'].includes(section)) throw new ApiError('VALIDATION', 'Неизвестный раздел');
        const rows = section === 'groups' ? groups.map(g => grpDto(g, mc.get(g.id) || 0)).map(g => ({ id: g.id, name: g.name, course: g.course, branch: g.branch, teacher: g.teacher, schedule: g.schedule + ' · ' + g.startTime + '–' + g.endTime, members: g.members, capacity: g.capacity, status: g.status, statusLabel: g.statusLabel }))
          : section === 'students' ? students.map(s => { const g = gm.get(s.groupId); return { id: s.id, name: studentName(s), group: g ? g.name : '', branch: g ? g.branch : '', status: s.status, statusLabel: s.status === 'active' ? 'Активен' : 'Заблокирован' }; })
          : staff.map(s => ({ id: s.id, name: s.name, role: s.role, roleLabel: STAFF_ROLES[s.role], hiredAt: s.hiredAt }));
        const items = rows.filter(r => !term || r.name.toLowerCase().includes(term));
        return { center: centerDto(c), section, items: paging(items, page, pageSize), total: items.length, page, pageSize, counts: { groups: groups.length, students: students.length, staff: staff.length } };
      }),
      remind: ({ ids }) => call(() => { const list = ids.map(findCenter); list.forEach(c => { c.reminded = true; }); return { updated: list.length }; }),
      invoice: id => call(() => {
        const c = findCenter(id);
        if (c.invoice) throw new ApiError('CONFLICT', 'Счёт уже выставлен: ' + c.invoice);
        const pc = pendingChangeOf(c);
        if (pc) throw new ApiError('CONFLICT', 'Есть неоплаченный счёт на смену тарифа ' + pc.id + ': оплатите или отмените его');
        const amount = priceOf(c.plan);
        if (amount <= 0) throw new ApiError('VALIDATION', 'Бесплатный тариф не продлевается счётом');
        const inv = newInvoice(c, { kind: 'renewal', purpose: 'Продление: тариф «' + c.plan + '» (1 мес)', amount });
        c.invoice = inv.id;
        log('invoice.created', centerEntity(c), { after: { id: inv.id, amount, kind: 'renewal' }, reason: inv.purpose });
        return centerDto(c);
      }),
      setManager: (id, { manager }) => call(() => {
        if (manager && !MANAGERS.includes(manager)) throw new ApiError('VALIDATION', 'Неизвестный менеджер');
        const c = findCenter(id); c.manager = manager || null;
        return centerDto(c);
      }),
      planChangeInfo: id => call(() => {
        const c = findCenter(id), pc = pendingChangeOf(c);
        return {
          center: centerDto(c),
          options: planOptions(c),
          pending: pc ? invoiceDto(pc) : null,
          history: db.audit.filter(e => e.entity.type === 'center' && e.entity.id === c.id && ['plan.changed', 'invoice.created', 'invoice.paid', 'invoice.cancelled'].includes(e.action)).slice(0, 6)
        };
      }),
      // смена тарифа = счёт на новый тариф; сам тариф сменится после оплаты (applyPaid). Бесплатный тариф — без счёта
      requestPlanChange: (id, { planId, reason = '', payFromBalance = false, deferPayment = false, deferConfirmed = false }) => call(() => {
        const c = findCenter(id), p = findPlan(planId), e = {};
        if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: смена тарифа недоступна');
        if (!p.active) throw new ApiError('VALIDATION', 'Тариф «' + p.name + '» в архиве', { plan: 'Тариф в архиве' });
        if (c.plan === p.name) throw new ApiError('CONFLICT', 'Центр уже на тарифе «' + p.name + '»');
        const pc = pendingChangeOf(c);
        if (pc) throw new ApiError('CONFLICT', 'Уже выставлен счёт на смену тарифа ' + pc.id + ': оплатите или отмените его');
        const over = usageOf(c, p).filter(u => u.used > u.limit);
        if (over.length) e.plan = 'Не вмещается: ' + over.map(u => u.label.toLowerCase() + ' ' + u.used + ' > ' + u.limit).join('; ');
        if (String(reason).trim().length < 5) e.reason = 'Укажите причину (минимум 5 символов)';
        if (payFromBalance && deferPayment) e.payment = 'Выберите один способ: списать с баланса или отсрочить оплату';
        else if (deferPayment && p.price > 0 && deferConfirmed !== true) e.payment = 'Подтвердите, что тариф будет изменён до поступления оплаты';
        else if (payFromBalance && p.price > 0 && c.balance + c.overdraftLimit < p.price) e.payment = 'Недостаточно средств на балансе на платформе (с учётом овердрафта): доступно ' + (c.balance + c.overdraftLimit) + ' сомони, нужно ' + p.price;
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные', e);
        const why = String(reason).trim();
        if (p.price === 0) {                                          // переход на бесплатный тариф: платить нечего
          applyPlanChange(c, p, { actor: ADMIN, reason: why });
          return { mode: 'applied', center: centerDto(c), invoice: null };
        }
        const inv = newInvoice(c, { kind: 'plan_change', purpose: 'Смена тарифа: «' + c.plan + '» → «' + p.name + '» (1 мес)', amount: p.price, plan: { fromName: c.plan, fromExpiresIn: c.expiresIn, toId: p.id, toName: p.name }, reason: why });
        log('invoice.created', centerEntity(c), { after: { id: inv.id, amount: inv.amount, kind: 'plan_change', to: p.name }, reason: why });
        if (payFromBalance) { settleFromBalance(inv); return { mode: 'paid', center: centerDto(c), invoice: invoiceDto(inv) }; }   // выставили счёт и сразу оплатили с баланса
        if (deferPayment) {                                           // исключение по решению SuperAdmin: тариф меняется сразу, счёт остаётся открытым (срок — 7 дней)
          inv.deferred = true;
          addEvent(inv, 'deferred', ADMIN, 'Тариф изменён до оплаты по решению SuperAdmin; оплата ожидается до ' + new Date(inv.dueAt).toLocaleDateString('ru-RU'));
          applyPlanChange(c, p, { actor: ADMIN, reason: why + ' · с отсрочкой оплаты (' + inv.id + ')', invoiceId: inv.id });
          return { mode: 'deferred', center: centerDto(c), invoice: invoiceDto(inv) };
        }
        return { mode: 'invoice', center: centerDto(c), invoice: invoiceDto(inv) };
      }),
      sendOffer: ({ ids, planId }) => call(() => {
        let sent = 0, skipped = 0;
        ids.forEach(id => {
          const c = findCenter(id), opts = upgradeOptions(c);
          const chosen = planId ? opts.find(o => o.id === planId) : opts.find(o => o.recommended);
          if (c.status !== 'active' || !chosen || pendingChangeOf(c)) { skipped++; return; }      // нет подходящего тарифа (высший), центр заблокирован или уже выставлен счёт
          c.offer = { planId: chosen.id }; sent++;
        });
        return { sent, skipped };
      }),
      markContacted: id => call(() => {
        const c = findCenter(id); c.contacted = true;
        if (!c.manager) c.manager = MANAGERS[0];       // правило: у центра с контактом всегда есть ответственный
        return centerDto(c);
      })
    },
    plans: {
      list: () => call(() => {
        const items = [...db.plans].sort((a, b) => a.price - b.price).map(planDto);
        return {
          items,
          meta: {
            total: items.length,
            active: items.filter(p => p.active).length,
            paidCenters: db.centers.filter(c => c.status === 'active' && priceOf(c.plan) > 0).length,
            mrr: items.reduce((s, p) => s + p.mrr, 0),
            nearLimit: db.centers.filter(c => rules.nearLimit(c)).length
          }
        };
      }),
      create: payload => call(() => {
        const d = payload || {}, e = validatePlan(d, null);
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные тарифа', e);
        const p = { id: 'plan-' + (db.planSeq++), name: d.name.trim(), price: d.price, limits: { ...d.limits }, modules: pickModules(d.modules), active: true };
        db.plans.push(p);
        log('plan.created', { type: 'plan', id: p.id, name: p.name }, { after: { price: p.price, limits: p.limits } });
        return planDto(p);
      }),
      update: (id, patch) => call(() => {
        const p = findPlan(id), d = patch || {};
        if (d.active === false && p.active) {
          if (p.price === 0) throw new ApiError('CONFLICT', 'Тариф «' + p.name + '» нельзя архивировать: он назначается новым центрам');
          const n = db.centers.filter(c => c.plan === p.name && c.status === 'active').length;
          if (n) throw new ApiError('CONFLICT', 'На тарифе «' + p.name + '» ' + n + ' ' + (n === 1 ? 'центр' : 'центров') + ': сначала переведите их на другой тариф');
        }
        if (d.price !== undefined || d.limits !== undefined || d.modules !== undefined) {
          const e = validatePlan({ price: d.price, limits: d.limits, modules: d.modules }, p);
          if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные тарифа', e);
          const before = { price: p.price, limits: { ...p.limits }, modules: { ...p.modules } };
          p.price = d.price; p.limits = { ...d.limits }; p.modules = pickModules(d.modules);
          const after = { price: p.price, limits: { ...p.limits }, modules: { ...p.modules } };
          if (JSON.stringify(before) !== JSON.stringify(after)) log('plan.updated', { type: 'plan', id: p.id, name: p.name }, { before, after });
        }
        if (typeof d.active === 'boolean' && d.active !== p.active) {
          p.active = d.active;
          log(p.active ? 'plan.restored' : 'plan.archived', { type: 'plan', id: p.id, name: p.name }, { before: { active: !p.active }, after: { active: p.active } });
        }
        return planDto(p);
      }),
      nearLimit: ({ threshold = NEAR_LIMIT, metric = 'any', q = '', plan = 'all', status = 'all', sort = 'usage' } = {}) => call(() => {
        const tp = Math.round(threshold * 100), term = q.trim().toLowerCase();
        const pctOf = c => (metric === 'any' ? worstUsage(c).pct : usageOf(c).find(u => u.key === metric).pct);
        const entry = c => {
          const options = upgradeOptions(c), rec = options.find(o => o.recommended) || null;
          return { center: centerDto(c), options, suggestion: rec ? { id: rec.id, name: rec.name, price: rec.price, delta: rec.delta } : null, metricPct: pctOf(c) };
        };
        const base = db.centers.filter(c => rules.nearLimit(c, threshold)).map(entry);      // сводка — по порогу, без фильтров
        const items = db.centers.filter(c => c.status === 'active' && pctOf(c) >= tp).map(entry)
          .filter(e => (!term || (e.center.name + ' ' + e.center.city + ' ' + e.center.owner).toLowerCase().includes(term)) && (plan === 'all' || e.center.plan === plan) &&
            (status === 'all' || (status === 'offered' && e.center.offer && !e.center.pendingChange) || (status === 'nooffer' && !e.center.offer && !e.center.pendingChange) || (status === 'pending' && e.center.pendingChange) || (status === 'full' && e.metricPct >= 100)));
        const delta = e => (e.suggestion ? e.suggestion.delta : -1);
        const by = { usage: (a, b) => b.metricPct - a.metricPct, name: (a, b) => a.center.name.localeCompare(b.center.name, 'ru'), potential: (a, b) => (delta(b) - delta(a)) || (b.metricPct - a.metricPct) };
        items.sort(by[sort] || by.usage);
        return {
          items,
          meta: {
            threshold: tp,
            total: base.length,
            full: base.filter(e => e.center.worst.pct >= 100).length,
            offered: base.filter(e => e.center.offer && !e.center.pendingChange).length,
            withoutOffer: base.filter(e => !e.center.offer && !e.center.pendingChange).length,
            pending: base.filter(e => e.center.pendingChange).length,
            potential: base.reduce((sum, e) => sum + (e.suggestion ? e.suggestion.delta : 0), 0)
          }
        };
      })
    },
    billing: {
      get: id => call(() => invoiceDto(findInvoice(id))),
      list: ({ status = 'all', kind = 'all', q = '' } = {}) => call(() => {
        const term = q.trim().toLowerCase(), now = Date.now();
        const all = db.invoices.map(invoiceDto);
        const byStatus = i => status === 'all' || (status === 'overdue' ? i.overdue : i.status === status);
        // вкладки-статусы считаются внутри выбранного типа и поиска: цифра на вкладке = число строк после её выбора
        const base = all.filter(i => (kind === 'all' || i.kind === kind) && (!term || (i.id + ' ' + i.centerName + ' ' + i.purpose + ' ' + (i.reference || '')).toLowerCase().includes(term)));
        const items = base.filter(byStatus).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
        const pending = all.filter(i => i.status === 'pending'), overdue = pending.filter(i => i.overdue);
        return {
          items,
          meta: {
            total: base.length,
            allTotal: all.length,
            paid30: all.filter(i => i.status === 'paid' && now - new Date(i.paidAt) <= 30 * 864e5).reduce((sum, i) => sum + i.amount, 0),
            pendingSum: pending.reduce((sum, i) => sum + i.amount, 0),
            pendingCount: pending.length,
            overdueSum: overdue.reduce((sum, i) => sum + i.amount, 0),
            overdueCount: overdue.length,
            counts: { pending: base.filter(i => i.status === 'pending').length, overdue: base.filter(i => i.overdue).length, paid: base.filter(i => i.status === 'paid').length, cancelled: base.filter(i => i.status === 'cancelled').length }
          }
        };
      }),
      // SuperAdmin подтверждает, что оплата УЖЕ поступила вне системы (р/с, касса, перевод на карту). Нужны основание и сумма; действие необратимо
      confirmPayment: (id, d = {}) => call(() => {
        const inv = findInvoice(id);
        if (inv.status !== 'pending') throw new ApiError('CONFLICT', 'Счёт ' + inv.id + ' уже ' + (inv.status === 'paid' ? 'оплачен' : 'закрыт'));
        const { e, pm, amount } = validateEvidence(d, { expected: inv.amount, notBefore: inv.issuedAt.slice(0, 10) });
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные оплаты', e);
        applyPaid(inv, { method: d.method, channel: pm.channel, reference: String(d.reference).trim(), via: 'manual', actor: ADMIN, receivedAmount: amount, receivedOn: d.receivedOn, comment: String(d.comment || '').trim() });
        return invoiceDto(inv);
      }),
      // оплата счёта с баланса на платформе: можно уйти в минус в пределах овердрафта; платит SuperAdmin от имени центра
      payFromBalance: id => call(() => {
        const inv = findInvoice(id), c = findCenter(inv.centerId);
        if (inv.status !== 'pending') throw new ApiError('CONFLICT', 'Счёт ' + inv.id + ' уже ' + (inv.status === 'paid' ? 'оплачен' : 'закрыт'));
        if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: списание недоступно');
        if (c.balance + c.overdraftLimit < inv.amount) throw new ApiError('VALIDATION', 'Недостаточно средств на балансе на платформе: баланс ' + c.balance + ', овердрафт до ' + c.overdraftLimit + ', нужно ' + inv.amount + ' сомони', { balance: 'Пополните баланс или увеличьте лимит овердрафта' });
        settleFromBalance(inv);
        return invoiceDto(inv);
      }),
      // МОК: онлайн-оплата владельцем центра. Платёжный шлюз сам сообщает серверу об оплате (webhook) — из UI это не вызывается
      simulateOnlinePayment: id => call(() => invoiceDto(payOnlineMock(findInvoice(id)))),
      remind: ({ ids }) => call(() => {
        let sent = 0, skipped = 0;
        ids.forEach(id => {
          const inv = findInvoice(id);
          if (inv.status !== 'pending') { skipped++; return; }
          inv.remindedAt = new Date().toISOString(); addEvent(inv, 'reminded', ADMIN, 'Напоминание отправлено владельцу центра'); sent++;
        });
        return { sent, skipped };
      }),
      cancel: (id, { reason = '' } = {}) => call(() => {
        const inv = findInvoice(id);
        if (inv.status !== 'pending') throw new ApiError('CONFLICT', 'Отменить можно только неоплаченный счёт');
        if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
        const c = findCenter(inv.centerId);
        let revertNote = '';
        if (inv.kind === 'plan_change' && inv.deferred) {                // тариф уже действует: отмена счёта = откат на прежний тариф
          const prev = planOf(inv.plan.fromName);
          if (!prev) throw new ApiError('CONFLICT', 'Прежний тариф «' + inv.plan.fromName + '» недоступен: откат невозможен');
          const over = usageOf(c, prev).find(u => u.used > u.limit);
          if (over) throw new ApiError('CONFLICT', 'Центр уже не вмещается в прежний тариф «' + prev.name + '» (' + over.label.toLowerCase() + ': ' + over.used + ' > ' + over.limit + '): откат невозможен, оплатите счёт или сократите нагрузку');
          const before = { plan: c.plan, expiresIn: c.expiresIn };
          c.plan = prev.name; c.expiresIn = inv.plan.fromExpiresIn; c.offer = null;
          log('plan.changed', centerEntity(c), { before, after: { plan: c.plan, expiresIn: c.expiresIn }, reason: 'Откат: отсроченный счёт ' + inv.id + ' отменён · ' + String(reason).trim() });
          revertNote = ' Тариф возвращён на «' + prev.name + '».';
        }
        inv.status = 'cancelled'; inv.reason = (inv.reason ? inv.reason + ' · ' : '') + 'Отменён: ' + String(reason).trim();
        addEvent(inv, 'cancelled', ADMIN, 'Счёт отменён: ' + String(reason).trim() + '.' + revertNote);
        if (inv.kind === 'renewal') c.invoice = null;
        if (inv.kind === 'course') { const rq = db.courseRequests.find(r => r.invoiceId === inv.id); if (rq) { rq.status = 'new'; rq.invoiceId = null; } }   // счёт отменён: заявка снова ждёт решения
        log('invoice.cancelled', centerEntity(c), { before: { status: 'pending' }, after: { status: 'cancelled' }, reason: inv.id + ' · ' + String(reason).trim() });
        return invoiceDto(inv);
      })
    },
    cabinet: {
      ...cabinetCenter,
      // кабинет центра: центры с профилем (переключатель в eduhub.html)
      profileCenters: () => call(() => ({ items: db.centers.filter(c => db.profiles[c.id]).sort((a, b) => a.id - b.id).map(c => ({ id: c.id, name: c.name, city: c.city, owner: c.owner, plan: c.plan, status: c.status, direction: db.profiles[c.id].direction, logo: db.profiles[c.id].logo })) })),
      // профиль центра (CTR-PRF-010): карточка, показатели, лимиты, баланс на платформе, курсы. Флаги «у лимита» и статусы — отсюда, экран их не пересчитывает
      profile: centerId => call(() => {
        const c = findCenter(centerId), p = db.profiles[c.id];
        if (!p) throw new ApiError('NOT_FOUND', 'Профиль центра не заполнен');
        const nearPct = Math.round(NEAR_LIMIT * 100);
        return {
          center: centerDto(c),
          profile: { direction: p.direction, description: p.description, foundedYear: p.foundedYear, students: p.students, logo: p.logo, banner: p.banner,
            staffRoles: [['teacher', 'Преподаватели'], ['admin', 'Администраторы']].map(([key, label]) => ({ key, label, count: db.staff.filter(x => x.centerId === c.id && x.status === 'active' && x.role === key).length })) },
          usage: usageOf(c).map(u => ({ ...u, near: u.pct >= nearPct, full: u.used >= u.limit })),
          ledger: db.ledger.filter(e => e.centerId === c.id).sort((a, b) => new Date(b.at) - new Date(a.at) || b.id - a.id).slice(0, 5),
          courses: { items: db.courseAccess.filter(a => a.centerId === c.id && a.status === 'active').map(accessDto).sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt)), own: db.courses.filter(x => x.ownerCenterId === c.id).map(courseDto) }
        };
      }),
      // сотрудники центра (CTR-STF-010): число активных = staffUsed; добавление сверх лимита тарифа отклоняется (BR-023)
      staff: {
        list: (centerId, { role = '', q = '', page = 1, pageSize = 10 } = {}) => call(() => {
          const c = findCenter(centerId), all = db.staff.filter(s => s.centerId === c.id && s.status === 'active'), term = String(q).trim().toLowerCase();
          const items = all.filter(s => (!role || s.role === role) && (!term || s.name.toLowerCase().includes(term) || s.phone.includes(term)));
          const limit = rules.staffLimit(c), start = (page - 1) * pageSize;
          return { center: centerDto(c), items: items.slice(start, start + pageSize).map(staffDto), total: items.length, page, pageSize, roles: STAFF_ROLES,
            counts: Object.fromEntries(Object.keys(STAFF_ROLES).map(k => [k, all.filter(s => s.role === k).length])),
            meta: { used: c.staffUsed, limit, canAdd: c.status === 'active' && c.staffUsed < limit, nearLimit: c.staffUsed / limit >= NEAR_LIMIT, planName: c.plan } };
        }),
        add: (centerId, d = {}) => call(() => {
          const c = findCenter(centerId), e = {}, name = String(d.name || '').trim(), ph = digits(d.phone);
          if (name.length < 3 || name.length > 60) e.name = 'ФИО — от 3 до 60 символов';
          if (!STAFF_ROLES[d.role]) e.role = 'Выберите роль';
          if (ph.length < 9 || ph.length > 12) e.phone = 'Телефон — от 9 до 12 цифр';
          else if (db.staff.some(s => s.centerId === c.id && s.status === 'active' && digits(s.phone) === ph)) e.phone = 'Сотрудник с таким телефоном уже есть';
          const login = checkLogin(d.login, e);
          if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные сотрудника', e);
          if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: добавлять сотрудников нельзя');
          const limit = rules.staffLimit(c);
          if (c.staffUsed >= limit) throw new ApiError('CONFLICT', 'Лимит сотрудников тарифа «' + c.plan + '» исчерпан (' + limit + '). Чтобы добавить сотрудника, смените тариф или уволите кого-то из текущих');
          const s = { id: db.staffSeq++, centerId: c.id, name, role: d.role, phone: '+' + ph, status: 'active', hiredAt: new Date().toISOString(), dismissedAt: null };
          db.staff.push(s); c.staffUsed++;
          const credentials = issueCredentials('staff:' + s.id, login);
          log('staff.added', centerEntity(c), { after: { name, role: STAFF_ROLES[d.role], login, used: c.staffUsed + ' из ' + limit }, reason: 'Добавлен сотрудник: ' + name + ' (выданы данные для входа)', actor: centerActor(c) });
          return { ...staffDto(s), credentials };
        }),
        remove: (centerId, id, { reason = '' } = {}) => call(() => {
          const c = findCenter(centerId), s = db.staff.find(x => x.id === id && x.centerId === c.id && x.status === 'active');
          if (!s) throw new ApiError('NOT_FOUND', 'Сотрудник не найден');
          if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
          s.status = 'dismissed'; s.dismissedAt = new Date().toISOString(); c.staffUsed--; delete db.credentials['staff:' + s.id];   // доступ закрывается, логин освобождается
          log('staff.removed', centerEntity(c), { before: { name: s.name, role: STAFF_ROLES[s.role] }, after: { used: c.staffUsed + ' из ' + rules.staffLimit(c) }, reason: s.name + ' · ' + String(reason).trim(), actor: centerActor(c) });
          return staffDto(s);
        })
      },
      // счета центра: оплата онлайн (мок шлюза) только по своим счетам
      invoices: {
        payOnline: (centerId, id) => call(() => {
          const c = findCenter(centerId), inv = findInvoice(id);
          if (inv.centerId !== c.id) throw new ApiError('FORBIDDEN', 'Это счёт другого центра');
          return invoiceDto(payOnlineMock(inv));
        })
      },
      courses: {
        list: centerId => call(() => {
          const c = findCenter(centerId);
          return { center: centerDto(c), items: db.courseAccess.filter(a => a.centerId === c.id && a.status === 'active').map(accessDto).sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt)), own: db.courses.filter(x => x.ownerCenterId === c.id).map(courseDto) };
        }),
        // каталог платформы для центра: опубликованные курсы и статус по каждому — available | requested | invoiced | owned
        catalog: centerId => call(() => {
          const c = findCenter(centerId);
          return { center: centerDto(c), items: db.courses.filter(x => !x.ownerCenterId && x.status === 'published').map(x => { const rq = openRequest(c.id, x.id); return { ...courseDto(x), state: hasCourse(c.id, x.id) ? 'owned' : rq ? (rq.status === 'invoiced' ? 'invoiced' : 'requested') : 'available', requestId: rq ? rq.id : null }; }) };
        }),
        create: (centerId, d = {}) => call(() => {
          const c = findCenter(centerId), e = {}, t = String(d.title || '').trim();
          if (t.length < 3 || t.length > 80) e.title = 'Название — от 3 до 80 символов';
          else if (db.courses.some(x => x.ownerCenterId === c.id && x.title.toLowerCase() === t.toLowerCase())) e.title = 'У вас уже есть курс с таким названием';
          if (!COURSE_DIRECTIONS.includes(d.direction)) e.direction = 'Выберите направление';
          if (String(d.description || '').length > 600) e.description = 'Описание — не длиннее 600 символов';
          if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные курса', e);
          const x = { id: db.courseSeq++, title: t, direction: d.direction, lessons: 0, tests: 0, note: 'Собственный курс', status: 'private', price: 0, buyersOther: 0, ownerCenterId: c.id, description: String(d.description || '').trim() };
          db.courses.push(x); db.courseContent[x.id] = { modules: [] };
          return courseDto(x);
        })
      },
      requests: {
        list: centerId => call(() => { findCenter(centerId); return { items: db.courseRequests.filter(r => r.centerId === centerId).map(requestDto).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }; }),
        create: (centerId, { courseId, note = '' } = {}) => call(() => {
          const c = findCenter(centerId), course = findCourse(courseId);
          if (course.ownerCenterId || course.status !== 'published') throw new ApiError('CONFLICT', 'Этот курс нельзя заказать');
          if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: заявки недоступны');
          if (hasCourse(c.id, course.id)) throw new ApiError('CONFLICT', 'Курс «' + course.title + '» уже у вас');
          if (openRequest(c.id, course.id)) throw new ApiError('CONFLICT', 'Заявка на этот курс уже подана');
          if (String(note).length > 300) throw new ApiError('VALIDATION', 'Комментарий — не длиннее 300 символов', { note: 'Не длиннее 300 символов' });
          const r = { id: db.requestSeq++, centerId: c.id, courseId: course.id, status: 'new', note: String(note).trim(), createdAt: new Date().toISOString(), invoiceId: null, reason: '', decidedAt: null };
          db.courseRequests.unshift(r);
          log('course.requested', centerEntity(c), { after: { course: course.title }, reason: course.title + ' · заявка центра (режим поддержки)' });
          return requestDto(r);
        }),
        cancel: (centerId, id) => call(() => {
          const r = db.courseRequests.find(x => x.id === id && x.centerId === centerId); if (!r) throw new ApiError('NOT_FOUND', 'Заявка не найдена');
          if (r.status !== 'new') throw new ApiError('CONFLICT', 'Отменить можно только заявку, по которой ещё нет счёта');
          db.courseRequests.splice(db.courseRequests.indexOf(r), 1); return { ok: true };
        }),
        // оплата выставленного счёта владельцем центра по ссылке (МОК шлюза: на проде это webhook). Курс передаётся автоматически
        payOnline: (centerId, id) => call(() => {
          const r = db.courseRequests.find(x => x.id === id && x.centerId === centerId); if (!r) throw new ApiError('NOT_FOUND', 'Заявка не найдена');
          const inv = r.invoiceId && db.invoices.find(i => i.id === r.invoiceId); if (!inv || inv.status !== 'pending') throw new ApiError('CONFLICT', 'По заявке нет счёта, ожидающего оплаты');
          applyPaid(inv, { method: 'Онлайн (карта)', channel: 'online', reference: 'ONL-' + inv.id.slice(4), via: 'online', actor: SYSTEM, receivedAmount: inv.amount, receivedOn: todayIso(), txId: 'TX-' + inv.id.slice(4), cardMask: '•••• 4821' });
          return requestDto(r);
        })
      },
      branches: {
        list: centerId => call(() => {
          const c = findCenter(centerId), limit = planOf(c.plan).limits.branches;
          const items = db.moderation.filter(r => r.centerId === c.id).sort((a, b) => b.id - a.id).map(modDto);
          return { items, meta: { limit, used: items.filter(r => r.status === 'pending' || r.status === 'published').length, plan: c.plan }, cities: CITIES, center: { id: c.id, name: c.name, city: c.city, owner: c.owner, phone: c.phone, plan: c.plan } };
        }),
        geocode: ({ city, address }) => call(() => {
          if (String(address || '').trim().length < 5) throw new ApiError('VALIDATION', 'Введите адрес', { address: 'Укажите адрес (улица и дом)' });
          return { ...geocode(city, address), source: 'mock' };
        }),
        submit: (centerId, d = {}) => call(() => {
          const c = findCenter(centerId), e = validateBranch(d, c);
          if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные филиала', e);
          const r = { id: Math.max(0, ...db.moderation.map(x => x.id)) + 1, centerId: c.id, ...branchFields(d), submitted: nowLabel(), submittedAt: new Date().toISOString(), submittedBy: c.owner, status: 'pending', reason: '', gpsOk: false };
          db.moderation.push(r);
          log('branch.submitted', centerEntity(c), { after: { branch: r.branch, address: r.address }, reason: 'Заявка на публикацию в каталоге (режим поддержки)' });
          return modDto(r);
        }),
        resubmit: (centerId, id, d = {}) => call(() => {
          const c = findCenter(centerId), r = findMod(id);
          if (r.centerId !== c.id) throw new ApiError('NOT_FOUND', 'Заявка не найдена');
          if (r.status !== 'returned') throw new ApiError('CONFLICT', 'Исправлять можно только заявку, возвращённую на доработку');
          const e = validateBranch(d, c, r.id);
          if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные филиала', e);
          Object.assign(r, branchFields(d), { status: 'pending', reason: '', gpsOk: false, submitted: nowLabel(), submittedAt: new Date().toISOString() });
          log('branch.resubmitted', centerEntity(c), { after: { branch: r.branch }, reason: 'Исправленная заявка после доработки (режим поддержки)' });
          return modDto(r);
        })
      }
    },
    finance: {
      get: centerId => call(() => {
        const c = findCenter(centerId);
        return {
          center: centerDto(c),
          ledger: db.ledger.filter(e => e.centerId === c.id).sort((a, b) => new Date(b.at) - new Date(a.at) || b.id - a.id).slice(0, 15),
          invoices: db.invoices.filter(i => i.centerId === c.id && i.status === 'pending').map(invoiceDto)
        };
      }),
      // пополнение: деньги УЖЕ поступили вне системы (р/с, касса, перевод) — основания те же, что и при подтверждении оплаты счёта
      topUp: (centerId, d = {}) => call(() => {
        const c = findCenter(centerId);
        const { e, amount } = validateEvidence(d);
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные пополнения', e);
        const before = c.balance;
        c.balance += amount;
        ledgerAdd(c, { type: 'topup', amount, method: d.method, reference: String(d.reference).trim(), actor: ADMIN, comment: String(d.comment || '').trim() });
        log('balance.topup', centerEntity(c), { before: { balance: before }, after: { balance: c.balance }, reason: d.method + ' · ' + String(d.reference).trim() });
        return centerDto(c);
      }),
      setOverdraft: (centerId, { limit, reason = '' } = {}) => call(() => {
        const c = findCenter(centerId), e = {}, n = Number(limit);
        if (!Number.isInteger(n) || n < 0 || n > OVERDRAFT_MAX) e.limit = 'Лимит — целое число сомони от 0 до ' + OVERDRAFT_MAX;
        else if (n < Math.max(0, -c.balance)) e.limit = 'Центр уже использовал ' + (-c.balance) + ' сомони овердрафта: лимит не может быть ниже. Сначала пополните баланс';
        else if (n === c.overdraftLimit) e.limit = 'Лимит не изменился';
        if (String(reason).trim().length < 5) e.reason = 'Укажите причину (минимум 5 символов)';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные', e);
        const before = c.overdraftLimit;
        c.overdraftLimit = n;
        log('overdraft.changed', centerEntity(c), { before: { overdraftLimit: before }, after: { overdraftLimit: n }, reason: String(reason).trim() });
        return centerDto(c);
      })
    },
    audit: {
      // entityType: all | center | plan | course | sms-package; days: 0 (за всё время) | N последних дней; page/pageSize — постраничная выдача
      list: ({ q = '', action = 'all', entityType = 'all', days = 0, limit = 100, page = 1, pageSize = 0 } = {}) => call(() => {
        const term = q.trim().toLowerCase(), since = days ? Date.now() - days * 864e5 : 0;
        const all = db.audit.filter(e => (action === 'all' || e.action === action || e.action.startsWith(action + '.')) && (entityType === 'all' || e.entity.type === entityType) && (!since || new Date(e.at) >= since) &&
          (!term || (e.entity.name + ' ' + e.actor.name + ' ' + e.reason + ' ' + e.action).toLowerCase().includes(term)));
        return { items: pageSize ? all.slice((page - 1) * pageSize, page * pageSize) : all.slice(0, limit), total: all.length, allTotal: db.audit.length, page, pageSize, actions: [...new Set(db.audit.map(e => e.action))].sort() };
      })
    },
    support: {
      enter: ({ centerId }) => call(() => { const c = findCenter(centerId); log('support.entered', centerEntity(c), { reason: 'Вход в режим поддержки' }); return { ok: true }; })
    },
    globalId: {
      lookup: ({ phone }) => call(() => {
        const d = digits(phone).slice(-9);
        if (d.length < 9) throw new ApiError('VALIDATION', 'Введите номер полностью (9 цифр после кода страны)');
        return KNOWN_GLOBAL_IDS[d] ? { found: true, info: KNOWN_GLOBAL_IDS[d] } : { found: false };
      })
    },
    courses: {
      get: (id, ctx = {}) => call(() => {
        const c = courseFor(id, ctx), own = ctx.centerId && c.ownerCenterId === ctx.centerId;
        const access = ctx.centerId && !own ? db.courseAccess.find(a => a.centerId === ctx.centerId && a.courseId === c.id && a.status === 'active') : null;
        return { course: courseDto(c), content: clone(contentOf(c)), stats: courseStats(c), canEdit: ctx.centerId ? !!own : true, kind: ctx.centerId ? (own ? 'own' : 'purchased') : 'platform', access: access ? accessDto(access) : null };
      }),
      update: (id, d = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), e = {}, t = String(d.title || '').trim();
        if (t.length < 3 || t.length > 80) e.title = 'Название — от 3 до 80 символов';
        else if (db.courses.some(x => x.id !== c.id && x.ownerCenterId === c.ownerCenterId && x.title.toLowerCase() === t.toLowerCase())) e.title = 'Курс с таким названием уже есть';
        if (!COURSE_DIRECTIONS.includes(d.direction)) e.direction = 'Выберите направление';
        if (String(d.description || '').length > 600) e.description = 'Описание — не длиннее 600 символов';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные курса', e);
        const before = { title: c.title, direction: c.direction, description: c.description };
        Object.assign(c, { title: t, direction: d.direction, description: String(d.description || '').trim() });
        if (!ctx.centerId) log('course.updated', courseEntity(c), { before, after: { title: c.title, direction: c.direction, description: c.description }, reason: 'Изменены данные курса' });
        return courseDto(c);
      }),
      addModule: (id, { title = '' } = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), t = String(title).trim();
        if (t.length < 2 || t.length > 80) throw new ApiError('VALIDATION', 'Название модуля — от 2 до 80 символов', { title: 'От 2 до 80 символов' });
        const m = { id: db.cSeq++, title: t, lessons: [] }; contentOf(c).modules.push(m); courseLog(c, ctx, 'Добавлен модуль «' + t + '»'); return clone(m);
      }),
      renameModule: (id, moduleId, { title = '' } = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), m = contentOf(c).modules.find(x => x.id === moduleId); if (!m) throw new ApiError('NOT_FOUND', 'Модуль не найден');
        const t = String(title).trim(); if (t.length < 2 || t.length > 80) throw new ApiError('VALIDATION', 'Название модуля — от 2 до 80 символов', { title: 'От 2 до 80 символов' });
        courseLog(c, ctx, 'Модуль «' + m.title + '» переименован в «' + t + '»'); m.title = t; return clone(m);
      }),
      removeModule: (id, moduleId, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), cn = contentOf(c), i = cn.modules.findIndex(x => x.id === moduleId); if (i < 0) throw new ApiError('NOT_FOUND', 'Модуль не найден');
        const [m] = cn.modules.splice(i, 1); recount(c); courseLog(c, ctx, 'Удалён модуль «' + m.title + '» (уроков: ' + m.lessons.length + ')'); return courseDto(c);
      }),
      addLesson: (id, moduleId, { title = '' } = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), m = contentOf(c).modules.find(x => x.id === moduleId); if (!m) throw new ApiError('NOT_FOUND', 'Модуль не найден');
        const t = String(title).trim(); if (t.length < 2 || t.length > 100) throw new ApiError('VALIDATION', 'Название урока — от 2 до 100 символов', { title: 'От 2 до 100 символов' });
        m.lessons.push({ id: db.cSeq++, title: t, materials: [] }); recount(c); courseLog(c, ctx, 'Добавлен урок «' + t + '»'); return courseDto(c);
      }),
      renameLesson: (id, lessonId, { title = '' } = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), l = allLessons(c).find(x => x.id === lessonId); if (!l) throw new ApiError('NOT_FOUND', 'Урок не найден');
        const t = String(title).trim(); if (t.length < 2 || t.length > 100) throw new ApiError('VALIDATION', 'Название урока — от 2 до 100 символов', { title: 'От 2 до 100 символов' });
        l.title = t; return courseDto(c);
      }),
      removeLesson: (id, lessonId, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), m = contentOf(c).modules.find(x => x.lessons.some(l => l.id === lessonId)); if (!m) throw new ApiError('NOT_FOUND', 'Урок не найден');
        const i = m.lessons.findIndex(l => l.id === lessonId), [l] = m.lessons.splice(i, 1); recount(c); courseLog(c, ctx, 'Удалён урок «' + l.title + '»'); return courseDto(c);
      }),
      // type: plan (методический план) | video | pdf | slides (презентация) | test (тест, size = число вопросов). Файл загружается мок-образом: хранится только название и размер
      addMaterial: (id, lessonId, { type = '', name = '', questions = 10 } = {}, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), l = allLessons(c).find(x => x.id === lessonId); if (!l) throw new ApiError('NOT_FOUND', 'Урок не найден');
        const e = {}, n = String(name).trim();
        if (!['plan', 'video', 'pdf', 'slides', 'test'].includes(type)) e.type = 'Выберите тип материала';
        if (n.length < 2 || n.length > 100) e.name = 'Название — от 2 до 100 символов';
        if (type === 'test' && !(Number.isInteger(Number(questions)) && Number(questions) >= 1 && Number(questions) <= 100)) e.questions = 'Число вопросов — от 1 до 100';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные материала', e);
        l.materials.push({ id: db.cSeq++, type, name: n, size: type === 'test' ? Number(questions) + ' вопросов' : type === 'video' ? (10 + hash(db.cSeq) % 70) + ' МБ' : sizeLabel(db.cSeq) });
        recount(c); courseLog(c, ctx, 'Добавлен материал «' + n + '» в урок «' + l.title + '»'); return courseDto(c);
      }),
      removeMaterial: (id, materialId, ctx = {}) => call(() => {
        const c = courseFor(id, ctx, { write: true }), l = allLessons(c).find(x => x.materials.some(m => m.id === materialId)); if (!l) throw new ApiError('NOT_FOUND', 'Материал не найден');
        const i = l.materials.findIndex(m => m.id === materialId), [m] = l.materials.splice(i, 1); recount(c); courseLog(c, ctx, 'Удалён материал «' + m.name + '»'); return courseDto(c);
      })
    },
    sms: {
      packages: () => call(() => ({
        items: db.smsPackages.map(p => { const ss = db.smsSales.filter(x => x.packageId === p.id); return { ...p, sold: ss.length, centers: new Set(ss.map(x => x.centerId)).size }; }),
        meta: { total: db.smsSales.reduce((a, x) => a + x.remaining, 0), revenue: db.smsSales.reduce((a, x) => a + (x.status === 'paid' ? x.price : 0), 0), low: db.smsSales.filter(x => x.remaining / x.sms <= 0.1).length }
      })),
      // status: all | paid | bonus | low (остаток ≤ 10%); packageId: all | id пакета; page/pageSize — постраничная выдача
      sales: ({ q = '', status = 'all', packageId = 'all', page = 1, pageSize = 0 } = {}) => call(() => {
        const t = String(q).trim().toLowerCase();
        const all = db.smsSales.map(smsDto).filter(x => (!t || x.center.toLowerCase().includes(t) || x.id.toLowerCase().includes(t)) && (packageId === 'all' || x.packageId === packageId) && (status === 'all' || (status === 'low' ? x.low : x.status === status))).sort((a, b) => new Date(b.boughtAt) - new Date(a.boughtAt));
        return { items: pageSize ? all.slice((page - 1) * pageSize, page * pageSize) : all, total: all.length, allTotal: db.smsSales.length, page, pageSize, counts: { paid: db.smsSales.filter(x => x.status === 'paid').length, bonus: db.smsSales.filter(x => x.status === 'bonus').length, low: db.smsSales.filter(x => x.remaining / x.sms <= 0.1).length } };
      }),
      // mode: balance — списать с баланса на платформе; manual — деньги поступили вне системы (основание обязательно); bonus — бесплатно, по причине
      accrue: ({ centerId, packageId, mode, ...d } = {}) => call(() => {
        const c = findCenter(centerId), pk = db.smsPackages.find(x => x.id === packageId && x.active), e = {};
        if (!pk) throw new ApiError('VALIDATION', 'Выберите пакет', { packageId: 'Выберите пакет' });
        if (c.status !== 'active') throw new ApiError('CONFLICT', 'Центр заблокирован: начисление пакета недоступно');
        if (!['balance', 'manual', 'bonus'].includes(mode)) throw new ApiError('VALIDATION', 'Выберите способ оплаты', { mode: 'Выберите способ оплаты' });
        let sale = { id: 'SMS-' + (++db.smsSeq), centerId: c.id, packageId: pk.id, sms: pk.sms, remaining: pk.sms, price: pk.price, boughtAt: new Date().toISOString(), status: 'paid', method: '', reference: '', actor: ADMIN, reason: '' };
        if (mode === 'balance') {
          if (c.balance + c.overdraftLimit < pk.price) throw new ApiError('VALIDATION', 'Недостаточно средств на балансе на платформе (доступно ' + (c.balance + c.overdraftLimit) + ' сомони, нужно ' + pk.price + ')', { mode: 'Не хватает баланса на платформе' });
          const before = c.balance; c.balance -= pk.price;
          sale.method = 'Списание с баланса на платформе'; sale.reference = 'SMS-пакет ' + pk.sms;
          ledgerAdd(c, { type: 'charge', amount: -pk.price, method: sale.method, reference: sale.reference + ' (' + sale.id + ')', actor: ADMIN });
          log('balance.charge', centerEntity(c), { before: { balance: before }, after: { balance: c.balance }, reason: 'SMS-пакет ' + pk.sms + ' · ' + sale.id });
        } else if (mode === 'manual') {
          const v = validateEvidence({ ...d, receivedAmount: d.receivedAmount }, { expected: pk.price });
          if (Object.keys(v.e).length) throw new ApiError('VALIDATION', 'Проверьте данные оплаты', v.e);
          sale.method = d.method; sale.reference = String(d.reference).trim();
        } else {
          if (String(d.reason || '').trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
          sale.status = 'bonus'; sale.price = 0; sale.method = 'Бесплатное начисление'; sale.reference = String(d.reason).trim(); sale.reason = sale.reference;
        }
        db.smsSales.unshift(sale);
        log('sms.accrued', centerEntity(c), { after: { sale: sale.id, sms: pk.sms, status: sale.status }, reason: pk.sms + ' SMS · ' + sale.method + (sale.status === 'bonus' ? ' · ' + sale.reason : ' · ' + sale.reference) });
        return smsDto(sale);
      }),
      updatePackage: (id, { price, description = '', reason = '' } = {}) => call(() => {
        const pk = db.smsPackages.find(x => x.id === id); if (!pk) throw new ApiError('NOT_FOUND', 'Пакет не найден');
        const e = {}, n = Number(price);
        if (!Number.isInteger(n) || n < 1 || n > 100000) e.price = 'Цена — целое число сомони от 1 до 100 000';
        if (String(description).trim().length < 5 || String(description).trim().length > 80) e.description = 'Описание — от 5 до 80 символов';
        if (String(reason).trim().length < 5) e.reason = 'Укажите причину (минимум 5 символов)';
        if (!Object.keys(e).length && n === pk.price && String(description).trim() === pk.description) e.price = 'Ничего не изменилось';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные пакета', e);
        const before = { price: pk.price, description: pk.description };
        pk.price = n; pk.description = String(description).trim();
        log('sms.package.updated', { type: 'sms-package', id: pk.id, name: 'Пакет ' + pk.sms + ' SMS' }, { before, after: { price: pk.price, description: pk.description }, reason: String(reason).trim() });
        return clone(pk);
      })
    },
    marketplace: {
      directions: COURSE_DIRECTIONS,
      // status: all | published | draft; page/pageSize — постраничная выдача карточек
      list: ({ q = '', direction = 'all', status = 'all', page = 1, pageSize = 0 } = {}) => call(() => {
        const t = String(q).trim().toLowerCase();
        const all = db.courses.filter(c => !c.ownerCenterId && (direction === 'all' || c.direction === direction) && (status === 'all' || c.status === status) && (!t || c.title.toLowerCase().includes(t))).map(courseDto);
        const items = pageSize ? all.slice((page - 1) * pageSize, page * pageSize) : all;
        return { items, total: all.length, allTotal: db.courses.filter(c => !c.ownerCenterId).length, page, pageSize, directions: COURSE_DIRECTIONS, meta: { published: db.courses.filter(c => !c.ownerCenterId && c.status === 'published').length, draft: db.courses.filter(c => !c.ownerCenterId && c.status === 'draft').length, buyers: db.courses.filter(c => !c.ownerCenterId).reduce((a, c) => a + buyersOf(c), 0), revenue: db.courses.filter(c => !c.ownerCenterId).reduce((a, c) => a + buyersOf(c) * c.price, 0), requests: db.courseRequests.filter(r => r.status === 'new').length } };
      }),
      create: ({ title = '', direction = '', price = 0 } = {}) => call(() => {
        const e = {}, t = String(title).trim(), n = Number(price);
        if (t.length < 3 || t.length > 80) e.title = 'Название — от 3 до 80 символов';
        else if (db.courses.some(c => c.title.toLowerCase() === t.toLowerCase())) e.title = 'Курс с таким названием уже есть';
        if (!COURSE_DIRECTIONS.includes(direction)) e.direction = 'Выберите направление';
        if (!Number.isInteger(n) || n < 0 || n > 100000) e.price = 'Цена — целое число сомони от 0 до 100 000';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные курса', e);
        const c = { id: db.courseSeq++, title: t, direction, lessons: 0, tests: 0, note: 'Черновик', status: 'draft', price: n, buyersOther: 0, ownerCenterId: null, description: '' };
        db.courses.push(c); db.courseContent[c.id] = { modules: [] };
        log('course.created', courseEntity(c), { after: { status: 'draft', direction, price: n }, reason: 'Создан черновик курса' });
        return courseDto(c);
      }),
      setPrice: (id, { price, reason = '' } = {}) => call(() => {
        const c = findCourse(id), e = {}, n = Number(price);
        if (!Number.isInteger(n) || n < 1 || n > 100000) e.price = 'Цена — целое число сомони от 1 до 100 000';
        else if (n === c.price) e.price = 'Цена не изменилась';
        if (String(reason).trim().length < 5) e.reason = 'Укажите причину (минимум 5 символов)';
        if (Object.keys(e).length) throw new ApiError('VALIDATION', 'Проверьте данные', e);
        const before = c.price; c.price = n;
        log('course.price', courseEntity(c), { before: { price: before }, after: { price: n }, reason: String(reason).trim() });
        return courseDto(c);
      }),
      // mode: invoice — выставить счёт (доступ после оплаты); balance — выставить и сразу списать с баланса на платформе; bonus — бесплатно, по причине
      sell: ({ centerId, courseId, mode, reason = '' } = {}) => call(() => sellCourse(centerId, courseId, mode, reason)),
      requests: {
        list: ({ status = 'all', courseId = 0, page = 1, pageSize = 0 } = {}) => call(() => {
          const all = db.courseRequests.filter(r => (status === 'all' || r.status === status) && (!courseId || r.courseId === courseId)).map(requestDto).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const cnt = k => db.courseRequests.filter(r => r.status === k && (!courseId || r.courseId === courseId)).length;
          return { items: pageSize ? all.slice((page - 1) * pageSize, page * pageSize) : all, total: all.length, page, pageSize, counts: { new: cnt('new'), invoiced: cnt('invoiced'), fulfilled: cnt('fulfilled'), rejected: cnt('rejected') } };
        }),
        // action: invoice — выставить счёт; balance — списать с баланса; bonus — передать бесплатно (reason); reject — отклонить (reason)
        process: (id, { action, reason = '' } = {}) => call(() => {
          const r = db.courseRequests.find(x => x.id === id); if (!r) throw new ApiError('NOT_FOUND', 'Заявка не найдена');
          if (r.status !== 'new') throw new ApiError('CONFLICT', r.status === 'invoiced' ? 'По заявке уже выставлен счёт ' + r.invoiceId : 'Заявка уже обработана');
          const c = findCenter(r.centerId), course = findCourse(r.courseId);
          if (action === 'reject') {
            if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
            r.status = 'rejected'; r.reason = String(reason).trim(); r.decidedAt = new Date().toISOString();
            log('course.request.rejected', centerEntity(c), { after: { course: course.title }, reason: course.title + ' · ' + r.reason });
            return requestDto(r);
          }
          if (!['invoice', 'balance', 'bonus'].includes(action)) throw new ApiError('VALIDATION', 'Неизвестное действие');
          const res = sellCourse(r.centerId, r.courseId, action, reason);
          if (action === 'invoice') { r.status = 'invoiced'; r.invoiceId = res.invoice.id; } else { r.status = 'fulfilled'; r.decidedAt = new Date().toISOString(); if (res.invoice) r.invoiceId = res.invoice.id; }
          return requestDto(r);
        })
      },
      buyers: courseId => call(() => {
        const course = findCourse(courseId), items = db.courseAccess.filter(a => a.courseId === courseId).map(accessDto).sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));
        return { course: courseDto(course), items, other: course.buyersOther || 0 };
      }),
      revoke: (accessId, { reason = '' } = {}) => call(() => {
        const a = db.courseAccess.find(x => x.id === accessId); if (!a) throw new ApiError('NOT_FOUND', 'Доступ не найден');
        if (a.status !== 'active') throw new ApiError('CONFLICT', 'Доступ уже отозван');
        if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
        a.status = 'revoked'; a.revokedAt = new Date().toISOString(); a.revokeReason = String(reason).trim();
        const c = findCenter(a.centerId), course = findCourse(a.courseId);
        log('course.revoked', centerEntity(c), { before: { status: 'active' }, after: { status: 'revoked' }, reason: course.title + ' · ' + a.revokeReason });
        return accessDto(a);
      }),
      publish: id => call(() => {
        const c = findCourse(id);
        if (c.status === 'published') throw new ApiError('CONFLICT', 'Курс уже опубликован');
        const b = courseBlockers(c);
        if (b.length) throw new ApiError('VALIDATION', 'Нельзя опубликовать: ' + b.join('; '));
        c.status = 'published';
        log('course.published', courseEntity(c), { before: { status: 'draft' }, after: { status: 'published' }, reason: 'Курс доступен центрам для покупки' });
        return courseDto(c);
      }),
      unpublish: (id, { reason = '' } = {}) => call(() => {
        const c = findCourse(id);
        if (c.status !== 'published') throw new ApiError('CONFLICT', 'Курс не опубликован');
        if (String(reason).trim().length < 5) throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)', { reason: 'Минимум 5 символов' });
        c.status = 'draft';
        log('course.unpublished', courseEntity(c), { before: { status: 'published' }, after: { status: 'draft' }, reason: String(reason).trim() + (buyersOf(c) ? ' · уже купили ' + buyersOf(c) + ' центров, доступ у них сохраняется' : '') });
        return courseDto(c);
      })
    },
    moderation: {
      list: ({ status } = {}) => call(() => ({
        items: db.moderation.filter(r => !status || (status === 'pending' ? r.status === 'pending' : r.status !== 'pending')).map(modDto),
        meta: { pending: db.moderation.filter(r => r.status === 'pending').length, processed: db.moderation.filter(r => r.status !== 'pending').length }
      })),
      decide: (id, { decision, reason = '', desc, gps, gpsConfirmed }) => call(() => {
        const r = findMod(id);
        if (r.status !== 'pending') throw new ApiError('CONFLICT', 'Заявка уже обработана');
        if (!['published', 'returned', 'rejected'].includes(decision)) throw new ApiError('VALIDATION', 'Неизвестное решение');
        if (desc) r.desc = { ru: desc.ru || '', tj: desc.tj || '', en: desc.en || '' };
        if (gps) r.gps = { lat: Number(gps.lat), lng: Number(gps.lng) };
        r.gpsOk = !!gpsConfirmed;
        if (decision === 'published') {
          const b = rules.publishBlockers(r);
          if (b.length) throw new ApiError('VALIDATION', 'Нельзя опубликовать: ' + b.join('; '));
        } else if (String(reason).trim().length < 5) {
          throw new ApiError('VALIDATION', 'Укажите причину (минимум 5 символов)');
        }
        r.status = decision; r.reason = decision === 'published' ? '' : String(reason).trim(); r.decidedAt = new Date().toISOString();
        log('moderation.' + decision, centerEntity(findCenter(r.centerId)), { after: { branch: r.branch, status: decision }, reason: r.branch + (r.reason ? ' · ' + r.reason : '') });
        return modDto(r);
      }),
      requeue: id => call(() => {
        const r = findMod(id); r.status = 'pending'; r.reason = ''; r.gpsOk = false;
        return modDto(r);
      })
    }
  };
})();
