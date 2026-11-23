// Регрессионный набор входа (login.html): логин и пароль, блокировка подбора, смена временного пароля, выдача и сброс доступа.
(async function(){
 const R=[]; const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
 const out=()=>{ let d=document.getElementById('TESTOUT'); if(!d){d=document.createElement('pre'); d.id='TESTOUT'; document.body.appendChild(d);} d.textContent=R.join('\n'); };
 const rejects=async(p,code)=>{ try{ await p; return false; }catch(e){ return e instanceof ApiError && e.code===code ? e : false; } };
 try{
 await sleep(300);
 apiConfig.latencyMs=0;
 // центр с владельцем, сотрудниками и учеником, у каждого свой логин
 const nc=await api.centers.create({name:'Центр Для Входа',city:'Душанбе',address:'ул. Рудаки, 5',phone:'+992 90 700 00 00',ownerName:'Владелец Входа',ownerPhone:'+992 90 700 00 01',terms:true});
 const cid=nc.id, own=nc.credentials;
 const adm=await api.cabinet.staff.add(cid,{name:'Админ Входа',role:'admin',phone:'+992 90 700 00 02',login:'admin.vhod'});
 const tch=await api.cabinet.staff.add(cid,{name:'Учитель Входа',role:'teacher',phone:'+992 90 700 00 03',login:'teacher.vhod'});
 const stu=await api.cabinet.users.add(cid,{name:'Ученик Входа',phone:'+992 90 700 00 04',login:'student.vhod'});

 // ---- api: вход ----
 const u=await api.auth.login({login:own.login,password:own.password});
 ok('login: owner gets the cabinet and must change the temporary password', u.role==='center_admin' && u.cabinet===true && u.mustChange===true && u.centerId===cid && u.name==='Владелец Входа');
 ok('login: login is case-insensitive and trimmed', (await api.auth.login({login:'  ADMIN.Vhod ',password:adm.credentials.password})).role==='admin');
 const bad1=await rejects(api.auth.login({login:own.login,password:'wrong'}),'UNAUTHORIZED'), bad2=await rejects(api.auth.login({login:'net.takogo',password:'wrong'}),'UNAUTHORIZED');
 ok('login: wrong password and unknown login give the same message', !!bad1 && !!bad2 && bad1.message===bad2.message);
 ok('login: teacher and student have no web cabinet', (await api.auth.login({login:'teacher.vhod',password:tch.credentials.password})).cabinet===false && (await api.auth.login({login:'student.vhod',password:stu.credentials.password})).role==='student');
 for(let i=0;i<5;i++) await rejects(api.auth.login({login:'admin.vhod',password:'bad'+i}),'UNAUTHORIZED');
 ok('login: five failures lock the account even for the right password', !!(await rejects(api.auth.login({login:'admin.vhod',password:adm.credentials.password}),'LOCKED')));
 // ---- смена пароля ----
 ok('password change: weak and unchanged passwords rejected', !!(await rejects(api.auth.changePassword({login:own.login,password:own.password,newPassword:'abc'}),'VALIDATION')) && !!(await rejects(api.auth.changePassword({login:own.login,password:own.password,newPassword:own.password}),'VALIDATION')));
 const ch=await api.auth.changePassword({login:own.login,password:own.password,newPassword:'Novyj2026pw'});
 ok('password change: no longer temporary, old password dead, new one works', ch.mustChange===false && !!(await rejects(api.auth.login({login:own.login,password:own.password}),'UNAUTHORIZED')) && (await api.auth.login({login:own.login,password:'Novyj2026pw'})).mustChange===false);
 const aud=await api.audit.list({q:'Центр Для Входа'});
 ok('audit: password change is logged, no password in any entry', aud.items.some(e=>e.action==='auth.password_changed') && !JSON.stringify(aud.items).includes('Novyj2026pw') && !JSON.stringify(aud.items).includes(own.password));
 // ---- закрытие доступа ----
 await api.cabinet.users.setStatus(cid,stu.id,{status:'blocked',reason:'Долгое отсутствие'});
 ok('blocked student cannot log in', !!(await rejects(api.auth.login({login:'student.vhod',password:stu.credentials.password}),'FORBIDDEN')));
 await api.cabinet.staff.remove(cid,tch.id,{reason:'Перешёл в другой центр'});
 ok('dismissed staff member cannot log in and the login is free again', !!(await rejects(api.auth.login({login:'teacher.vhod',password:tch.credentials.password}),'UNAUTHORIZED')) && !!(await api.cabinet.users.add(cid,{name:'Новый Ученик',phone:'+992 90 700 00 05',login:'teacher.vhod'})));
 // ---- выдача и сброс доступа ----
 const seedT=(await api.cabinet.staff.list(9,{role:'teacher'})).items[0];
 ok('staff list marks who has access', seedT.hasAccess===false && (await api.cabinet.staff.list(cid)).items.find(s=>s.login===undefined && s.name==='Админ Входа').hasAccess===true);
 ok('access issue: reason and login required for a person without access', Object.keys((await rejects(api.cabinet.access.reset(9,{kind:'staff',id:seedT.id}),'VALIDATION')).fields).sort().join()==='login,reason');
 const iss=await api.cabinet.access.reset(9,{kind:'staff',id:seedT.id,login:'seed.teacher9',reason:'Первый вход в систему'});
 ok('access issue: login works with the new password', iss.hadAccess===false && (await api.auth.login({login:'seed.teacher9',password:iss.password})).role==='teacher');
 const rst=await api.cabinet.access.reset(9,{kind:'staff',id:seedT.id,reason:'Пароль потерян'});
 ok('access reset: same login, new password, old one dead, temporary again', rst.hadAccess===true && rst.login==='seed.teacher9' && rst.password!==iss.password && !!(await rejects(api.auth.login({login:'seed.teacher9',password:iss.password}),'UNAUTHORIZED')) && (await api.auth.login({login:'seed.teacher9',password:rst.password})).mustChange===true);
 ok('access reset: other center cannot touch the person, audit has the entry', !!(await rejects(api.cabinet.access.reset(1,{kind:'staff',id:seedT.id,login:'hack.try',reason:'Чужой сотрудник'}),'NOT_FOUND')) && (await api.audit.list({q:'Math Lab'})).items.some(e=>e.action==='access.reset'));
 const aa=await api.centers.adminAccess(9,{reason:'Владелец потерял пароль'});
 ok('platform: admin access for a seeded center works and needs a reason', /^\d{9,12}$/.test(aa.login) && (await api.auth.login({login:aa.login,password:aa.password})).role==='center_admin' && !!(await rejects(api.centers.adminAccess(9,{reason:'x'}),'VALIDATION')));
 const db9=await api.cabinet.dashboard(9);
 ok('dashboard: three upcoming lessons in time order', db9.upcoming.length===3 && db9.upcoming.every((l,i,a)=>i===0||a[i-1].inMin<=l.inMin) && db9.upcoming.every(l=>l.when && l.start));

 // ---- UI: страница входа (учитель: после входа остаётся на странице) ----
 const fire=async(login,pw)=>{ document.getElementById('login').value=login; document.getElementById('password').value=pw; await lgSubmit({preventDefault(){}}); await sleep(80); };
 lgLogout(); await sleep(30);
 ok('login page: form with login and password', !!document.getElementById('login') && !!document.getElementById('password'));
 await fire('seed.teacher9','nepravilno');
 ok('login page: wrong password shows one error, password field cleared', document.getElementById('loginRoot').innerText.includes('Неверный логин или пароль') && document.getElementById('password').value==='');
 await fire('seed.teacher9',rst.password);
 ok('login page: temporary password leads to the change step', !!document.getElementById('newPassword'));
 document.getElementById('newPassword').value='Abc12345x'; document.getElementById('repeat').value='Other12345'; await lgChange({preventDefault(){}}); await sleep(50);
 ok('change step: mismatching repeat is reported under the field', document.getElementById('loginRoot').innerText.includes('Пароли не совпадают'));
 document.getElementById('newPassword').value='short'; document.getElementById('repeat').value='short'; await lgChange({preventDefault(){}}); await sleep(80);
 ok('change step: weak password reported by the server under the field', document.getElementById('loginRoot').innerText.includes('Не короче 8'));
 document.getElementById('newPassword').value='Abc12345x'; document.getElementById('repeat').value='Abc12345x'; await lgChange({preventDefault(){}}); await sleep(120);
 ok('after the change a teacher sees the mobile-app note and the session is stored', document.getElementById('loginRoot').innerText.includes('мобильном приложении') && JSON.parse(sessionStorage.getItem('liniya.session')).role==='teacher');
 lgLogout(); await sleep(30);
 ok('logout clears the session and returns to the form', sessionStorage.getItem('liniya.session')===null && !!document.getElementById('login'));
 }catch(e){ R.push('EXC '+e.message+' | '+(e.stack||'').split('\n')[1]); }
 out();
})();
