import {equipmentCatalog,getCatalogRecord,getDimensionInfo,getDimensionCoverage} from './equipment-catalog.mjs';

// Preserve the original phone checklist's browser key and JSON backup format.
export const CHECKLIST_KEY='hart-model-check-v2';
export const CHECKLIST_RECOVERY_KEY=CHECKLIST_KEY+':before-replace';
const answers=new Set(['yes','no','unknown','identified']);

export function checklistRecords(input,{strict=true}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Checklist records must be an object.');
  const records=Object.create(null);
  for(const [id,record] of Object.entries(input)){
    if(!getCatalogRecord(id))continue;
    const valid=record&&typeof record==='object'&&!Array.isArray(record)&&answers.has(record.answer)&&
      (record.correct===undefined||typeof record.correct==='string'&&record.correct.length<=100)&&
      (record.updated===undefined||typeof record.updated==='string'&&record.updated.length<=50)&&
      (record.modelAtCheck===undefined||typeof record.modelAtCheck==='string'&&record.modelAtCheck.length<=100);
    if(!valid){if(strict)throw Error('Invalid checklist answer for '+id+'.');continue;}
    records[id]={answer:record.answer,correct:record.correct||'',updated:record.updated||'',
      ...(record.modelAtCheck!==undefined?{modelAtCheck:record.modelAtCheck}:{})};
  }
  return records;
}

export function checklistBackup(input){
  if(input?.format!==CHECKLIST_KEY)throw Error('Choose a Hart model checklist v2 backup.');
  return checklistRecords(input.records);
}

export function checklistProgress(records){
  const progress={checked:0,yes:0,no:0,unknown:0};
  for(const entry of equipmentCatalog){
    const answer=records[entry.id]?.answer;
    if(!answers.has(answer))continue;
    progress.checked++;
    progress[answer==='identified'?'no':answer]++;
  }
  return progress;
}

export function checklistReferenceChanged(item,record){
  if(!record)return false;
  const reference=record.modelAtCheck??(record.answer==='yes'?record.correct:null);
  return reference!==null&&reference!==undefined&&reference!==(item.modelNumber||'');
}

export function checklistFollowUp(item,record){
  return !record||record.answer!=='yes'||checklistReferenceChanged(item,record)||item.modelStatus!=='verified';
}

export function checklistDimensionTarget(item,record){
  const reference=record?.modelAtCheck??(record?.answer==='yes'?record.correct:null);
  const modelNumber=['no','identified'].includes(record?.answer)?record.correct||'':checklistReferenceChanged(item,record)?reference:item.modelNumber;
  return {...item,modelNumber};
}

export function checklistReport(records){
  const rows=equipmentCatalog.map(item=>({catalogId:item.id,area:item.area,name:item.name,
    quantity:item.quantity,inventoryIds:[...item.inventoryIds],modelNumber:item.modelNumber,
    modelStatus:item.modelStatus,hasSourceDimensions:getDimensionInfo(item).sourced,dimensionEvidence:getDimensionInfo(item).kind,
    sourceAppliesToObservation:getDimensionInfo(item,checklistDimensionTarget(item,records[item.id])).sourced,
    answer:records[item.id]?.answer||'unchecked',observedModel:records[item.id]?.correct||'',
    referenceChanged:checklistReferenceChanged(item,records[item.id]),
    followUp:checklistFollowUp(item,records[item.id])}));
  const summarize=items=>({groups:items.length,units:items.reduce((sum,item)=>sum+item.quantity,0),
    observedGroups:items.filter(item=>item.answer!=='unchecked').length,
    unitsInObservedGroups:items.filter(item=>item.answer!=='unchecked').reduce((sum,item)=>sum+item.quantity,0),
    uncheckedGroups:items.filter(item=>item.answer==='unchecked').length,
    followUpGroups:items.filter(item=>item.followUp).length,
    changedReferenceGroups:items.filter(item=>item.referenceChanged).length,
    groupsWithoutSourceDimensions:items.filter(item=>!item.hasSourceDimensions).length});
  return {format:'hart-survey-report-v1',scope:'Model observations by group; unit counts do not certify individual units, measurements or placement.',
    dimensionCoverage:getDimensionCoverage(),summary:summarize(rows),areas:[...new Set(rows.map(item=>item.area))].map(area=>({area,...summarize(rows.filter(item=>item.area===area))})),
    outstanding:rows.filter(item=>item.followUp||!item.hasSourceDimensions)};
}

function csvCell(value){
  let text=String(value??'');
  // Quoting alone does not prevent spreadsheet formulas in staff-entered corrections.
  if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

export function checklistCSV(records){
  const rows=[['Check ID','Area','Manufacturer','Equipment','Quantity','Suspected model','Alternative codes','Verified?','Correct model','Inventory IDs','Checked at','Catalog confidence','Model at check','Reference changed','Follow-up needed','Catalog source dimensions available','Dimension evidence for observed model','Applicable dimension source URL']];
  const statuses={yes:'Yes',no:'No',identified:'Model entered',unknown:'Model not found'};
  for(const item of equipmentCatalog){
    const record=records[item.id]||{};
    const info=getDimensionInfo(item,checklistDimensionTarget(item,record));
    rows.push([item.id,item.area,item.manufacturer,item.name,item.quantity,item.modelNumber||'',
      item.modelCandidates.join(' | '),statuses[record.answer]||'Not checked',record.correct||'',
      item.inventoryIds.join(', '),record.updated||'',item.modelStatus,record.modelAtCheck??'',
      checklistReferenceChanged(item,record)?'Yes':'No',checklistFollowUp(item,record)?'Yes':'No',getDimensionInfo(item).sourced?'Yes':'No',info.label,info.sourced||info.kind==='reference-only'?info.evidence.sourceUrl:'']);
  }
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
