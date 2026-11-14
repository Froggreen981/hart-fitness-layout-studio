import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {api} from './worker/service.mjs';
const owner='owner@example.test',manager='manager@example.test',editor='editor@example.test';
function setup(t,db=sqliteDB()){
 t.after(()=>db.close());
 const env={DB:db,STAFF_OWNER_EMAIL:owner};
 async function call(path,method='GET',data,user=owner,headers={}){
  const response=await api(new Request('https://gym.example.test'+path,{method,headers:{...(user?{'oai-authenticated-user-email':user,'oai-authenticated-user-id':'user-'+user}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})}),env);
  return {status:response.status,headers:response.headers,data:response.status===304?null:await response.json()};
 }
 return {db,env,call};
}
const machine=(id='rack-01',patch={})=>({id,name:'Rack',category:'strength',kind:'rack',width:4,length:7,x:10,y:10,rotation:0,locked:false,buffer:1,buffers:{front:1,rear:1,left:1,right:1},...patch});
const layout=(id='layout-a',patch={})=>({id,name:'Pilot',room:{width:100,length:90,shape:'rect',walls:[{name:'Partition',type:'full',x1:73,y1:0,x2:73,y2:21,thickness:.75}]},items:[machine()],...patch});
const project=l=>({version:2,active:l.id,layouts:[l],library:[]});
const create=(call,l=layout())=>call('/api/drafts','POST',{layout:l,library:[]});
const publish=(call,id='layout-a',revision=1,current=null,requestId=crypto.randomUUID(),user=owner)=>call('/api/drafts/'+id+'/publish','POST',{expectedRevision:revision,expectedCurrentId:current,requestId,confirmActual:true},user);
test('public current is readable while all staff data requires identity',async t=>{
 const {call}=setup(t);
 assert.deepEqual((await call('/api/current','GET',undefined,null)).data,{current:null});
 assert.equal((await call('/api/drafts','GET',undefined,null)).status,401);
 assert.equal((await call('/api/session','GET',undefined,'stranger@example.test')).status,403);
 assert.equal((await call('/api/staff','GET',undefined,null)).status,401);
});
test('staff roles allow a second account to edit but reserve publishing permissions',async t=>{
 const {call}=setup(t);
 await call('/api/staff','POST',{email:manager,role:'publisher'});
 await call('/api/staff','POST',{email:editor,role:'editor'});
 await create(call);
 const doc=(await call('/api/drafts/layout-a','GET',undefined,editor)).data;
 doc.layout.items[0].x=20;
 assert.equal((await call('/api/drafts/layout-a','PUT',{...doc,expectedRevision:1},editor)).status,200);
 const reloaded=await call('/api/drafts/layout-a','GET',undefined,manager);
 assert.equal(reloaded.data.layout.items[0].x,20);
 assert.equal(reloaded.data.revision,2);
 assert.equal((await publish(call,'layout-a',2,null,crypto.randomUUID(),editor)).status,403);
 assert.equal((await publish(call,'layout-a',2,null,crypto.randomUUID(),manager)).status,201);
 assert.equal((await call('/api/staff','POST',{email:'bad@example.test',role:'publisher'},editor)).status,403);
});
test('an old save cannot overwrite a newer machine position',async t=>{
 const {call}=setup(t);await create(call);
 const first=(await call('/api/drafts/layout-a')).data,second=structuredClone(first);
 first.layout.items[0].x=30;
 assert.equal((await call('/api/drafts/layout-a','PUT',{...first,expectedRevision:1})).status,200);
 second.layout.items[0].x=40;
 assert.equal((await call('/api/drafts/layout-a','PUT',{...second,expectedRevision:1})).status,409);
 assert.equal((await call('/api/drafts/layout-a')).data.layout.items[0].x,30);
});
test('retried create and save requests are safe after a lost response',async t=>{
 const {call}=setup(t);
 assert.equal((await create(call)).status,201);
 assert.equal((await create(call)).status,200);
 const doc=(await call('/api/drafts/layout-a')).data;doc.layout.name='Revised';
 assert.equal((await call('/api/drafts/layout-a','PUT',{...doc,expectedRevision:1})).status,200);
 assert.equal((await call('/api/drafts/layout-a','PUT',{...doc,expectedRevision:1})).data.revision,2);
});
test('publishing snapshots the layout and removes private and stored data',async t=>{
 const {call}=setup(t),l=layout();
 l.room.staffNotes='private';l.items[0].staffNotes='private';l.items.push(machine('stored',{storedIn:'@storage',storageX:4,storageY:5}));
 await create(call,l);const result=await publish(call);assert.equal(result.status,201);
 const publicResult=(await call('/api/current','GET',undefined,null)).data.current;
 assert.deepEqual(Object.keys(publicResult).sort(),['id','layout','publishedAt']);
 assert.equal(publicResult.layout.items.length,1);
 assert.equal(JSON.stringify(publicResult).includes('private'),false);
 const doc=(await call('/api/drafts/layout-a')).data;doc.layout.room.walls[0].x2=60;doc.layout.items[0].x=40;
 await call('/api/drafts/layout-a','PUT',{...doc,expectedRevision:1});
 const still=(await call('/api/current')).data.current;
 assert.equal(still.layout.items[0].x,10);assert.equal(still.layout.room.walls[0].x2,73);
});
test('two simultaneous publishers cannot both replace the same current revision',async t=>{
 const {call}=setup(t);await create(call);await create(call,layout('layout-b'));
 const r=await Promise.all([publish(call),publish(call,'layout-b')]);
 assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);
 assert.equal((await call('/api/history')).data.history.length,1);
});
test('publishing checks both the draft revision and the current publication',async t=>{
 const {call}=setup(t);await create(call);const first=await publish(call);
 assert.equal((await publish(call,'layout-a',1,null)).status,409);
 assert.equal((await publish(call,'layout-a',5,first.data.current.id)).status,409);
 assert.equal((await call('/api/history')).data.history.length,1);
});
test('publish is idempotent and requires physical-state confirmation',async t=>{
 const {call}=setup(t);await create(call);
 const key=crypto.randomUUID();
 assert.equal((await call('/api/drafts/layout-a/publish','POST',{expectedRevision:1,expectedCurrentId:null,requestId:key})).status,400);
 const a=await publish(call,'layout-a',1,null,key),b=await publish(call,'layout-a',1,null,key);
 assert.equal(a.data.current.id,b.data.current.id);assert.equal((await call('/api/history')).data.history.length,1);
});
test('archiving a source draft preserves the published gym map and is reversible',async t=>{
 const {call}=setup(t);await create(call);const p=await publish(call);
 assert.equal((await call('/api/drafts/layout-a/archive','POST',{expectedRevision:1,archived:true})).status,200);
 assert.equal((await call('/api/drafts')).data.drafts.length,0);
 assert.equal((await call('/api/drafts?archived=true')).data.drafts.length,1);
 assert.equal((await call('/api/current')).data.current.id,p.data.current.id);
 assert.equal((await publish(call,'layout-a',2,p.data.current.id)).status,409);
 assert.equal((await call('/api/drafts/layout-a/archive','POST',{expectedRevision:2,archived:false})).status,200);
});
test('history restore appends a publication rather than deleting history',async t=>{
 const {call}=setup(t);await create(call);
 const first=(await publish(call)).data.current;
 const doc=(await call('/api/drafts/layout-a')).data;doc.layout.items[0].x=50;
 await call('/api/drafts/layout-a','PUT',{...doc,expectedRevision:1});
 const second=(await publish(call,'layout-a',2,first.id)).data.current;
 const requestId=crypto.randomUUID();
 const restored=await call('/api/history/'+first.id+'/restore','POST',{expectedCurrentId:second.id,requestId,confirmActual:true});
 assert.equal(restored.status,201);assert.equal((await call('/api/current')).data.current.layout.items[0].x,10);
 assert.equal((await call('/api/history')).data.history.length,3);
 assert.equal((await call('/api/history/'+first.id+'/restore','POST',{expectedCurrentId:second.id,requestId,confirmActual:true})).status,200);
 assert.equal((await call('/api/history')).data.history.length,3);
});
test('a draft from current retains private planning buffers and permanent equipment IDs',async t=>{
 const {call}=setup(t);await create(call);const p=(await publish(call)).data.current;
 const created=await call('/api/drafts/from-current','POST',{expectedCurrentId:p.id});
 assert.equal(created.status,201);assert.notEqual(created.data.layout.id,'layout-a');
 assert.equal(created.data.layout.items[0].id,'rack-01');assert.equal(created.data.layout.items[0].buffers.front,1);
 created.data.layout.room.walls[0].x2=44;
 await call('/api/drafts/'+created.data.layout.id,'PUT',{...created.data,expectedRevision:1});
 assert.equal((await call('/api/drafts/layout-a')).data.layout.room.walls[0].x2,73);
});
test('imports preserve v1/v2 geometry, labels, custom templates and storage; retries do not duplicate',async t=>{
 const {call}=setup(t),l=layout('old-layout');
 l.room={width:100,length:90,shape:'traced',boundary:[[0,0],[100,0],[100,50],[73,50],[73,90],[0,90]],walls:[{name:'CrossFit entry lower',type:'full',x1:73,y1:0,x2:73,y2:21,thickness:.75}]};
 l.items.push(machine('stored',{storedIn:'@storage',storageX:4,storageY:5}));
 l.items.push({id:'area',name:'Area',category:'area',kind:'area',width:10,length:10,x:2,y:2,rotation:0,buffer:0,locked:false,color:'#ffffff',placement:'allowed',label:{x:.2,y:.8,rotation:90},vertices:[[0,0],[1,0],[1,1],[0,1]]});
 const p=project(l);p.library=[{...machine('custom-template'),name:'Custom rack'}];
 const requestId=crypto.randomUUID(),res=await call('/api/import','POST',{project:p,requestId});
 assert.equal(res.status,201);
 const draft=(await call('/api/drafts/'+res.data.imported[0].id)).data;
 assert.deepEqual(draft.layout.room,l.room);assert.equal(draft.layout.items[0].id,'rack-01');
 assert.deepEqual(draft.layout.items[2].label,l.items[2].label);
 assert.equal(draft.layout.items[1].storedIn,'@storage');assert.equal(draft.library[0].id,'custom-template');
 await call('/api/import','POST',{project:p,requestId});
 assert.equal((await call('/api/drafts')).data.drafts.length,1);
 const legacy=project(layout('v1'));legacy.version=1;delete legacy.layouts[0].items[0].buffers;
 const old=await call('/api/import','POST',{project:legacy,requestId:crypto.randomUUID()});
 assert.equal(old.status,201);
 assert.equal((await call('/api/drafts/'+old.data.imported[0].id)).data.layout.items[0].buffers.front,1);
});
test('more than 100 layouts can be imported and listed through bounded pages',async t=>{
 const {call}=setup(t);const p=project(layout());p.layouts=Array.from({length:103},(_,n)=>layout('draft-'+n));p.active='draft-0';
 assert.equal((await call('/api/import','POST',{project:p,requestId:crypto.randomUUID()})).status,201);
 let offset=0,count=0;do{const page=(await call('/api/drafts?limit=25&offset='+offset)).data;count+=page.drafts.length;offset=page.nextOffset;}while(offset!==null);
 assert.equal(count,103);
});
test('cross-site writes, invalid layouts and missing owner configuration fail closed',async t=>{
 const {call,env}=setup(t);
 assert.equal((await call('/api/drafts','POST',{layout:layout()},owner,{Origin:'https://other.example.test'})).status,403);
 assert.equal((await create(call,layout('bad',{items:[machine('x',{width:-4})]}))).status,400);
 assert.equal((await call('/api/drafts')).data.drafts.length,0);
 const response=await api(new Request('https://gym.example.test/api/session',{headers:{'oai-authenticated-user-email':owner,'oai-authenticated-user-id':'owner'}}),{DB:env.DB});
 assert.equal(response.status,503);
});
test('published responses support conditional refresh without exposing staff data',async t=>{
 const {call}=setup(t);await create(call);await publish(call);
 const first=await call('/api/current'),second=await call('/api/current','GET',undefined,null,{'If-None-Match':first.headers.get('etag')});
 assert.equal(second.status,304);assert.equal(first.headers.get('cache-control'),'no-cache');
});
test('shared database survives closing and reopening the server connection',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'gym-shared-test-')),file=join(directory,'gym.sqlite');
 try{
  const first=sqliteDB(file);await api(new Request('https://gym.example.test/api/drafts',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-email':owner,'oai-authenticated-user-id':'owner'},body:JSON.stringify({layout:layout(),library:[]})}),{DB:first,STAFF_OWNER_EMAIL:owner});first.close();
  const second=sqliteDB(file);try{const response=await api(new Request('https://gym.example.test/api/drafts/layout-a',{headers:{'oai-authenticated-user-email':owner,'oai-authenticated-user-id':'owner'}}),{DB:second,STAFF_OWNER_EMAIL:owner});assert.equal(response.status,200);assert.equal((await response.json()).layout.items[0].id,'rack-01');}finally{second.close();}
 }finally{rmSync(join(directory,'gym.sqlite'),{force:true});rmdirSync(directory);}
});


test('overlapping identical publish and restore requests each append only once',async t=>{
 const {call}=setup(t);await create(call);
 const key='concurrent-publish';
 const publishes=await Promise.all([publish(call,'layout-a',1,null,key),publish(call,'layout-a',1,null,key)]);
 assert.deepEqual(publishes.map(r=>r.status).sort(),[200,201]);
 assert.deepEqual(publishes[0].data,publishes[1].data);
 const restore='/api/history/'+key+'/restore';
 const body={expectedCurrentId:key,requestId:'concurrent-restore',confirmActual:true};
 const restores=await Promise.all([call(restore,'POST',body),call(restore,'POST',body)]);
 assert.deepEqual(restores.map(r=>r.status).sort(),[200,201]);
 assert.deepEqual(restores[0].data,restores[1].data);
 assert.equal((await call('/api/history')).data.history.length,2);
 assert.equal((await publish(call,'layout-a',1,key,body.requestId)).status,409);
});
