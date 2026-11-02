import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {loadConfig,verifyPassword,signSession,readSession,csrfFor,dayKey} from '../../server/learn/auth.js';
import {createLearnAPI} from '../../server/learn/api.js';
import {streaks,readProgress,writeProgress} from '../../learn/progress.js';
const env={SESSION_SECRET:'test-only-secret-32-characters-long!!',APP_ORIGIN:'http://127.0.0.1:3047',ADMIN_USERNAME:'teacher',ADMIN_PASSWORD:'test-admin-password',STUDENT_USERNAME:'learner',STUDENT_PASSWORD:'test-student-password',STUDENT_NAME:'Test Learner',COURSE_PUBLIC:'false'};
const config=loadConfig(env);

test('credentials are checked on the server; username duplicates fail closed',()=>{
 assert.equal(verifyPassword(config.users[1],'test-student-password',config.secret),true);
 assert.equal(verifyPassword(config.users[1],'wrong-password',config.secret),false);
 assert.equal(verifyPassword(undefined,'test-student-password',config.secret),false);
 assert.throws(()=>loadConfig({...env,STUDENTS_JSON:'[{"username":"LEARNER","password":"another-long-password"}]'}),/unique/);
 assert.throws(()=>loadConfig({...env,SESSION_SECRET:'short'}),/32/);
 assert.throws(()=>loadConfig({...env,VERCEL:'1'}),/HTTPS/);
});
test('signed sessions reject tampering, expiry, removed users and password changes',()=>{
 const token=signSession(config.users[1],config,1000);
 assert.equal(readSession(token,config,1001).username,'learner');
 const [payload,sig]=token.split('.');
 const tampered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url')),sub:'teacher'})).toString('base64url');
 assert.equal(readSession(tampered+'.'+sig,config,1001),null);
 assert.equal(readSession(token,config,1000+8*60*60*1000),null);
 assert.equal(readSession(token,{...config,users:[config.users[0]]},1001),null);
 assert.equal(readSession(token,loadConfig({...env,STUDENT_PASSWORD:'new-student-password'}),1001),null);
 assert.notEqual(csrfFor(token,config),csrfFor(signSession(config.users[1],config),config));
});
test('streaks deduplicate days, tolerate today being unfinished, and reset after a gap',()=>{
 assert.deepEqual(streaks(['2026-10-30','2026-10-31','2026-11-01','2026-11-01'],'2026-11-02'),{current:3,best:3,days:['2026-10-30','2026-10-31','2026-11-01']});
 assert.equal(streaks(['2026-10-30','2026-10-31'],'2026-11-02').current,0);
 assert.equal(streaks(['2026-11-02','2026-11-03'],'2026-11-02').current,1);
 assert.equal(streaks(['2026-12-31','2027-01-01'],'2027-01-01').current,2);
 assert.equal(streaks([],'2026-11-02').best,0);
 assert.equal(dayKey(new Date('2026-11-02T18:29:59Z')),'2026-11-02');
 assert.equal(dayKey(new Date('2026-11-02T18:30:00Z')),'2026-11-03');
});
test('browser progress remains separate for each username and survives reload',()=>{
 const values=new Map();const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 const p={days:['2026-11-02'],completed:true,note:'Example reflection',lastSaved:null};
 writeProgress('alice',p,storage);
 assert.deepEqual(readProgress('alice',storage),p);
 assert.equal(readProgress('bob',storage).completed,false);
 assert.equal(readProgress('bob',storage).note,'');
});
test('API integration: authentication, roles, CSRF, quiz, reflection, downloads and logout',async t=>{
 const app=express();app.use('/api/learn',express.json(),createLearnAPI(config,env));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/learn`;
 const request=(path,body,headers={})=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:config.origin,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal((await request('/lesson')).status,401);
 assert.equal((await request('/lab')).status,401);
 assert.equal((await request('/login',{username:'learner',password:'incorrect'})).status,401);
 assert.equal((await request('/login',{username:'learner',password:env.STUDENT_PASSWORD},{Origin:'https://other.example'})).status,403);
 let r=await request('/login',{username:'Learner',password:env.STUDENT_PASSWORD});assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const login=await r.json();assert.equal(login.user.role,'student');assert.equal(login.user.password,undefined);
 const h={Cookie:cookie.split(';')[0],'x-learn-csrf':login.csrf};
 assert.equal((await request('/admin',undefined,h)).status,403);
 r=await request('/lesson',undefined,h);assert.equal(r.status,200);const lesson=await r.json();assert.match(lesson.html,/Training and inference/);assert.match(lesson.html,/<details>/);assert.equal(lesson.quiz[0].answer,undefined);
 r=await request('/lab',undefined,h);assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/day-01-lab.py/);
 assert.equal((await request('/quiz',{answers:[1,2,0]},{Cookie:h.Cookie})).status,403);
 assert.equal((await request('/quiz',{answers:[1]},h)).status,400);
 const failed=await (await request('/quiz',{answers:[0,0,0]},h)).json();assert.equal(failed.passed,false);
 const passed=await (await request('/quiz',{answers:[1,2,0]},h)).json();assert.equal(passed.passed,true);assert.equal(passed.score,3);
 assert.equal((await request('/reflection',{note:'too short'},h)).status,400);
 assert.equal((await request('/reflection',{note:'A successful HTTP request does not prove that the answer is correct.'},h)).status,200);
 r=await request('/logout',{},h);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 r=await request('/login',{username:'teacher',password:env.ADMIN_PASSWORD});const adminCookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/admin',undefined,{Cookie:adminCookie});const roster=await r.json();assert.equal(roster.users.length,2);assert.ok(roster.users.every(u=>!u.password && !u.passwordHash));
});
test('unpublished lessons are inaccessible to students, but previewable by instructors',async t=>{
 const app=express();app.use('/api/learn',express.json(),createLearnAPI({...config,published:false}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 for(const user of config.users){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/learn/lesson`,{headers:{Cookie:'chandan_learn='+signSession(user,config)}});assert.equal(r.status,user.role==='admin'?200:403);}
});

test('setup errors identify the setting without exposing credential values',async t=>{
 const cases=[
  [{...env,SESSION_SECRET:''},'SESSION_SECRET'],
  [{...env,ADMIN_PASSWORD:''},'ADMIN_USERNAME and ADMIN_PASSWORD'],
  [{...env,ADMIN_PASSWORD:'private-x'},'ADMIN_PASSWORD'],
  [{...env,STUDENTS_JSON:'private-malformed-json'},'STUDENTS_JSON'],
  [{...env,APP_ORIGIN:'private-invalid-origin'},'APP_ORIGIN']
 ];
 for(const [settings,expected] of cases){
  const app=express();app.use('/api/learn',createLearnAPI(undefined,settings));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/learn/me`);assert.equal(response.status,503);const data=await response.json();assert.ok(data.error.includes(expected));assert.ok(!data.error.includes('private-'));}
  finally{server.close();}
 }
});

test('MongoDB accounts bypass credential env vars, hash passwords and enforce account roles',async t=>{
 const {buildUser}=await import('../../server/learn/mongo-users.js');
 const settings={COURSE_PUBLIC:'false',SESSION_SECRET:env.SESSION_SECRET,APP_ORIGIN:env.APP_ORIGIN,MONGODB_URI:'mongodb://127.0.0.1:27017'};
 const mongoConfig=loadConfig(settings);assert.equal(mongoConfig.accountStorage,'mongodb');
 const teacher=buildUser({username:'instructor',name:'Instructor',password:'test-teacher-password',role:'admin'});
 const learner=buildUser({username:'sravan',name:'Sravan',password:'test-sravan-password'});
 assert.equal(learner.password,undefined);assert.notEqual(learner.passwordHash,learner.password);
 const documents=[teacher,learner];
 const store={find:async username=>{const u=documents.find(u=>u.username===username && u.active);return u?{...u,salt:Buffer.from(u.salt,'hex')}:null;},list:async()=>documents,create:async data=>{const u=buildUser(data);if(documents.some(x=>x.username===u.username)){const e=new Error();e.code=11000;throw e;}documents.push(u);return u;}};
 const app=express();app.use('/api/learn',express.json(),createLearnAPI(mongoConfig,settings,store));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/learn`;
 const call=(path,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{Origin:settings.APP_ORIGIN,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const signin=async(username,password)=>{const r=await call('/login',{username,password});assert.equal(r.status,200);return {Cookie:r.headers.get('set-cookie').split(';')[0],'x-learn-csrf':(await r.json()).csrf};};
 const h=await signin('instructor','test-teacher-password');
 const newStudent={username:'meera',name:'Meera',password:'test-meera-password',role:'admin'};
 assert.equal((await call('/admin/users',newStudent,h)).status,201);
 assert.equal(documents.find(u=>u.username==='meera').role,'student');
 assert.equal((await call('/admin/users',newStudent,h)).status,409);
 const sh=await signin('sravan','test-sravan-password');
 assert.equal((await call('/admin/users',newStudent,sh)).status,403);
 learner.active=false;assert.equal((await call('/me',undefined,sh)).status,401);
 learner.active=true;learner.version='0'.repeat(64);assert.equal((await call('/me',undefined,sh)).status,401);
});

test('account creation explains validation and database failures without leaking secrets',async()=>{
 const {buildUser,accountCreationError}=await import('../../server/learn/mongo-users.js');
 try{buildUser({username:'sravan',name:'Sravan',role:'student',password:'short'});assert.fail('Expected password validation');}catch(err){assert.match(accountCreationError(err),/12–256/);}
 for(const [code,message] of [[11000,/already exists/],[18,/authentication failed/],[13,/permission/],[121,/schema/]])assert.match(accountCreationError({code,message:'private-secret'}),message);
 assert.match(accountCreationError({name:'MongoServerError',code:8000,message:'bad auth : authentication failed'}),/MongoDB authentication failed/);
 assert.ok(!accountCreationError({name:'MongoServerError',code:8000,message:'unrelated failure'}).includes('authentication failed'));
 assert.match(accountCreationError({name:'MongoServerSelectionError',message:'private-secret'}),/Network Access/);
 assert.ok(!accountCreationError(new Error('private-secret')).includes('private-secret'));
});

test('public lessons work without credentials or database access while admin endpoints stay protected',async t=>{
 const app=express();app.use('/api/learn',express.json(),createLearnAPI(undefined,{COURSE_PUBLIC:'true'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/learn`;
 const metadata=await (await fetch(base+'/access')).json();assert.equal(metadata.publicAccess,true);
 assert.equal((await fetch(base+'/lesson')).status,200);assert.equal((await fetch(base+'/lab')).status,200);
 const result=await fetch(base+'/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:[1,2,0]})});assert.equal((await result.json()).passed,true);
 assert.equal((await fetch(base+'/reflection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:'My reflection explains why correct transport does not guarantee a correct answer.'})})).status,200);
 assert.equal((await fetch(base+'/admin')).status,503);
 const authenticated=express();authenticated.use('/api/learn',express.json(),createLearnAPI(config,{COURSE_PUBLIC:'true'}));
 const protectedServer=authenticated.listen(0,'127.0.0.1');await new Promise(r=>protectedServer.once('listening',r));t.after(()=>protectedServer.close());
 assert.equal((await fetch(`http://127.0.0.1:${protectedServer.address().port}/api/learn/admin`)).status,401);
});
