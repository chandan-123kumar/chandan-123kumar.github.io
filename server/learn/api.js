import {createMongoUserStore,buildUser} from './mongo-users.js';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
import sanitizeHtml from 'sanitize-html';
import {ConfigurationError,loadConfig,publicUser,verifyPassword,signSession,readSession,sessionData,csrfFor,parseCookie,setSessionCookie,dayKey} from './auth.js';

const contentURL=new URL('../../content/learn/',import.meta.url);
const QUIZ=[
  {question:'The inference request returned HTTP 200. What have you established?',options:['The answer is factually correct.','The request succeeded; answer quality still needs review.','The model has learned from this request.'],answer:1,explanation:'Transport success and answer quality are separate checks.'},
  {question:'The only source is an expired policy. What should the application do?',options:['Treat it as the latest policy.','Guess the current answer from the model’s memory.','Flag the stale evidence and avoid claiming a current answer.'],answer:2,explanation:'Evidence needs a source, version and applicable date. Stale facts cannot establish current policy.'},
  {question:'Which information belongs in a safe run ledger?',options:['Run ID, latency, source version and error category.','API token and full authorization header.','Only the final answer, without its source.'],answer:0,explanation:'Record enough to diagnose a run without leaking credentials.'}
];
export function createLearnAPI(configOverride, env=process.env, storeOverride) {
  const router=express.Router();
  let config, setupError='The learning portal needs its server environment configured. Ask the instructor to finish setup.';
  try {config=configOverride || loadConfig(env);}
  catch (err) {
    // Only our fixed validation messages are safe to return; never expose raw parser errors.
    if(err instanceof ConfigurationError) setupError='Portal setup: '+err.message+' Update the Production environment variables in Vercel and redeploy.';
  }
  let store;
  try {store=config && (storeOverride || (config.accountStorage==='mongodb'?createMongoUserStore(env):null));}
  catch {config=null;setupError='Portal setup: MONGODB_URI is invalid. Update the server connection string and redeploy.';}
  // Deliberately instance-local for this small no-database sample; see deployment notes.
  const limits=new Map();
  const throttle=(key,max)=>{
    const now=Date.now();
    for(const [k,v] of limits) if(v.until<now) limits.delete(k);
    if(limits.size>10000) return false;
    const bucket=limits.get(key) || {count:0,until:now+15*60*1000};
    bucket.count++; limits.set(key,bucket); return bucket.count<=max;
  };
  const publicAccess=env.COURSE_PUBLIC!=='false';
  const published=config?.published ?? env.COURSE_PUBLISHED!=='false';
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/access',(req,res)=>res.json({publicAccess,published,today:dayKey()}));
  // Public learning routes do not depend on account setup or database connectivity.
  if(publicAccess && published)router.use(createCourseAPI());
  router.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!config) return res.status(503).json({error:setupError});
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin')!==config.origin) return res.status(403).json({error:'This request must come from the course website.'});
    next();
  });
  router.post('/login',async(req,res)=>{
    const {username,password}=req.body || {};
    if(typeof username!=='string' || typeof password!=='string' || username.length>100 || password.length>256) return res.status(400).json({error:'Enter a valid username and password.'});
    const normalized=username.trim().toLowerCase();
    const ip=req.ip || 'unknown';
    if(!throttle('ip:'+ip,60) || !throttle('user:'+normalized,12)) return res.status(429).json({error:'Too many sign-in attempts. Try again in 15 minutes.'});
    const user=store?await store.find(normalized):config.users.find(u=>u.username===normalized);
    if(!verifyPassword(user,password,config.secret)) return res.status(401).json({error:'The username or password is incorrect.'});
    const token=signSession(user,config); setSessionCookie(res,token,config);
    res.json({user:publicUser(user),csrf:csrfFor(token,config),today:dayKey(),published:config.published});
  });
  router.use(async(req,res,next)=>{
    const token=parseCookie(req.headers.cookie);
    const data=sessionData(token,config);
    const candidate=store && data?await store.find(data.sub):null;
    const user=store?readSession(token,{...config,users:candidate?[candidate]:[]}):readSession(token,config);
    if(!user) return res.status(401).json({error:'Please sign in to continue.'});
    if(!['GET','HEAD'].includes(req.method) && req.get('x-learn-csrf')!==csrfFor(token,config)) return res.status(403).json({error:'Your session changed. Refresh the page and try again.'});
    req.learnUser=user;req.learnToken=token;next();
  });
  router.get('/me',(req,res)=>res.json({user:publicUser(req.learnUser),csrf:csrfFor(req.learnToken,config),today:dayKey(),published:config.published}));
  router.post('/logout',(req,res)=>{setSessionCookie(res,'',config);res.json({ok:true});});
  router.get('/admin',async(req,res)=>{
    if(req.learnUser.role!=='admin') return res.status(403).json({error:'Instructor access is required.'});
    res.json({users:(store?await store.list():config.users).map(u=>({...publicUser(u),active:u.active!==false})),accountStorage:store?'mongodb':'environment',published:config.published,lessonCount:1,moduleCount:1});
  });
  router.post('/admin/users',async(req,res)=>{
    if(req.learnUser.role!=='admin')return res.status(403).json({error:'Instructor access is required.'});
    if(!store)return res.status(409).json({error:'Connect MongoDB to create accounts here.'});
    const {username,name,password}=req.body || {};
    try{buildUser({username,name,password,role:'student'});}catch(err){return res.status(400).json({error:err.message});}
    try{const user=await store.create({username,name,password,role:'student'});res.status(201).json({user:publicUser(user)});}
    catch(err){if(err.code===11000)return res.status(409).json({error:'That username is already in use.'});throw err;}
  });
  router.use((req,res,next)=>{
    if(!config.published && req.learnUser.role!=='admin') return res.status(403).json({error:'The course is not published yet. Please check back with your instructor.'});
    next();
  });
  router.use(createCourseAPI());
  router.use((err,req,res,next)=>{
    console.error('Learn request failed:',err.name);res.status(store?503:500).json({error:store?'The account database is unavailable. Check the MongoDB connection and network access, then try again.':'Something went wrong. Please try again.'});
  });
  return router;
}

function createCourseAPI(){
  const course=express.Router();
  course.get('/lesson',async(req,res)=>{
    const source=await readFile(new URL('day-01.md',contentURL),'utf8');
    const html=sanitizeHtml(marked.parse(source),{allowedTags:sanitizeHtml.defaults.allowedTags.concat(['details','summary']),allowedAttributes:{a:['href','title','rel'],code:['class']},transformTags:{a:sanitizeHtml.simpleTransform('a',{rel:'noopener noreferrer'})}});
    res.json({html,quiz:QUIZ.map(({answer,explanation,...q})=>q)});
  });
  course.get('/lab',(req,res)=>res.download(fileURLToPath(new URL('day-01-lab.py',contentURL)),'day-01-lab.py'));
  course.post('/quiz',(req,res)=>{
    const answers=req.body?.answers;
    if(!Array.isArray(answers) || answers.length!==QUIZ.length || answers.some(a=>!Number.isInteger(a) || a<0 || a>2)) return res.status(400).json({error:'Answer all three questions first.'});
    const results=QUIZ.map((q,i)=>({correct:q.answer===answers[i],explanation:q.explanation}));
    const score=results.filter(r=>r.correct).length;
    res.json({score,total:QUIZ.length,passed:score===QUIZ.length,results,today:dayKey()});
  });
  course.post('/reflection',(req,res)=>{
    const note=req.body?.note;
    if(typeof note!=='string' || note.trim().length<40 || note.length>10000) return res.status(400).json({error:'Write a reflection of 40–10,000 characters to record a learning day.'});
    res.json({ok:true,today:dayKey()});
  });
  return course;
}
