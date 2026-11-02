export const shiftDate=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function streaks(days,today) {
  const valid=[...new Set(days.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d) && d<=today && !Number.isNaN(Date.parse(d))))].sort();
  const set=new Set(valid);let current=0,best=0,run=0,last;
  for(const d of valid){run=last && shiftDate(last,1)===d?run+1:1;best=Math.max(best,run);last=d;}
  let day=set.has(today)?today:shiftDate(today,-1);
  while(set.has(day)){current++;day=shiftDate(day,-1);}
  return {current,best,days:valid};
}
export function readProgress(username,storage=localStorage) {
  const value=JSON.parse(storage.getItem('chandan-learn:v1:'+username) || '{}');
  return {days:Array.isArray(value.days)?value.days.filter(d=>typeof d==='string'):[],completed:value.completed===true,note:typeof value.note==='string'?value.note.slice(0,10000):'',lastSaved:typeof value.lastSaved==='string'?value.lastSaved:null};
}
export function writeProgress(username,progress,storage=localStorage) {storage.setItem('chandan-learn:v1:'+username,JSON.stringify(progress));}
