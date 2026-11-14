import assert from 'node:assert/strict';
import test from 'node:test';
import {equipmentCatalog,getCatalogRecord,getAvailableInventoryIds,applyCatalogIdentity,findCatalogRecords} from './dist/equipment-catalog.mjs';
import {validateProject} from './dist/model.mjs';

test('all surveyed inventory records remain stable and individually identifiable',()=>{
  assert.equal(equipmentCatalog.length,95);
  const ids=equipmentCatalog.flatMap(entry=>entry.inventoryIds);
  assert.equal(ids.length,155);
  assert.equal(new Set(ids).size,155);
  for(const entry of equipmentCatalog)assert.equal(entry.inventoryIds.length,entry.quantity);
});
test('latest gym walk-through corrections are retained without guessing',()=>{
  assert.deepEqual([getCatalogRecord('CHK-072').quantity,getCatalogRecord('CHK-073').quantity],[3,4]);
  assert.equal(getCatalogRecord('CHK-073').modelNumber,'Rogue Monster Lite Competition Bench');
  assert.equal(getCatalogRecord('CHK-073').inventoryIds.at(-1),'HART-0155');
  assert.equal(getCatalogRecord('CHK-089').modelNumber,'PPF-800');
  assert.equal(getCatalogRecord('CHK-089').modelStatus,'probable');
  assert.equal(getCatalogRecord('CHK-092').name,'Abram GHD 2.0');
  assert.equal(getCatalogRecord('CHK-095').name,'Floor Glute');
  assert.equal(getCatalogRecord('CHK-091').modelStatus,'unidentified');
  assert.equal(getCatalogRecord('CHK-094').modelNumber,null);
});
test('manufacturer spec footprints use original inch units and keep room geometry independent',()=>{
  const b=getCatalogRecord('CHK-014');
  assert.deepEqual([b.dimensionsIn.length,b.dimensionsIn.width,b.dimensionsIn.height],[38,58,59]);
  assert.ok(b.dimensionsIn.sourceUrl.startsWith('https://www.lifefitness.com/'));
  assert.deepEqual([getCatalogRecord('CHK-072').dimensionsIn.length,getCatalogRecord('CHK-073').dimensionsIn.length],[53.5,53.5]);
  const item={id:'foo',name:'Machine',category:'strength',kind:'custom',x:5,y:8,width:2,length:3,rotation:0,buffer:0,locked:false};
  const linked=applyCatalogIdentity(item,b,'HART-0014');
  assert.deepEqual([linked.width,linked.length,linked.x,linked.y],[2,3,5,8]);
  assert.deepEqual(linked.muscleGroups,['biceps']);
  assert.deepEqual(linked.exercises,['biceps curl']);
});
test('unknown model numbers are assumed probable, not silently verified',()=>{
  assert.equal(getCatalogRecord('CHK-028').modelStatus,'probable');
  assert.equal(getCatalogRecord('CHK-028').modelNumber,'RSL0314');
  assert.equal(getCatalogRecord('CHK-014').modelStatus,'verified');
  assert.equal(getCatalogRecord('CHK-014').modelNumber,'MTSBC');
});
test('adding a model identity preserves geometry and refuses foreign inventory IDs',()=>{
  const entry=getCatalogRecord('CHK-073');
  const item={id:'uuid',name:'Bench',category:'free',kind:'bench',width:3,length:5,x:12,y:15,rotation:90,buffer:0,locked:false};
  const linked=applyCatalogIdentity(item,entry,'HART-0154');
  assert.equal(linked.inventoryId,'HART-0154');
  assert.equal(linked.modelNumber,'Rogue Monster Lite Competition Bench');
  assert.deepEqual([linked.width,linked.length,linked.x,linked.y,linked.rotation],[3,5,12,15,90]);
  assert.equal(item.catalogId,undefined);
  assert.throws(()=>applyCatalogIdentity(item,entry,'HART-0101'),/does not belong/);
  assert.deepEqual(getAvailableInventoryIds(entry,[linked]),['HART-0104','HART-0105','HART-0155']);
});
test('duplicate physical IDs are rejected within one layout',()=>{
  const entry=getCatalogRecord('CHK-073');
  const template={id:'a',kind:'bench',category:'free',name:'Bench',width:3,length:5,x:1,y:2,rotation:0,buffer:0,locked:false};
  const item1=applyCatalogIdentity(template,entry,'HART-0104');
  const item2={...item1,id:'b',x:8};
  const p={version:2,active:'l',layouts:[{id:'l',name:'Test',room:{width:50,length:50},items:[item1,item2]}]};
  assert.throws(()=>validateProject(p),/Duplicate physical inventory ID/);
  item2.inventoryId='';
  assert.doesNotThrow(()=>validateProject(p));
});
test('version 2 persisted project retains catalog metadata in draft and export',()=>{
  const item=applyCatalogIdentity({id:'item1',kind:'bench',category:'free',name:'Bench',width:3,length:5,x:1,y:2,rotation:0,buffer:0,locked:false},getCatalogRecord('CHK-073'),'HART-0104');
  Object.assign(item,{muscleGroups:['pectoralis major'],exercises:['bench press'],capabilities:['barbell']});
  const p={version:2,active:'layout',layouts:[{id:'layout',name:'Draft',room:{width:50,length:50},items:[item]}]};
  const saved=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.layouts[0].items[0].inventoryId,'HART-0104');
  assert.deepEqual(saved.layouts[0].items[0].exercises,['bench press']);
  assert.throws(()=>validateProject({...p,layouts:[{...p.layouts[0],items:[{...item,muscleGroups:'chest'}]}]}),/Invalid equipment exercise metadata/);
});

test('model changes reset old exercises while reapplying the same model preserves reviewed edits',()=>{
  const bench=applyCatalogIdentity({category:'free',width:3,length:5,x:12,y:15,rotation:90},getCatalogRecord('CHK-073'),'HART-0104');
  bench.exercises=['reviewed bench exercise'];
  assert.deepEqual(applyCatalogIdentity(bench,getCatalogRecord('CHK-073'),'HART-0104').exercises,bench.exercises);
  const curl=applyCatalogIdentity(bench,getCatalogRecord('CHK-014'),'HART-0014');
  assert.deepEqual(curl.exercises,['biceps curl']);
  assert.deepEqual(curl.muscleGroups,['biceps']);
  assert.deepEqual([curl.width,curl.length,curl.x,curl.y,curl.rotation],[3,5,12,15,90]);
});

test('imports enforce model-to-unit membership and validate template metadata',()=>{
  const item=applyCatalogIdentity({id:'item1',kind:'bench',category:'free',name:'Bench',width:3,length:5,x:1,y:2,rotation:0,buffer:0,locked:false},getCatalogRecord('CHK-073'),'HART-0104');
  const project=patch=>({version:2,active:'layout',layouts:[{id:'layout',name:'Draft',room:{width:50,length:50},items:[{...item,...patch}]}]});
  for(const patch of [{catalogId:'CHK-999'},{inventoryId:'HART-0014'},{catalogId:undefined},{exercises:[' ']}]){
    assert.throws(()=>validateProject(project(patch)),/catalog|inventory|metadata/i);
  }
  const template={...item,inventoryId:''};
  assert.doesNotThrow(()=>validateProject({...project({}),library:[template]}));
  assert.throws(()=>validateProject({...project({}),library:[item]}),/template/);
  assert.throws(()=>validateProject({...project({}),library:[{...template,exercises:{notes:'invalid'}}]}),/exercise metadata/);
});

test('all sourced manufacturer footprints retain positive dimensions and dated HTTPS provenance',()=>{
  const sourced=equipmentCatalog.filter(entry=>entry.dimensionsIn);
  assert.ok(sourced.length>=11);
  for(const {id,dimensionsIn:d} of sourced){
    assert.ok([d.width,d.length,d.height].every(n=>Number.isFinite(n)&&n>0),id);
    assert.equal(new URL(d.sourceUrl).protocol,'https:',id);
    assert.match(d.verifiedAt,/^\d{4}-\d{2}-\d{2}$/,id);
    assert.match(d.source,/^manufacturer-/,id);
  }
});

test('staff catalog search combines physical/model IDs, exercise terms, sourced dimensions and draft availability',()=>{
  assert.deepEqual(findCatalogRecords({query:'hart-0014'}).map(entry=>entry.id),['CHK-014']);
  assert.deepEqual(findCatalogRecords({query:'biceps precor',sourcedOnly:true}).map(entry=>entry.id),['CHK-016']);
  const assigned=[{catalogId:'CHK-014',inventoryId:'HART-0014',storedIn:'@storage'}];
  assert.deepEqual(findCatalogRecords({query:'MTSBC',availableOnly:true},assigned),[]);
  assert.equal(findCatalogRecords({query:'MTSBC'},assigned)[0].id,'CHK-014');
  assert.deepEqual(findCatalogRecords({query:'CHK-094',sourcedOnly:true}),[]);
  assert.equal(findCatalogRecords({query:'CHK-094'})[0].modelStatus,'unidentified');
  assert.equal(equipmentCatalog.length,95);
});
