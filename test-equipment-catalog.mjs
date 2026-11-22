import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {equipmentCatalog,getCatalogRecord,getAvailableInventoryIds,applyCatalogIdentity,findCatalogRecords,getDimensionInfo,getDimensionCoverage,dimensionDescription} from './dist/equipment-catalog.mjs';
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

test('all sourced footprints retain positive available dimensions and dated HTTPS provenance',()=>{
  const sourced=equipmentCatalog.filter(entry=>entry.dimensionsIn);
  assert.ok(sourced.length>=11);
  for(const {id,dimensionsIn:d} of sourced){
    assert.ok([d.width,d.length,...(d.height===undefined?[]:[d.height])].every(n=>Number.isFinite(n)&&n>0),id);
    assert.equal(new URL(d.sourceUrl).protocol,'https:',id);
    assert.match(d.verifiedAt,/^\d{4}-\d{2}-\d{2}$/,id);
    assert.match(d.source,/^(manufacturer|secondary)-/,id);
  }
});

test('dimension research preserves every survey identity and historical dimension value',()=>{
  const baseline=JSON.parse(readFileSync(new URL('./research/equipment-identities-baseline.json',import.meta.url)));
  for(const original of baseline.records){
    const current=getCatalogRecord(original.id);
    assert.deepEqual(Object.fromEntries(Object.keys(original).map(key=>[key,current[key]])),original,original.id);
  }
  const dimensions=JSON.parse(readFileSync(new URL('./research/dimensions-baseline.json',import.meta.url)));
  assert.equal(dimensions.sourcedGroups,20);assert.equal(dimensions.sourcedUnits,25);
  for(const original of dimensions.records){
    assert.deepEqual(getCatalogRecord(original.id).dimensionsIn,original.dimensionsIn,original.id);
    if(original.dimensionsCm)assert.deepEqual(getCatalogRecord(original.id).dimensionsCm,original.dimensionsCm);
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

test('dimension evidence retains original units, accurate conversions and exact model bindings',()=>{
  const findings=JSON.parse(readFileSync(new URL('./research/dimension-findings.json',import.meta.url)));
  for(const record of findings.records){
    const entry=getCatalogRecord(record.id),info=getDimensionInfo(entry),e=entry.dimensionEvidence;
    assert.deepEqual(e,Object.fromEntries(Object.entries(record).filter(([key])=>key!=='id')),entry.id);
    assert.ok(info.sourced,entry.id);
    assert.equal(e.modelNumber,entry.modelNumber);assert.equal(e.manufacturer,entry.manufacturer);
    assert.ok(e.reference);assert.equal(e.originalUnits,'in');assert.equal(e.reviewedAt,'2026-11-22');
    for(const key of ['length','width','height']){
      if(e.original[key]===undefined){assert.equal(info.dimensions[key],undefined);continue;}
      assert.equal(info.dimensions[key],e.original[key]);
      assert.ok(Math.abs(info.convertedCm[key]-e.original[key]*2.54)<0.000051);
    }
    for(const patch of [{modelNumber:'OTHER-MODEL'},{manufacturer:'Other maker'}]){
      const changed=getDimensionInfo(entry,{...entry,...patch});
      assert.equal(changed.kind,'model-mismatch');assert.equal(changed.dimensions,null);assert.equal(changed.canPrefill,false);
    }
  }
});

test('references, unknown heights and manufacturer conflicts never silently become exact footprints',()=>{
  for(const entry of equipmentCatalog.filter(e=>e.dimensionReference)){
    const info=getDimensionInfo(entry);
    assert.equal(info.kind,'reference-only');assert.equal(info.sourced,false);assert.equal(info.canPrefill,false);assert.equal(info.dimensions,null);
    assert.match(dimensionDescription(entry),/reference only|estimate only/);
    assert.equal(getDimensionInfo(entry,{...entry,modelNumber:'STAFF-CORRECTION'}).kind,'model-mismatch');
  }
  for(const entry of equipmentCatalog.filter(e=>e.dimensionEvidence?.conflicts?.length)){
    assert.equal(getDimensionInfo(entry).canPrefill,false,entry.id);
    assert.match(dimensionDescription(entry),/Conflicting specifications/);
    for(const conflict of entry.dimensionEvidence.conflicts)assert.equal(new URL(conflict.sourceUrl).protocol,'https:');
  }
  assert.equal(getDimensionInfo(getCatalogRecord('CHK-081')).dimensions.height,undefined);
  assert.match(dimensionDescription(getCatalogRecord('CHK-081')),/Height unknown/);
  assert.equal(getDimensionInfo(getCatalogRecord('CHK-092')).dimensions.height,48);
  assert.equal(getDimensionInfo(getCatalogRecord('CHK-094')).kind,'unknown');
});

test('source coverage counts catalog groups and represented physical units independently',()=>{
  const c=getDimensionCoverage();
  assert.deepEqual(c.total,{groups:95,units:155});assert.deepEqual(c.sourced,{groups:77,units:104});
  assert.equal(c.manufacturer.groups+c.secondary.groups+c.legacy.groups,c.sourced.groups);
  assert.equal(c.reference.groups+c.unknown.groups+c.sourced.groups,c.total.groups);
  assert.deepEqual(getDimensionCoverage([getCatalogRecord('CHK-051')]).unknown,{groups:1,units:20});
});
