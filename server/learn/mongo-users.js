import {MongoClient} from 'mongodb';
import {randomBytes,scryptSync} from 'node:crypto';

export const userValidator={$jsonSchema:{bsonType:'object',required:['username','name','role','active','passwordHash','salt','version','createdAt','updatedAt'],additionalProperties:false,properties:{_id:{bsonType:'objectId'},username:{bsonType:'string',pattern:'^[a-z0-9_.-]{3,40}$'},name:{bsonType:'string',minLength:1,maxLength:80},role:{enum:['admin','student']},active:{bsonType:'bool'},passwordHash:{bsonType:'string',pattern:'^[a-f0-9]{128}$'},salt:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},version:{bsonType:'string',pattern:'^[a-f0-9]{64}$'},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'}}}};
export class UserValidationError extends Error {}
export function buildUser({username,name,password,role='student'}){
  if(typeof username!=='string' || !/^[a-z0-9_.-]{3,40}$/.test(username.trim().toLowerCase()))throw new UserValidationError('Use a username of 3–40 letters, digits, dots, dashes or underscores.');
  if(typeof password!=='string' || password.length<12 || password.length>256)throw new UserValidationError('Use a password of 12–256 characters.');
  if(typeof name!=='string' || !name.trim() || name.trim().length>80)throw new UserValidationError('Enter a name of 1–80 characters.');
  if(!['student','admin'].includes(role))throw new UserValidationError('Invalid account role.');
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

export function accountCreationError(err){
  if(err instanceof UserValidationError)return err.message;
  if(err.code===11000)return 'That username already exists. Use another username; the existing account was not changed.';
  if(err.code===18 || (err.code===8000 && /auth|credential|SCRAM/i.test(String(err.message || ''))))return 'MongoDB authentication failed. Check the Atlas DATABASE user username and password in MONGODB_URI (not the portal account password). URL-encode special characters in the database password.';
  if(err.code===13)return 'The MongoDB database user needs read/write permission on chandan_learn.';
  if(err.code===121)return 'MongoDB rejected the user document. Check that the users collection uses the portal schema.';
  if(err.name==='MongoParseError')return 'MONGODB_URI is invalid. Check the Atlas connection string and URL-encode special characters in its password.';
  if(['MongoServerSelectionError','MongoNetworkError','MongoNetworkTimeoutError'].includes(err.name) || ['ENOTFOUND','ECONNREFUSED','ETIMEOUT','ETIMEDOUT'].includes(err.code))return 'Cannot reach MongoDB. Check that Cluster0 is running and your current IP is allowed in Atlas Network Access.';
  if(err.message==='Cancelled')return 'Account creation cancelled.';
  return 'Account creation failed ('+(typeof err.name==='string' && /^[A-Za-z]+$/.test(err.name)?err.name:'unknown error')+'). No credentials were printed.';
}
