import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHECKLIST_KEY,checklistRecords,checklistBackup,checklistProgress,checklistCSV} from './dist/model-checklist.mjs';
import {equipmentCatalog} from './dist/equipment-catalog.mjs';

test('existing v2 checklist backups retain answers and timestamps against the shared catalog',()=>{
  const legacy={
    'CHK-001':{answer:'yes',correct:'RSL0620',updated:'2026-11-13T12:00:00Z'},
    'CHK-094':{answer:'identified',correct:'OBSERVED-MODEL',updated:'2026-11-13T12:10:00Z'}
  };
  const records=checklistBackup({format:CHECKLIST_KEY,records:legacy});
  assert.deepEqual({...records},legacy);
  assert.deepEqual(checklistProgress(records),{checked:2,yes:1,no:1,unknown:0});
  assert.equal(equipmentCatalog.reduce((sum,item)=>sum+item.quantity,0),155);
});

test('malformed backups fail before replacing progress and foreign identifiers are ignored',()=>{
  for(const backup of [{format:'other',records:{}},{format:CHECKLIST_KEY,records:[]},
    {format:CHECKLIST_KEY,records:{'CHK-001':{answer:'verified'}}},
    {format:CHECKLIST_KEY,records:{'CHK-001':{answer:'no',correct:{private:'invalid'}}}}]){
    assert.throws(()=>checklistBackup(backup));
  }
  const source=JSON.parse('{"__proto__":{"answer":"yes"},"CHK-999":{"answer":"yes"},"CHK-001":{"answer":"unknown"}}');
  assert.deepEqual(Object.keys(checklistRecords(source)),['CHK-001']);
  assert.equal(Object.getPrototypeOf(checklistRecords(source)),null);
});

test('survey answers stay separate from catalog verification and count unknown models without guessing',()=>{
  const records=checklistRecords({'CHK-094':{answer:'unknown',correct:''},'CHK-073':{answer:'yes',correct:'observed'}});
  assert.deepEqual(checklistProgress(records),{checked:2,yes:1,no:0,unknown:1});
  assert.equal(equipmentCatalog.find(item=>item.id==='CHK-094').modelNumber,null);
  assert.equal(equipmentCatalog.find(item=>item.id==='CHK-073').modelStatus,'reported');
});

test('CSV retains all surveyed groups and neutralizes spreadsheet formulas in corrections',()=>{
  const csv=checklistCSV({'CHK-001':{answer:'no',correct:'=HYPERLINK("unsafe")'}});
  assert.equal(csv.split('\r\n').length,97);
  assert.ok(csv.includes('"\'=HYPERLINK(""unsafe"")"'));
  assert.ok(csv.includes('HART-0104, HART-0105, HART-0154, HART-0155'));
  assert.ok(csv.includes('Model not found')===false);
});
