import {MongoClient} from 'mongodb';
import {randomBytes,scryptSync} from 'node:crypto';

export const userValidator={$jsonSchema:{bsonType:'object',required:['username','name','role','active','passwordHash','salt','version','createdAt','updatedAt'],additionalProperties:false,properties:{_id:{bsonType:'objectId'},username:{bsonType:'string',pattern:'^[a-z0-9_.-]{3,40}$'},name:{bsonType:'string',minLength:1,maxLength:80},role:{enum:['admin','student']},active:{bsonType:'bool'},passwordHash:{bsonType:'string',pattern:'^[a-f0-9]{128}$'},salt:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},version:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'}}}};
export function buildUser({username,name,password,role='student'}){
  if(typeof username!=='string' || !/^[a-z0-9_.-]{3,40}$/.test(username.trim().toLowerCase()))throw new Error('Use a username of 3–40 letters, digits, dots, dashes or underscores.');
  if(typeof password!=='string' || password.length<12 || password.length>256)throw new Error('Use a password of 12–256 characters.');
  if(typeof name!=='string' || !name.trim() || name.trim().length>80)throw new Error('Enter a name of 1–80 characters.');
  if(!['student','admin'].includes(role))throw new Error('Invalid account role.');
  const salt=randomBytes(32),now=new Date();
  return {username:username.trim().toLowerCase(),name:name.trim(),role,active:true,passwordHash:scryptSync(password,salt,64).toString('hex'),salt:salt.toString('hex'),version:randomBytes(32).toString('hex'),createdAt:now,updatedAt:now};
}
export function createMongoUserStore(env=process.env){
  const client=new MongoClient(env.MONGODB_URI,{maxPoolSize:5,minPoolSize:0,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000});
  const db=client.db(env.MONGODB_DB || 'chandan_learn');
  const users=db.collection('users');
  const decode=u=>u && u.active===true?{...u,salt:Buffer.from(u.salt,'hex')}:null;
  return {
    find:async username=>decode(await users.findOne({username,active:true})),
    list:async()=>users.find({},{projection:{username:1,name:1,role:1,active:1,_id:0}}).sort({createdAt:1}).limit(1000).toArray(),
    create:async data=>{const document=buildUser(data);await users.insertOne(document);return decode(document);},
    setup:async()=>{if(!(await db.listCollections({name:'users'}).toArray()).length)await db.createCollection('users',{validator:userValidator});else await db.command({collMod:'users',validator:userValidator,validationLevel:'strict',validationAction:'error'});await users.createIndex({username:1},{unique:true,name:'unique_username'});},
    close:()=>client.close()
  };
}
