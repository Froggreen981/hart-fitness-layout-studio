import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {api} from './worker/service.mjs';
import {applyCatalogIdentity,getCatalogRecord} from './dist/equipment-catalog.mjs';

const tables={gym_staff:'email',gym_drafts:'id',gym_imports:'request_id',gym_publications:'sequence'};
async function snapshot(db){
  const result={};
  for(const [table,key] of Object.entries(tables))result[table]=(await db.prepare('SELECT * FROM '+table+' ORDER BY '+key).all()).results;
  return result;
}

test('current service opens a v13-shaped database without changing drafts, roles, receipts or publications',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'gym-upgrade-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'fixture.sqlite');let DB=sqliteDB(path);
  const item={id:'legacy/unit ü',name:'TEST legacy bench',category:'free',kind:'bench',width:3,length:5,x:8,y:10,rotation:90,buffer:1,locked:false};
  const layout={id:'legacy-draft',name:'TEST ONLY v13 fixture',room:{width:60,length:50},items:[item]};
  const doc={layout,library:[{...item,id:'old-template'}]};
  const archived={layout:{...layout,id:'archived-draft',name:'TEST archived proposal'},library:[]};
  for(const [document,revision,isArchived] of [[doc,7,0],[archived,4,1]]){
    await DB.prepare('INSERT INTO gym_drafts (id,name,revision,document_json,archived,updated_at,updated_by) VALUES (?,?,?,?,?,?,?)')
      .bind(document.layout.id,document.layout.name,revision,JSON.stringify(document),isArchived,'2026-11-01T12:00:00Z','owner@example.test').run();
  }
  for(const [email,role] of [['editor@example.test','editor'],['publisher@example.test','publisher']]){
    await DB.prepare('INSERT INTO gym_staff (email,role,created_at) VALUES (?,?,?)').bind(email,role,'2026-11-01').run();
  }
  const publicLayout={name:layout.name,room:layout.room,items:[{...item,buffer:undefined,locked:undefined,status:'available'}]};
  await DB.prepare('INSERT INTO gym_publications (id,source_draft_id,source_revision,document_json,public_json,published_at,published_by) VALUES (?,?,?,?,?,?,?)')
    .bind('legacy-publication',layout.id,7,JSON.stringify(doc),JSON.stringify(publicLayout),'2026-11-01T12:00:00Z','owner@example.test').run();
  await DB.prepare('INSERT INTO gym_imports (request_id,token,result_json,created_at) VALUES (?,?,?,?)')
    .bind('legacy-import','fixture-receipt-token',JSON.stringify({imported:[{id:layout.id,name:layout.name}]}),'2026-11-01').run();
  const before=await snapshot(DB);DB.close();DB=sqliteDB(path);t.after(()=>DB.close());
  const call=(route,{email='owner@example.test',method='GET',body}={})=>api(new Request('https://gym.example'+route,{
    method,headers:{'Content-Type':'application/json',...(email?{'oai-authenticated-user-id':'fixture-'+email,'oai-authenticated-user-email':email}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),{DB,STAFF_OWNER_EMAIL:'owner@example.test'});
  for(const route of ['/api/session','/api/drafts','/api/drafts?archived=true','/api/drafts/legacy-draft','/api/history','/api/staff','/api/current']){
    assert.equal((await call(route)).status,200,route);
  }
  assert.equal((await call('/api/drafts',{email:null})).status,401);
  for(const role of ['editor','publisher']){
    const response=await call('/api/session',{email:role+'@example.test'});
    assert.equal((await response.json()).user.role,role);
  }
  assert.equal((await call('/api/v1/layout',{email:null})).status,503,'new integration remains disabled');
  assert.deepEqual(await snapshot(DB),before,'opening and reading upgraded service must not rewrite old records');
  const current=await (await call('/api/current')).json();
  assert.deepEqual(current.current.layout,JSON.parse(JSON.stringify(publicLayout)),'old publications gain no inferred catalog metadata');
  assert.equal((await call('/api/drafts/legacy-draft/publish',{email:'editor@example.test',method:'POST',body:{confirmActual:true,expectedRevision:7,expectedCurrentId:'legacy-publication',requestId:'editor-denied'}})).status,403);
  const changed=structuredClone(doc);
  changed.layout.items.push(applyCatalogIdentity({...item,id:'new-instance',x:30},getCatalogRecord('CHK-014'),'HART-0014'));
  const saved=await call('/api/drafts/legacy-draft',{method:'PUT',body:{...changed,expectedRevision:7}});
  assert.equal(saved.status,200);assert.equal((await saved.json()).revision,8);
  const after=await snapshot(DB);
  for(const table of ['gym_staff','gym_imports','gym_publications'])assert.deepEqual(after[table],before[table],table);
  assert.deepEqual(after.gym_drafts.find(row=>row.id==='archived-draft'),before.gym_drafts.find(row=>row.id==='archived-draft'));
  assert.deepEqual(await (await call('/api/current')).json(),current,'draft editing cannot replace the legacy publication');
});
