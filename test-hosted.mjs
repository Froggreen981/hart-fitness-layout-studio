import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {api} from './worker/service.mjs';
import {buildingPlan} from './dist/building-plan.mjs';
import {roomPoints,wallPolygons} from './dist/model.mjs';

test('latest Sites Hart geometry survives shared save, publish and private-data filtering',async()=>{
 const DB=sqliteDB();
 const call=async(path,method='GET',data)=>{
  const response=await api(new Request('https://gym.example'+path,{method,headers:{'content-type':'application/json','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test'},...(data?{body:JSON.stringify(data)}:{})}),{DB,STAFF_OWNER_EMAIL:'owner@example.test'});
  assert.ok(response.ok,await response.clone().text());return response.json();
 };
 try{
  const layout=buildingPlan();layout.room.walls[0].projections[0].notes='private';
  const created=await call('/api/drafts','POST',{layout,library:[]});
  assert.deepEqual(created.layout.room,layout.room);
  await call('/api/drafts/'+layout.id+'/publish','POST',{expectedRevision:1,expectedCurrentId:null,confirmActual:true,requestId:'hart-geometry-check'});
  const published=(await call('/api/current')).current.layout;
  assert.deepEqual(roomPoints(published.room),roomPoints(layout.room));
  assert.deepEqual(published.room.walls.flatMap(wallPolygons),layout.room.walls.flatMap(wallPolygons));
  assert.equal(published.room.walls[0].projections[0].notes,undefined);
  const machine={id:'test-bench',name:'Bench',kind:'bench',category:'free',x:70,y:30,width:2,length:5,rotation:0,locked:false,buffer:0};
  created.layout.items.push(machine);
  await call('/api/drafts/'+layout.id,'PUT',{...created,expectedRevision:1});
  assert.deepEqual((await call('/api/current')).current.layout,published,'draft edits cannot change the published snapshot');
 }finally{DB.close();}
});

test('deployable Worker serves all entrypoints and excludes local test identity code',async()=>{
 execFileSync(process.execPath,['scripts/build-worker.mjs']);
 const source=readFileSync('dist/server/index.js','utf8');
 assert.ok(!source.includes('test_actor'));
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
 const DB=sqliteDB();
 try{
  for(const path of ['/','/index.html','/workspace.html','/map.html','/building-plan.mjs','/patron-map.mjs','/model-checklist.html','/model-checklist.mjs','/model-checklist-page.mjs','/model-checklist.css']){
   assert.equal((await worker.fetch(new Request('https://gym.example'+path),{DB})).status,200,path);
  }
  const anon=await worker.fetch(new Request('https://gym.example/api/drafts'),{DB});assert.equal(anon.status,401);
  const publicResponse=await worker.fetch(new Request('https://gym.example/api/current'),{DB});assert.deepEqual(await publicResponse.json(),{current:null});
  const workout=new Request('https://gym.example/api/v1/layout');
  assert.equal((await worker.fetch(workout,{DB})).status,503);
  const token=randomBytes(32).toString('base64url');
  const env={DB,WORKOUT_API_TOKEN_SHA256:createHash('sha256').update(token).digest('hex')};
  assert.equal((await worker.fetch(workout,env)).status,401);
  const authorized=new Request(workout,{headers:{Authorization:'Bearer '+token}});
  const empty=await worker.fetch(authorized,env);
  assert.equal(empty.status,404);
  assert.equal((await empty.json()).error.code,'no_publication');
 }finally{DB.close();}
});
