import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './integration/workout-v1/response.schema.json' with {type:'json'};
import {createGymClient,GymApiError,resolveWorkoutEquipment} from './integration/workout-v1/client.mjs';
import {api} from './worker/service.mjs';
import {createHash} from 'node:crypto';
import {buildingPlan} from './dist/building-plan.mjs';
import {publicLayout} from './worker/service.mjs';

const fixture=async name=>JSON.parse(await readFile(new URL('./integration/workout-v1/fixtures/'+name+'.json',import.meta.url),'utf8'));
const token='A'.repeat(43),otherToken='B'.repeat(43),origin='https://gym.example.test';
const reply=(body,status=200,etag='W/"fixture"')=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...(etag?{ETag:etag}:{})}});
const ajv=new Ajv2020({strict:true});addFormats(ajv);ajv.addSchema(schema);
const valid=definition=>ajv.compile({$ref:schema.$id+'#/$defs/'+definition});

test('synthetic response fixtures validate against the versioned machine-readable contract',async()=>{
  const index=await fixture('index');assert.equal(index.synthetic,true);
  for(const entry of index.fixtures){const body=await fixture(entry.file.replace(/\.json$/,''));
    const validate=valid(entry.definition);assert.ok(validate(body),JSON.stringify(validate.errors));}
  const data=await fixture('populated-layout');
  assert.notEqual(data.layout.equipment[0].id,data.layout.equipment[0].inventoryId);
  assert.notEqual(data.layout.equipment[0].catalogId,data.layout.equipment[0].inventoryId);
  const bad=structuredClone(data);bad.layout.equipment[0].footprint[0][0]=null;
  assert.equal(valid('layoutResponse')(bad),false);
});

test('actual v1 representations of the authoritative geometry satisfy the consumer contract',async()=>{
  const layout=buildingPlan();
  const row={id:'fictional-geometry-contract',published_at:'2026-01-01T18:00:00.000Z',public_json:JSON.stringify(publicLayout(layout))};
  const env={WORKOUT_API_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),DB:{prepare(){return {async first(){return row;}};}}};
  for(const resource of ['layout','equipment']){
    const response=await api(new Request(origin+'/api/v1/'+resource,{headers:{Authorization:'Bearer '+token}}),env);
    assert.equal(response.status,200);const validate=valid(resource+'Response');
    assert.ok(validate(await response.json()),JSON.stringify(validate.errors));
  }
});

test('backend cache revalidates, coalesces callers, isolates credentials and protects cached bodies',async()=>{
  const body=await fixture('populated-layout');let calls=0;
  const client=createGymClient({gymOrigin:origin,workoutToken:token,siteServiceToken:'fictional-site-secret',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url.href,origin+'/api/v1/layout');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer fictional-site-secret');
    assert.ok(options.signal instanceof AbortSignal);
    if(calls===1){assert.equal(options.headers['If-None-Match'],undefined);return reply(body);}
    assert.equal(options.headers['If-None-Match'],'W/"fixture"');return reply(null,304);
  }});
  const [a,b]=await Promise.all([client.getLayout(),client.getLayout()]);assert.equal(calls,1);assert.deepEqual(a,b);
  a.layout.equipment[0].x=999;assert.notEqual((await client.getLayout()).layout.equipment[0].x,999);assert.equal(calls,2);
  const other=createGymClient({gymOrigin:origin,workoutToken:otherToken,fetchImpl:async(url,{headers})=>{
    assert.equal(headers['If-None-Match'],undefined);assert.equal(headers.Authorization,'Bearer '+otherToken);return reply(body);
  }});assert.deepEqual(await other.getLayout(),body);
});

test('no publication differs from an empty published floor and errors invalidate cached equipment',async()=>{
  const body=await fixture('populated-layout');
  const failures=[()=>reply({apiVersion:1,error:{code:'unauthorized',message:'fixture'}},401),
    ()=>new Response('<html>gateway login</html>',{status:200,headers:{'Content-Type':'text/html'}}),
    ()=>{throw Error('private URL and token must never escape');},
    ()=>reply({apiVersion:2,publication:body.publication,layout:body.layout}),
    ()=>reply({...body,layout:{...body.layout,equipment:[body.layout.equipment[0],body.layout.equipment[0]]}}),
    ()=>reply({apiVersion:1,error:{code:'integration_unavailable',message:'fixture'}},503)];
  for(const failure of failures){let call=0;
    const client=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async(url,{headers})=>{
      call++;if(call===1)return reply(body);if(call===2)return failure();
      assert.equal(headers['If-None-Match'],undefined);return reply(body);
    }});
    await client.getLayout();await assert.rejects(client.getLayout(),error=>error instanceof GymApiError&&!error.message.includes('private'));
    assert.deepEqual(await client.getLayout(),body);
  }
  const unpublished=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async()=>reply(await fixture('no-publication'),404)});
  assert.equal(await unpublished.getLayout(),null);
  const empty=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async()=>reply(await fixture('empty-layout'))});
  assert.deepEqual((await empty.getLayout()).layout.equipment,[]);
});

test('consumer rejects unsafe origins, unsolicited 304, oversized bodies and timed-out requests',async()=>{
  for(const gymOrigin of ['http://gym.example.test','https://user:secret@gym.example.test','https://gym.example.test/path','https://gym.example.test/?token=secret'])
    assert.throws(()=>createGymClient({gymOrigin,workoutToken:token}),/HTTPS origin/);
  await assert.rejects(createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async()=>reply(null,304)}).getLayout(),{code:'unexpected_304'});
  await assert.rejects(createGymClient({gymOrigin:origin,workoutToken:token,maxBytes:10,fetchImpl:async()=>reply({large:'x'.repeat(20)})}).getLayout(),{code:'response_too_large'});
  const timeout=createGymClient({gymOrigin:origin,workoutToken:token,timeoutMs:5,fetchImpl:async(url,{signal})=>{
    await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,100);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
  }});
  await assert.rejects(timeout.getLayout(),{code:'upstream_failure'});
});

test('workout joins retain exact instance IDs and report stale, absent and unavailable equipment without substitutions',async()=>{
  const snapshot=await fixture('populated-layout'),before=structuredClone(snapshot);
  const result=resolveWorkoutEquipment(snapshot,{publicationId:'fictional-old-publication',equipmentIds:[
    'fictional-instance-rack-a','fictional-instance-bike-b','fictional-stored-or-missing','FICTIONAL-UNIT-A','fictional-instance-rack-a']});
  assert.equal(result.publicationChanged,true);
  assert.deepEqual(result.equipment.map(item=>item.status),['available','out-of-service','missing','missing']);
  result.equipment[0].equipment.x=999;assert.deepEqual(snapshot,before);
});

test('mapping exchange rejects fictional approval, stale publications and non-instance references',async()=>{
  const {validateExerciseMappings}=await import('./integration/workout-v1/mappings.mjs');
  const mapping=await fixture('fictional-mappings'),snapshot=await fixture('populated-layout');
  assert.throws(()=>validateExerciseMappings(mapping,snapshot),/joint review/);
  assert.deepEqual(validateExerciseMappings(mapping,snapshot,{allowFictional:true}),mapping);
  const reviewed={...mapping,reviewStatus:'reviewed',reviewReference:'fictional review record for this test only'};
  assert.deepEqual(validateExerciseMappings(reviewed,snapshot),reviewed);
  assert.throws(()=>validateExerciseMappings({...reviewed,sourcePublicationId:'older'},snapshot),/Revalidate/);
  assert.throws(()=>validateExerciseMappings({...reviewed,mappings:[{exerciseId:'demo',candidateEquipmentIds:['FICTIONAL-UNIT-A']}]},snapshot),/instance ID/);
  assert.throws(()=>validateExerciseMappings({...reviewed,mappings:[...reviewed.mappings,...reviewed.mappings]},snapshot),/Duplicate/);
});

test('304 requires a validator actually sent by the backend and refuses a changed response tag',async()=>{
  const body=await fixture('populated-layout');
  for(const firstTag of [null,'not-an-entity-tag']){
    let count=0;
    const client=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async(url,{headers})=>{
      count++;assert.equal(headers['If-None-Match'],undefined);
      return count===2?reply(null,304):reply(body,200,firstTag);
    }});
    await client.getLayout();await assert.rejects(client.getLayout(),{code:'unexpected_304'});assert.deepEqual(await client.getLayout(),body);
  }
  let count=0;
  const changed=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async()=>++count===1?reply(body):reply(null,304,'W/"unrelated"')});
  await changed.getLayout();await assert.rejects(changed.getLayout(),{code:'invalid_revalidation'});
  let weakCount=0;
  const equivalent=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async()=>++weakCount===1?reply(body):reply(null,304,'"fixture"')});
  await equivalent.getLayout();assert.deepEqual(await equivalent.getLayout(),body);
});

test('no-store responses are not retained for later conditional reuse',async()=>{
  const body=await fixture('populated-layout');let count=0;
  const client=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async(url,{headers})=>{
    count++;assert.equal(headers['If-None-Match'],undefined);
    if(count===2)return reply(null,304);
    const response=reply(body);response.headers.set('Cache-Control','private, no-store');return response;
  }});
  await client.getLayout();await assert.rejects(client.getLayout(),{code:'unexpected_304'});assert.deepEqual(await client.getLayout(),body);
});

test('publication refresh replaces the whole snapshot and re-resolves moved, absent and unavailable workout references',async()=>{
  const first=await fixture('populated-layout'),next=await fixture('refreshed-layout');let count=0;
  const client=createGymClient({gymOrigin:origin,workoutToken:token,fetchImpl:async(url,{headers})=>{
    count++;if(count===1)return reply(first,200,'W/"first"');assert.equal(headers['If-None-Match'],'W/"first"');return reply(next,200,'W/"next"');
  }});
  const before=await client.getLayout(),after=await client.getLayout();
  const references={publicationId:before.publication.id,equipmentIds:['fictional-instance-rack-a','fictional-instance-bike-b','fictional-instance-rack-c']};
  const result=resolveWorkoutEquipment(after,references);
  assert.equal(result.publicationChanged,true);assert.deepEqual(result.equipment.map(item=>item.status),['available','missing','out-of-service']);
  assert.equal(result.equipment[0].equipment.x,18);assert.equal(result.equipment[0].equipment.rotation,45);
  assert.notDeepEqual(result.equipment[0].equipment.footprint,before.layout.equipment[0].footprint);
  assert.deepEqual(after,next);assert.deepEqual(before,first);
  const {validateExerciseMappings}=await import('./integration/workout-v1/mappings.mjs');
  assert.throws(()=>validateExerciseMappings({mappingVersion:'demo',reviewStatus:'reviewed',reviewReference:'fictional test only',
    sourcePublicationId:first.publication.id,mappings:[{exerciseId:'fictional-placeholder',candidateEquipmentIds:['fictional-instance-rack-a']}]},after),/Revalidate/);
});

test('independent mapping and highlighting helpers reject ambiguous instance or physical-unit identities',async()=>{
  const {validateExerciseMappings}=await import('./integration/workout-v1/mappings.mjs');
  const first=await fixture('populated-layout'),mapping={...(await fixture('fictional-mappings')),reviewStatus:'reviewed',reviewReference:'fictional test only'};
  for(const duplicatePhysical of [false,true]){
    const body=structuredClone(first),item=structuredClone(body.layout.equipment[0]);
    if(duplicatePhysical)item.id='fictional-other-instance';body.layout.equipment.push(item);
    assert.throws(()=>resolveWorkoutEquipment(body,{publicationId:body.publication.id,equipmentIds:[item.id]}),/unambiguous/);
    assert.throws(()=>validateExerciseMappings(mapping,body),/unambiguous/);
  }
});
