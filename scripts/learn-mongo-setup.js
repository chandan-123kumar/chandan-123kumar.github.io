import {createMongoUserStore} from '../server/learn/mongo-users.js';
if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI in the server environment first.');
const store=createMongoUserStore();
try{await store.setup();console.log('Created/validated users collection and unique username index.');}
catch(err){console.error('Database setup failed:',err.name);process.exitCode=1;}
finally{await store.close();}
