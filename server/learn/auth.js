import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export class ConfigurationError extends Error {}

export const COOKIE = 'chandan_learn';
const eq = (a, b) => { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); };
export function loadConfig(env=process.env) {
  const secret=env.SESSION_SECRET || '';
  if (secret.length<32) throw new ConfigurationError('Set SESSION_SECRET to at least 32 random characters.');
  let origin;
  try { origin=new URL(env.APP_ORIGIN || 'http://127.0.0.1:3047').origin; }
  catch { throw new ConfigurationError('APP_ORIGIN must be a valid website origin, such as https://www.chandan.live.'); }
  const production=env.NODE_ENV==='production' || Boolean(env.VERCEL);
  if(production && !origin.startsWith('https://')) throw new ConfigurationError('APP_ORIGIN must use HTTPS in production.');
  let entries=[];
  if(env.ADMIN_USERNAME && env.ADMIN_PASSWORD) entries.push({username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD,name:env.ADMIN_NAME || 'Instructor',role:'admin'});
  if(env.STUDENT_USERNAME && env.STUDENT_PASSWORD) entries.push({username:env.STUDENT_USERNAME,password:env.STUDENT_PASSWORD,name:env.STUDENT_NAME || 'Student',role:'student'});
  if(env.STUDENTS_JSON) {
    let extra;
    try { extra=JSON.parse(env.STUDENTS_JSON); }
    catch { throw new ConfigurationError('STUDENTS_JSON must contain a valid JSON array. Leave it unset when using only STUDENT_USERNAME and STUDENT_PASSWORD.'); }
    if(!Array.isArray(extra) || extra.length>100) throw new ConfigurationError('STUDENTS_JSON must be an array with at most 100 students.');
    entries.push(...extra.map(u=>({...u,role:'student'})));
  }
  const seen=new Set();
  const users=entries.map(u=>{
    if(!u || typeof u!=='object') throw new ConfigurationError('Each STUDENTS_JSON entry must contain a username and password.');
    const username=String(u.username || '').trim().toLowerCase();
    if(!/^[a-z0-9_.-]{3,40}$/.test(username) || seen.has(username)) throw new ConfigurationError('Use unique usernames of 3–40 letters, digits, dots, dashes or underscores.');
    if(typeof u.password!=='string' || u.password.length<12 || u.password.length>256) throw new ConfigurationError('ADMIN_PASSWORD, STUDENT_PASSWORD and passwords in STUDENTS_JSON must each be 12–256 characters.');
    seen.add(username);
    const salt=createHmac('sha256',secret).update(username).digest();
    const passwordHash=scryptSync(u.password,salt,64).toString('hex');
    const version=createHmac('sha256',secret).update(username+':'+passwordHash+':'+u.role).digest('hex');
    return {username,name:String(u.name || username).slice(0,80),role:u.role,passwordHash,salt,version};
  });
  if(!users.some(u=>u.role==='admin')) throw new ConfigurationError('Set ADMIN_USERNAME and ADMIN_PASSWORD.');
  return {secret,origin,production,users,published:env.COURSE_PUBLISHED!=='false'};
}
export const publicUser = ({username,name,role})=>({username,name,role});
export function verifyPassword(user,password,secret) {
  const salt=user?.salt || createHash('sha256').update(secret).digest();
  const value=scryptSync(password,salt,64).toString('hex');
  return eq(value,user?.passwordHash || '0'.repeat(128)) && Boolean(user);
}
export function signSession(user,config,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({sub:user.username,v:user.version,exp:now+8*60*60*1000,nonce:randomBytes(24).toString('hex')})).toString('base64url');
  return `${payload}.${createHmac('sha256',config.secret).update(payload).digest('base64url')}`;
}
export function readSession(token,config,now=Date.now()) {
  if(typeof token!=='string' || token.length>2048) return null;
  const [payload,sig,extra]=token.split('.');
  if(!payload || !sig || extra || !eq(sig,createHmac('sha256',config.secret).update(payload).digest('base64url'))) return null;
  try {
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    const user=config.users.find(u=>u.username===data.sub && eq(u.version,data.v || ''));
    return user && Number.isFinite(data.exp) && data.exp>now ? user : null;
  } catch {return null;}
}
export const csrfFor=(token,config)=>createHmac('sha256',config.secret).update('csrf:'+token).digest('hex');
export function parseCookie(header='') {
  const pair=header.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  return pair?.slice(COOKIE.length+1) || '';
}
export function setSessionCookie(res,token,config) {
  res.cookie(COOKIE,token,{httpOnly:true,secure:config.production,sameSite:'strict',path:'/api/learn',maxAge:token?8*60*60*1000:0});
}
export function dayKey(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
