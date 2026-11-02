import express from 'express';
import helmet from 'helmet';
import {fileURLToPath} from 'node:url';
import {createLearnAPI} from './server/learn/api.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const app=express();
app.disable('x-powered-by');
// Vercel supplies a trusted last proxy hop. Local requests use the socket address.
if(process.env.VERCEL) app.set('trust proxy',1);
const portalSecurity=helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],fontSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:null}}});
app.use('/api/learn',portalSecurity,express.json({limit:'20kb'}),createLearnAPI());
app.use('/learn',portalSecurity,express.static(root+'learn',{index:'index.html'}));
// Explicit static mounts prevent source, .env and teaching source files being exposed.
app.use('/assets',express.static(root+'assets'));
app.use('/blog',express.static(root+'blog'));
for(const file of ['index.html','styles.css','script.js','chandan_resume.pdf']) app.get('/'+file,(req,res)=>res.sendFile(root+file));
app.get('/',(req,res)=>res.sendFile(root+'index.html'));
app.use((req,res)=>res.status(404).send('Page not found'));
app.use((err,req,res,next)=>res.status(err.type==='entity.too.large'?413:400).json({error:'The request could not be read.'}));
export default app;
