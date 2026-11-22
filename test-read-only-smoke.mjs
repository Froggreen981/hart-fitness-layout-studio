import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOnlySmoke,compareReadOnlyEvidence} from './scripts/read-only-smoke.mjs';
import {api} from './worker/service.mjs';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {createHash} from 'node:crypto';

const origin='https://gym.example.test';
const paths=['/workspace.html','/index.html','/map.html','/equipment-checklist.html','/equipment-catalog.mjs'];
const contents=path=>Buffer.from('FICTIONAL static asset '+path);
const assets=Object.fromEntries(paths.map(path=>[path,{content_type:path.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8',sha256:createHash('sha256').update(contents(path)).digest('hex')}]));
const item={id:'fixture-machine',name:'PRIVATE equipment',category:'free',kind:'bench',width:3,length:5,x:4,y:6,rotation:90,buffer:0,locked:false,notes:'PRIVATE observation'};
async function fixture(t){
  const DB=sqliteDB();t.after(()=>DB.close());const env={DB,STAFF_OWNER_EMAIL:'owner@example.test'};
  const call=(path,method='GET',body)=>api(new Request(origin+path,{method,headers:{'Content-Type':'application/json',
    'oai-authenticated-user-id':'owner-fixture','oai-authenticated-user-email':env.STAFF_OWNER_EMAIL},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.equal((await call('/api/staff','POST',{email:'editor@example.test',role:'editor'})).status,200);
  const layout={id:'smoke-draft',name:'PRIVATE draft',room:{width:50,length:50},items:[item]};
  assert.equal((await call('/api/drafts','POST',{layout,library:[]})).status,201);
  const archived={...layout,id:'smoke-archived'};
  await call('/api/drafts','POST',{layout:archived,library:[]});
  await call('/api/drafts/smoke-archived/archive','POST',{expectedRevision:1,archived:true});
  const requests=[];
  const transport=(role='owner')=>async(url,options)=>{
    assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(new URL(url).origin,origin);
    requests.push(String(url));const path=new URL(url).pathname;
    if(!path.startsWith('/api/'))return new Response(contents(path),{headers:{'Content-Type':assets[path]?.content_type||'text/html'}});
    return api(new Request(url,{method:options.method,headers:{'oai-authenticated-user-id':role+'-fixture','oai-authenticated-user-email':role+'@example.test'}}),env);
  };
  const rows=async()=>Object.fromEntries(await Promise.all(['gym_drafts','gym_staff','gym_imports','gym_publications'].map(async table=>[table,(await DB.prepare('SELECT * FROM '+table).all()).results])));
  return {DB,call,transport,requests,rows,layout};
}

test('read-only owner evidence fingerprints drafts, archives, roles and empty publication without exporting private fields or writing',async t=>{
  const f=await fixture(t),before=await f.rows();
  const report=await readOnlySmoke({origin,assets,fetchImpl:f.transport(),draftIds:['smoke-draft']});
  assert.equal(report.status,'passed');assert.equal(report.snapshot.complete,true);assert.equal(report.asset_hashes_verified,true);
  assert.equal(report.reported_role,'owner');assert.deepEqual(report.snapshot.current,{published:false});
  assert.equal(report.snapshot.active_drafts.length,1);assert.equal(report.snapshot.archived_drafts.length,1);
  assert.equal(report.snapshot.selected_drafts.length,1);assert.equal(report.limits.full_database_backup,false);
  assert.equal(report.limits.migration_ledger_verified,false);assert.equal(report.limits.platform_identity_verified,false);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE|@example|smoke-draft|smoke-archived/);
  assert.deepEqual(await f.rows(),before);assert.ok(f.requests.every(url=>new URL(url).origin===origin));
});

test('before/after comparison detects draft, archive, staff-role and publication changes but ignores code profile changes',async t=>{
  const f=await fixture(t),fetchImpl=f.transport();
  const before=await readOnlySmoke({origin,profile:'baseline',fetchImpl,draftIds:['smoke-draft']});
  const after=await readOnlySmoke({origin,assets,fetchImpl,draftIds:['smoke-draft']});
  assert.equal(compareReadOnlyEvidence(before,after).status,'passed');
  const changed=structuredClone(after);changed.snapshot.current={published:true,id_sha256:'different'};
  assert.deepEqual(compareReadOnlyEvidence(before,changed).changed_sections,['current']);
  for(const key of ['active_drafts','archived_drafts','staff_roles_sha256','history','selected_drafts']){
    const update=structuredClone(after);delete update.snapshot[key];
    assert.equal(compareReadOnlyEvidence(before,update).status,'failed',key);
  }
  const doc=(await (await f.call('/api/drafts/smoke-draft')).json());doc.layout.items[0].x=20;
  await f.call('/api/drafts/smoke-draft','PUT',{...doc,expectedRevision:1});
  const edited=await readOnlySmoke({origin,assets,fetchImpl,draftIds:['smoke-draft']});
  assert.equal(compareReadOnlyEvidence(before,edited).status,'failed');
  assert.ok(compareReadOnlyEvidence(before,edited).changed_sections.includes('selected_drafts'));
});

test('editor evidence confirms owner controls are denied using GET and does not require publication writes',async t=>{
  const f=await fixture(t),before=await f.rows();
  const report=await readOnlySmoke({origin,expectedRole:'editor',fetchImpl:f.transport('editor')});
  assert.equal(report.status,'passed');assert.equal(report.reported_role,'editor');
  assert.equal(report.checks.find(check=>check.name==='owner_controls_denied').http_status,403);
  assert.equal(report.snapshot.staff_roles_sha256,undefined);assert.deepEqual(await f.rows(),before);
  const wrong=await readOnlySmoke({origin,expectedRole:'editor',fetchImpl:f.transport('owner')});
  assert.equal(wrong.status,'failed');assert.equal(wrong.checks.at(-1).reason,'unexpected_role');
});

test('gateway redirects, non-JSON login pages and transport failures block verification without credential/error leakage',async()=>{
  for(const fetchImpl of [async()=>new Response(null,{status:302,headers:{Location:'https://login.example/PRIVATE'}}),
    async()=>new Response('<html>PRIVATE gateway</html>',{headers:{'Content-Type':'text/html'}}),
    async()=>{throw Error('PRIVATE token=secret');}]){
    const report=await readOnlySmoke({origin,fetchImpl});assert.equal(report.status,'blocked');
    assert.equal(report.snapshot.complete,false);assert.equal(report.checks.length,1);
    assert.doesNotMatch(JSON.stringify(report),/PRIVATE|token=|login.example/);
    assert.equal(compareReadOnlyEvidence(report,report).status,'blocked');
  }
});

test('wrong asset hashes and unexpectedly enabled workout integration fail the candidate smoke check',async t=>{
  const f=await fixture(t),fetchImpl=f.transport();
  const mismatch=structuredClone(assets);mismatch['/index.html'].sha256='0'.repeat(64);
  const report=await readOnlySmoke({origin,assets:mismatch,fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.asset_hashes_verified,false);
  const enabled=await readOnlySmoke({origin,fetchImpl:async(url,options)=>new URL(url).pathname==='/api/v1/layout'?
    Response.json({apiVersion:1,error:{code:'unauthorized',message:'fixture'}},{status:401}):fetchImpl(url,options)});
  assert.notEqual(enabled.status,'passed');assert.equal(enabled.snapshot.complete,false);
});

test('bounded pagination and response limits cannot be mistaken for full preservation evidence',async t=>{
  const f=await fixture(t),transport=f.transport();
  const report=await readOnlySmoke({origin,maxPages:1,fetchImpl:async(url,options)=>new URL(url).pathname==='/api/drafts'?
    Response.json({drafts:[],nextOffset:50}):transport(url,options)});
  assert.equal(report.status,'blocked');assert.equal(report.snapshot.complete,false);
  assert.equal(compareReadOnlyEvidence(report,report).status,'blocked');
  const large=await readOnlySmoke({origin,maxBytes:10,fetchImpl:transport});
  assert.equal(large.status,'failed');assert.equal(large.checks[0].reason,'response_too_large');
});

test('smoke options refuse credential URLs, non-loopback HTTP, protocol-relative assets and API asset paths before requests',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;throw Error('unexpected network');};
  for(const value of ['http://gym.example.test','https://user:secret@gym.example.test','https://gym.example.test/path','https://gym.example.test/?secret=token'])
    await assert.rejects(readOnlySmoke({origin:value,fetchImpl}));
  for(const path of ['//other.example/file.js','/../file.js','/api/staff'])
    await assert.rejects(readOnlySmoke({origin,fetchImpl,assets:{[path]:assets['/index.html']}}));
  await assert.rejects(readOnlySmoke({origin,fetchImpl,assets:{}}));
  assert.equal(calls,0);
});

test('concurrent pagination overlap or incorrect archive filtering cannot produce passed preservation evidence',async t=>{
  const f=await fixture(t),transport=f.transport(),before=await f.rows();
  const duplicate=await readOnlySmoke({origin,fetchImpl:async(url,options)=>{
    const query=new URL(url);
    if(query.pathname==='/api/drafts'&&query.searchParams.get('archived')==='false')return Response.json({
      drafts:[{id:'overlap-fixture',name:'PRIVATE overlap',revision:1,archived:false}],nextOffset:query.searchParams.get('offset')==='0'?50:null
    });
    return transport(url,options);
  }});
  assert.equal(duplicate.status,'blocked');assert.equal(duplicate.snapshot.complete,false);
  assert.ok(duplicate.checks.some(check=>check.reason==='duplicate_identity_across_pages'));
  assert.equal(duplicate.limits.atomic_database_snapshot,false);
  const badFilter=await readOnlySmoke({origin,fetchImpl:async(url,options)=>{
    const query=new URL(url);
    if(query.pathname==='/api/drafts'&&query.searchParams.get('archived')==='true')return Response.json({
      drafts:[{id:'wrong-archive-fixture',name:'PRIVATE wrong archive state',revision:1,archived:false}],nextOffset:null
    });
    return transport(url,options);
  }});
  assert.equal(badFilter.status,'failed');assert.equal(badFilter.snapshot.complete,false);
  assert.deepEqual(await f.rows(),before);
});

test('a 200 current-map response with corrupted publication geometry cannot pass release verification',async t=>{
  const f=await fixture(t),transport=f.transport();
  for(const layout of ['PRIVATE invalid shape',{}, {name:'PRIVATE invalid room',room:{width:50,length:50},items:[{id:'bad',width:null}]}]){
    const report=await readOnlySmoke({origin,fetchImpl:async(url,options)=>new URL(url).pathname==='/api/current'?
      Response.json({current:{id:'fixture-corrupt-publication',publishedAt:'2026-01-01T00:00:00.000Z',layout}}):transport(url,options)});
    assert.equal(report.status,'failed');assert.equal(report.snapshot.complete,false);
    assert.equal(report.checks.find(check=>check.name==='current_publication').reason,'response_or_asset_mismatch');
    assert.doesNotMatch(JSON.stringify(report),/PRIVATE/);
  }
});
