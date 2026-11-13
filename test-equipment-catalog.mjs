import assert from 'node:assert/strict';
import test from 'node:test';
import {equipmentCatalog,getCatalogRecord,getAvailableInventoryIds,applyCatalogIdentity} from './dist/equipment-catalog.mjs';
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
test('version 2 persisted project retains catalog metadata in draft and export',()=>{
  const item=applyCatalogIdentity({id:'item1',kind:'bench',category:'free',name:'Bench',width:3,length:5,x:1,y:2,rotation:0,buffer:0,locked:false},getCatalogRecord('CHK-073'),'HART-0104');
  Object.assign(item,{muscleGroups:['pectoralis major'],exercises:['bench press'],capabilities:['barbell']});
  const p={version:2,active:'layout',layouts:[{id:'layout',name:'Draft',room:{width:50,length:50},items:[item]}]};
  const saved=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.layouts[0].items[0].inventoryId,'HART-0104');
  assert.deepEqual(saved.layouts[0].items[0].exercises,['bench press']);
  assert.throws(()=>validateProject({...p,layouts:[{...p.layouts[0],items:[{...item,muscleGroups:'chest'}]}]}),/Invalid equipment exercise metadata/);
});
