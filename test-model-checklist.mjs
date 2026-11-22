import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHECKLIST_KEY,checklistRecords,checklistBackup,checklistProgress,checklistCSV,checklistDimensionTarget} from './dist/model-checklist.mjs';
import {equipmentCatalog,getDimensionInfo,getCatalogRecord} from './dist/equipment-catalog.mjs';

test('corrected checklist observations cannot inherit a catalog dimension source in exports',()=>{
  const entry=getCatalogRecord('CHK-003'),record={answer:'no',correct:'ACTUAL-OTHER-MODEL',modelAtCheck:entry.modelNumber};
  const target=checklistDimensionTarget(entry,record),info=getDimensionInfo(entry,target);
  assert.equal(info.sourced,false);assert.equal(info.kind,'model-mismatch');
  const row=checklistCSV({[entry.id]:record}).split('\r\n').find(line=>line.startsWith('"CHK-003"'));
  assert.match(row,/Source model differs from selected model/);
  assert.ok(!row.includes(entry.dimensionsIn.sourceUrl));
  assert.equal(getDimensionInfo(getCatalogRecord('CHK-094'),{...getCatalogRecord('CHK-094'),modelNumber:'NEWLY-IDENTIFIED'}).kind,'unknown');
});

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

test('survey report separates group observations, confidence, reference changes and source-dimension gaps',async()=>{
  const {checklistReport,checklistFollowUp,checklistReferenceChanged}=await import('./dist/model-checklist.mjs');
  const records=checklistRecords({
    'CHK-001':{answer:'yes',correct:'OLDER',modelAtCheck:'OLDER'},
    'CHK-073':{answer:'identified',correct:'OBSERVED-ONLY'}
  });
  const report=checklistReport(records);
  assert.equal(report.summary.groups,95);assert.equal(report.summary.units,155);
  assert.equal(report.summary.observedGroups,2);assert.equal(report.summary.unitsInObservedGroups,5);
  assert.equal(report.summary.uncheckedGroups,93);assert.equal(report.summary.changedReferenceGroups,1);
  assert.match(report.scope,/do not certify/);
  const item=equipmentCatalog.find(item=>item.id==='CHK-001');
  assert.equal(checklistReferenceChanged(item,records[item.id]),true);
  assert.equal(checklistFollowUp(item,records[item.id]),true);
  const changed=report.outstanding.find(item=>item.catalogId==='CHK-001');assert.equal(changed.referenceChanged,true);
  assert.ok(report.areas.every(area=>area.groups>=area.observedGroups));
  assert.equal(report.areas.reduce((sum,area)=>sum+area.observedGroups,0),2);
  assert.ok(report.summary.groupsWithoutSourceDimensions>0);
  assert.match(checklistCSV(records),/Catalog confidence.*Model at check.*Reference changed.*Follow-up needed/);
  assert.equal(equipmentCatalog.find(item=>item.id==='CHK-073').modelStatus,'reported');
});
