import {createInterface} from 'node:readline/promises';
import {createMongoUserStore} from '../server/learn/mongo-users.js';
if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI in the server environment first.');
const input=createInterface({input:process.stdin,output:process.stdout});
const username=await input.question('Username: ');
const name=await input.question('Display name: ');
const role=(await input.question('Role (student/admin): ')).trim();
// Read the password through a hidden terminal prompt; never command-line arguments.
if(!process.stdin.isTTY){input.close();throw new Error('Run this command in an interactive terminal.');}
input.close();
process.stdout.write('Password (hidden): ');
process.stdin.setRawMode(true);process.stdin.resume();
const password=await new Promise((resolve,reject)=>{let value='';const handler=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){cleanup();reject(new Error('Cancelled'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(value);return;}if(c==='\u007f')value=value.slice(0,-1);else if(c>=' ')value+=c;}};function cleanup(){process.stdin.off('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',handler);});
const store=createMongoUserStore();
try{const user=await store.create({username,name,role,password});console.log('Created account:',user.username,'('+user.role+')');}
catch(err){console.error(err.code===11000?'Username already exists.':'Account creation failed: '+err.name);process.exitCode=1;}
finally{await store.close();}
