import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {api,publicLayout} from './worker/service.mjs';
import {validateProject} from './dist/model.mjs';
import {buildingPlan} from './dist/building-plan.mjs';
import {applyCatalogIdentity,getCatalogRecord} from './dist/equipment-catalog.mjs';

async function rows(DB){
  const tables={gym_staff:'email',gym_drafts:'id',gym_imports:'request_id',gym_publications:'sequence',__gym_local_migrations:'tag'};
  return Object.fromEntries(await Promise.all(Object.entries(tables).map(async([table,key])=>[table,(await DB.prepare('SELECT * FROM '+table+' ORDER BY '+key).all()).results])));
}

test('pinned version-13 code reads newer records unchanged through rollback and forward recovery, with explicit editing limits',async t=>{
  const baseline=JSON.parse(await readFile('release/sites-v13-baseline.json','utf8'));
  assert.match(baseline.github_equivalent_commit,/^[a-f0-9]{40}$/);
  const dir=await mkdtemp(join(tmpdir(),'gym-rollback-fixture-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const oldRoot=join(dir,'version13');await mkdir(oldRoot);
  // A Sites checkout has its own commit IDs. Either audited immutable alias is
  // acceptable only when its complete tree equals the pinned version-13 tree.
  let rollbackCommit;
  for(const commit of [baseline.github_equivalent_commit,baseline.sites_commit]){
    let tree;try{tree=execFileSync('git',['rev-parse','--verify',commit+'^{tree}'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{continue;}
    assert.equal(tree,baseline.source_tree,'rollback source must equal the audited complete source tree');rollbackCommit=commit;break;
  }
  assert.ok(rollbackCommit,'Need full GitHub history or the retained Sites baseline commit to run rollback verification.');
  const archive=execFileSync('git',['archive',rollbackCommit],{maxBuffer:16*1024*1024});
  execFileSync('tar',['-x','-C',oldRoot],{input:archive});
  const old=await import(pathToFileURL(join(oldRoot,'worker/service.mjs')).href);
  const oldModel=await import(pathToFileURL(join(oldRoot,'dist/model.mjs')).href);
  let DB=sqliteDB(join(dir,'fixture.sqlite'));t.after(()=>DB.close());
  const env=()=>({DB,STAFF_OWNER_EMAIL:'owner@example.test'});
  const call=(handler,path,method='GET',body,email='owner@example.test')=>handler(new Request('https://gym.example.test'+path,{
    method,headers:{'Content-Type':'application/json','oai-authenticated-user-id':'fixture-'+email,'oai-authenticated-user-email':email},
    ...(body?{body:JSON.stringify(body)}:{})}),env());
  const current=async(path,method='GET',body)=>{const response=await call(api,path,method,body);assert.ok(response.ok,await response.clone().text());return response.json();};
  const machine=applyCatalogIdentity({id:'fixture-physical-instance',name:'FICTIONAL rollback machine',category:'strength',kind:'custom',
    x:60,y:30,width:4,length:5,rotation:45,buffer:1,locked:false,status:'out-of-service'},getCatalogRecord('CHK-014'),'HART-0014');
  const layout={...buildingPlan(),id:'rollback-draft',name:'FICTIONAL rollback-only layout'};layout.items.push(machine);
  const template={...machine,id:'fixture-template'};delete template.inventoryId;
  await current('/api/drafts','POST',{layout,library:[template]});
  await current('/api/drafts','POST',{layout:{...layout,id:'rollback-archived',items:[]},library:[]});
  await current('/api/drafts/rollback-archived/archive','POST',{expectedRevision:1,archived:true});
  await current('/api/staff','POST',{email:'editor@example.test',role:'editor'});
  await current('/api/staff','POST',{email:'publisher@example.test',role:'publisher'});
  await current('/api/import','POST',{requestId:'rollback-import',project:{version:2,active:layout.id,layouts:[layout],library:[template]}});
  await current('/api/drafts/rollback-draft/publish','POST',{expectedRevision:1,expectedCurrentId:null,confirmActual:true,requestId:'rollback-publication'});
  const before=await rows(DB),published=await current('/api/current');DB.close();DB=sqliteDB(join(dir,'fixture.sqlite'));
  for(const path of ['/api/session','/api/drafts','/api/drafts?archived=true','/api/drafts/rollback-draft','/api/drafts/rollback-archived','/api/history','/api/staff','/api/current'])
    assert.equal((await call(old.api,path)).status,200,path);
  for(const role of ['editor','publisher'])assert.equal((await (await call(old.api,'/api/session','GET',undefined,role+'@example.test')).json()).user.role,role);
  assert.deepEqual(await (await call(old.api,'/api/current')).json(),published);
  const doc=await (await call(old.api,'/api/drafts/rollback-draft')).json();
  assert.equal(doc.layout.items.find(item=>item.id===machine.id).inventoryId,'HART-0014');
  assert.deepEqual(doc.library[0].exercises,template.exercises);assert.deepEqual(doc.layout.room,layout.room);
  assert.deepEqual(await rows(DB),before,'old code reads must not rewrite newer rows or the local fixture migration ledger');
  assert.equal((await call(old.api,'/api/v1/layout')).status,404,'rollback predates workout API, not a 503 disabled response');

  // Establish the limit without writing an invalid draft or publishing another snapshot.
  const duplicate=structuredClone(doc.layout);duplicate.items.push({...machine,id:'fixture-duplicate'});
  const project={version:2,active:duplicate.id,layouts:[duplicate],library:doc.library};
  assert.doesNotThrow(()=>oldModel.validateProject(project),'v13 does not know the later physical-ID constraint');
  assert.throws(()=>validateProject(project),/Duplicate physical inventory ID/);
  assert.equal(old.publicLayout(layout).items.find(item=>item.id===machine.id).inventoryId,undefined,'new publications made by old code omit catalog identity');
  assert.equal(publicLayout(layout).items.find(item=>item.id===machine.id).inventoryId,'HART-0014');

  assert.deepEqual(await current('/api/current'),published,'forward recovery retains the exact newer publication');
  assert.equal((await current('/api/drafts/rollback-draft')).layout.items.find(item=>item.id===machine.id).rotation,45);
  assert.deepEqual(await rows(DB),before,'rollback/forward read checks must not mutate records');
});
